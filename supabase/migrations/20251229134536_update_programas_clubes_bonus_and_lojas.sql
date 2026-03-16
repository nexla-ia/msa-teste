/*
  # Melhorias em Programas/Clubes e Lojas

  ## 1. Programas/Clubes
  - Renomear bonus_porcentagem para bonus_quantidade_pontos
  - Adicionar constraint: se tem_clube = true, quantidade_pontos deve ser obrigatório

  ## 2. Lojas
  - Adicionar campo cnpj (único)
  - Adicionar campo telefone
  - Adicionar campo observacoes
  - Adicionar constraint de nome único

  ## 3. Segurança
  - Mantém RLS existente
*/

-- =====================
-- Programas/Clubes
-- =====================

-- Adicionar novo campo bonus_quantidade_pontos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programas_clubes' AND column_name = 'bonus_quantidade_pontos'
  ) THEN
    ALTER TABLE programas_clubes 
    ADD COLUMN bonus_quantidade_pontos integer;
  END IF;
END $$;

-- Migrar dados de bonus_porcentagem para bonus_quantidade_pontos
-- (convertendo porcentagem em pontos baseado em quantidade_pontos)
UPDATE programas_clubes
SET bonus_quantidade_pontos = FLOOR(quantidade_pontos * bonus_porcentagem / 100)
WHERE bonus_porcentagem IS NOT NULL 
  AND quantidade_pontos IS NOT NULL
  AND bonus_quantidade_pontos IS NULL;

-- Função para validar que quantidade_pontos é obrigatório quando tem_clube = true
CREATE OR REPLACE FUNCTION validar_clube_quantidade_pontos()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tem_clube = true AND (NEW.quantidade_pontos IS NULL OR NEW.quantidade_pontos <= 0) THEN
    RAISE EXCEPTION 'Quantidade de pontos é obrigatória quando tem clube ativo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validação
DROP TRIGGER IF EXISTS trigger_validar_clube_quantidade_pontos ON programas_clubes;
CREATE TRIGGER trigger_validar_clube_quantidade_pontos
  BEFORE INSERT OR UPDATE ON programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION validar_clube_quantidade_pontos();

-- Atualizar função de atividades para usar bonus_quantidade_pontos
CREATE OR REPLACE FUNCTION criar_atividades_clube()
RETURNS TRIGGER AS $$
DECLARE
  v_proximo_credito date;
BEGIN
  IF NEW.tem_clube = true 
     AND NEW.data_ultima_assinatura IS NOT NULL 
     AND NEW.dia_cobranca IS NOT NULL 
     AND NEW.quantidade_pontos > 0 THEN
    
    v_proximo_credito := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    v_proximo_credito := MAKE_DATE(
      EXTRACT(YEAR FROM v_proximo_credito)::int,
      EXTRACT(MONTH FROM v_proximo_credito)::int,
      LEAST(NEW.dia_cobranca, EXTRACT(DAY FROM v_proximo_credito)::int)
    );

    IF v_proximo_credito < CURRENT_DATE THEN
      v_proximo_credito := MAKE_DATE(
        EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        LEAST(NEW.dia_cobranca, EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 month') - INTERVAL '1 day'))::int)
      );
    END IF;

    INSERT INTO atividades (
      tipo_atividade,
      titulo,
      descricao,
      parceiro_id,
      parceiro_nome,
      programa_id,
      programa_nome,
      quantidade_pontos,
      data_prevista,
      referencia_id,
      referencia_tabela,
      prioridade
    )
    SELECT
      'clube_credito_mensal',
      'Crédito mensal de clube',
      'Crédito mensal de ' || NEW.quantidade_pontos || ' pontos do clube ' || pr.nome,
      NEW.parceiro_id,
      p.nome,
      NEW.programa_id,
      pf.nome,
      NEW.quantidade_pontos,
      v_proximo_credito,
      NEW.id,
      'programas_clubes',
      'alta'
    FROM parceiros p
    LEFT JOIN programas_fidelidade pf ON pf.id = NEW.programa_id
    LEFT JOIN produtos pr ON pr.id = NEW.clube_produto_id
    WHERE p.id = NEW.parceiro_id;

    -- Se tem bônus e é primeira assinatura, criar atividade de bônus
    IF NEW.bonus_quantidade_pontos > 0 AND NEW.data_ultima_assinatura = CURRENT_DATE THEN
      INSERT INTO atividades (
        tipo_atividade,
        titulo,
        descricao,
        parceiro_id,
        parceiro_nome,
        programa_id,
        programa_nome,
        quantidade_pontos,
        data_prevista,
        referencia_id,
        referencia_tabela,
        prioridade
      )
      SELECT
        'clube_credito_bonus',
        'Bônus de boas-vindas do clube',
        'Bônus de ' || NEW.bonus_quantidade_pontos || ' pontos do clube ' || pr.nome,
        NEW.parceiro_id,
        p.nome,
        NEW.programa_id,
        pf.nome,
        NEW.bonus_quantidade_pontos,
        v_proximo_credito,
        NEW.id,
        'programas_clubes',
        'alta'
      FROM parceiros p
      LEFT JOIN programas_fidelidade pf ON pf.id = NEW.programa_id
      LEFT JOIN produtos pr ON pr.id = NEW.clube_produto_id
      WHERE p.id = NEW.parceiro_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função de processar créditos para usar bonus_quantidade_pontos
CREATE OR REPLACE FUNCTION processar_creditos_clubes_mensais()
RETURNS TABLE (
  clubes_processados int,
  pontos_creditados numeric,
  mensagem text
) AS $$
DECLARE
  v_clube RECORD;
  v_pontos_creditados numeric := 0;
  v_contador int := 0;
  v_bonus numeric;
  v_total_pontos numeric;
BEGIN
  FOR v_clube IN
    SELECT 
      pc.*,
      p.nome as parceiro_nome,
      pf.nome as programa_nome
    FROM programas_clubes pc
    JOIN parceiros p ON p.id = pc.parceiro_id
    JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    WHERE pc.tem_clube = true
      AND pc.quantidade_pontos > 0
      AND pc.dia_cobranca = EXTRACT(DAY FROM CURRENT_DATE)::int
      AND (pc.data_ultima_assinatura IS NULL 
           OR pc.data_ultima_assinatura < DATE_TRUNC('month', CURRENT_DATE)::date)
  LOOP
    v_bonus := 0;
    IF v_clube.bonus_quantidade_pontos > 0 
       AND (v_clube.data_ultima_assinatura IS NULL 
            OR DATE_TRUNC('month', v_clube.data_ultima_assinatura) < DATE_TRUNC('month', CURRENT_DATE)) THEN
      v_bonus := v_clube.bonus_quantidade_pontos;
    END IF;

    v_total_pontos := v_clube.quantidade_pontos + v_bonus;

    INSERT INTO estoque_pontos (
      parceiro_id,
      programa_id,
      tipo_movimentacao,
      quantidade,
      valor_total,
      data_movimentacao,
      observacao
    ) VALUES (
      v_clube.parceiro_id,
      v_clube.programa_id,
      'entrada',
      v_total_pontos,
      v_clube.valor,
      CURRENT_DATE,
      'Crédito mensal automático do clube' || 
      CASE WHEN v_bonus > 0 THEN ' (inclui bônus de ' || v_bonus || ' pontos)' ELSE '' END
    );

    UPDATE programas_clubes
    SET data_ultima_assinatura = CURRENT_DATE,
        updated_at = now()
    WHERE id = v_clube.id;

    UPDATE atividades
    SET status = 'processado',
        processado_em = now()
    WHERE referencia_id = v_clube.id
      AND referencia_tabela = 'programas_clubes'
      AND data_prevista = CURRENT_DATE
      AND status = 'pendente';

    v_pontos_creditados := v_pontos_creditados + v_total_pontos;
    v_contador := v_contador + 1;
  END LOOP;

  clubes_processados := v_contador;
  pontos_creditados := v_pontos_creditados;
  mensagem := 'Processamento concluído com sucesso';

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- Lojas
-- =====================

-- Adicionar campo cnpj
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lojas' AND column_name = 'cnpj'
  ) THEN
    ALTER TABLE lojas 
    ADD COLUMN cnpj text;
  END IF;
END $$;

-- Adicionar campo telefone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lojas' AND column_name = 'telefone'
  ) THEN
    ALTER TABLE lojas 
    ADD COLUMN telefone text;
  END IF;
END $$;

-- Adicionar campo observacoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lojas' AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE lojas 
    ADD COLUMN observacoes text;
  END IF;
END $$;

-- Criar constraint de nome único
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lojas_nome_unique'
  ) THEN
    ALTER TABLE lojas 
    ADD CONSTRAINT lojas_nome_unique UNIQUE (nome);
  END IF;
END $$;

-- Criar constraint de CNPJ único (permitindo null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lojas_cnpj_unique'
  ) THEN
    CREATE UNIQUE INDEX lojas_cnpj_unique ON lojas(cnpj) WHERE cnpj IS NOT NULL;
  END IF;
END $$;
