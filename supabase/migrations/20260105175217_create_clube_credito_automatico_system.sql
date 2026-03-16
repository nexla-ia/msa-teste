/*
  # Sistema de Crédito Automático de Clubes

  ## Descrição
  Cria funções para processar créditos mensais de clubes e gerar atividades/lembretes.

  ## Funções Criadas
  
  1. **processar_creditos_clubes()**
     - Verifica parceiros com clubes ativos
     - Credita pontos no estoque quando o dia atual = dia_cobranca
     - Evita duplicações verificando se já foi creditado no mês atual
     - Registra o crédito em estoque_pontos
  
  2. **gerar_lembretes_clubes()**
     - Busca créditos que vão acontecer nos próximos 7 dias
     - Cria atividades do tipo 'clube_credito_mensal' como lembretes
     - Evita duplicações de lembretes

  ## Tabelas Afetadas
  - programas_clubes (leitura)
  - estoque_pontos (inserção)
  - atividades (inserção)

  ## Permissões
  - Ambas as funções usam SECURITY DEFINER para executar com privilégios elevados
*/

-- =====================================================
-- Função: Processar Créditos Mensais de Clubes
-- =====================================================
CREATE OR REPLACE FUNCTION processar_creditos_clubes()
RETURNS TABLE (
  parceiro_id uuid,
  parceiro_nome text,
  programa_id uuid,
  programa_nome text,
  pontos_creditados numeric,
  tipo_credito text,
  processado_em timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clube RECORD;
  v_parceiro_nome text;
  v_programa_nome text;
  v_produto_nome text;
  v_ja_creditado boolean;
  v_data_referencia date;
BEGIN
  -- Data de referência é o primeiro dia do mês atual
  v_data_referencia := DATE_TRUNC('month', CURRENT_DATE)::date;
  
  -- Loop por todos os clubes ativos
  FOR v_clube IN
    SELECT 
      pc.*,
      p.nome_parceiro,
      pf.nome as programa_nome,
      pr.nome as produto_nome
    FROM programas_clubes pc
    INNER JOIN parceiros p ON p.id = pc.parceiro_id
    LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
    WHERE pc.tem_clube = true
      AND pc.data_ultima_assinatura IS NOT NULL
      AND pc.dia_cobranca IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = pc.dia_cobranca
  LOOP
    -- Verifica se já foi creditado neste mês
    SELECT EXISTS(
      SELECT 1 
      FROM estoque_pontos 
      WHERE parceiro_id = v_clube.parceiro_id
        AND programa_id = v_clube.programa_id
        AND origem = 'clube_credito_mensal'
        AND data >= v_data_referencia
        AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
    ) INTO v_ja_creditado;
    
    -- Se ainda não foi creditado este mês, processar
    IF NOT v_ja_creditado THEN
      
      -- Crédito mensal regular
      INSERT INTO estoque_pontos (
        parceiro_id,
        programa_id,
        tipo,
        quantidade,
        origem,
        observacao,
        data
      ) VALUES (
        v_clube.parceiro_id,
        v_clube.programa_id,
        'entrada',
        v_clube.quantidade_pontos,
        'clube_credito_mensal',
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, ''),
        CURRENT_DATE
      );
      
      -- Retornar informação do crédito regular
      RETURN QUERY SELECT 
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_clube.quantidade_pontos,
        'credito_mensal'::text,
        CURRENT_TIMESTAMP;
      
      -- Se tem bônus E é a primeira assinatura (data_ultima_assinatura = hoje)
      IF v_clube.bonus_quantidade_pontos > 0 
         AND v_clube.data_ultima_assinatura = CURRENT_DATE THEN
        
        INSERT INTO estoque_pontos (
          parceiro_id,
          programa_id,
          tipo,
          quantidade,
          origem,
          observacao,
          data
        ) VALUES (
          v_clube.parceiro_id,
          v_clube.programa_id,
          'entrada',
          v_clube.bonus_quantidade_pontos,
          'clube_credito_bonus',
          'Bônus de boas-vindas do clube ' || COALESCE(v_clube.produto_nome, ''),
          CURRENT_DATE
        );
        
        -- Retornar informação do bônus
        RETURN QUERY SELECT 
          v_clube.parceiro_id,
          v_clube.nome_parceiro,
          v_clube.programa_id,
          v_clube.programa_nome,
          v_clube.bonus_quantidade_pontos,
          'credito_bonus'::text,
          CURRENT_TIMESTAMP;
      END IF;
      
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- =====================================================
-- Função: Gerar Lembretes de Créditos Futuros
-- =====================================================
CREATE OR REPLACE FUNCTION gerar_lembretes_clubes()
RETURNS TABLE (
  atividade_id uuid,
  parceiro_nome text,
  programa_nome text,
  pontos numeric,
  data_prevista date
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clube RECORD;
  v_proximo_credito date;
  v_ja_existe boolean;
  v_atividade_id uuid;
BEGIN
  -- Loop por todos os clubes ativos
  FOR v_clube IN
    SELECT 
      pc.*,
      p.nome_parceiro,
      pf.nome as programa_nome,
      pr.nome as produto_nome
    FROM programas_clubes pc
    INNER JOIN parceiros p ON p.id = pc.parceiro_id
    LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
    WHERE pc.tem_clube = true
      AND pc.data_ultima_assinatura IS NOT NULL
      AND pc.dia_cobranca IS NOT NULL
      AND pc.quantidade_pontos > 0
  LOOP
    -- Calcular a próxima data de crédito
    -- Se o dia da cobrança já passou este mês, calcular para o próximo mês
    v_proximo_credito := MAKE_DATE(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      LEAST(v_clube.dia_cobranca, EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
    );
    
    -- Se a data calculada já passou, usar o próximo mês
    IF v_proximo_credito < CURRENT_DATE THEN
      v_proximo_credito := MAKE_DATE(
        EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        LEAST(v_clube.dia_cobranca, EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 month') - INTERVAL '1 day'))::int)
      );
    END IF;
    
    -- Só criar lembrete se estiver nos próximos 7 dias
    IF v_proximo_credito <= CURRENT_DATE + INTERVAL '7 days' THEN
      
      -- Verificar se já existe uma atividade para este crédito
      SELECT EXISTS(
        SELECT 1 
        FROM atividades 
        WHERE parceiro_id = v_clube.parceiro_id
          AND programa_id = v_clube.programa_id
          AND tipo_atividade = 'clube_credito_mensal'
          AND data_prevista = v_proximo_credito
          AND (status IS NULL OR status != 'concluida')
      ) INTO v_ja_existe;
      
      -- Se não existe, criar
      IF NOT v_ja_existe THEN
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
          prioridade,
          status
        ) VALUES (
          'clube_credito_mensal',
          'Crédito mensal de clube',
          'Crédito mensal de ' || v_clube.quantidade_pontos || ' pontos do clube ' || COALESCE(v_clube.produto_nome, ''),
          v_clube.parceiro_id,
          v_clube.nome_parceiro,
          v_clube.programa_id,
          v_clube.programa_nome,
          v_clube.quantidade_pontos,
          v_proximo_credito,
          v_clube.id,
          'programas_clubes',
          'alta',
          'pendente'
        )
        RETURNING id INTO v_atividade_id;
        
        -- Retornar informação do lembrete criado
        RETURN QUERY SELECT 
          v_atividade_id,
          v_clube.nome_parceiro,
          v_clube.programa_nome,
          v_clube.quantidade_pontos,
          v_proximo_credito;
      END IF;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- =====================================================
-- Comentários nas Funções
-- =====================================================
COMMENT ON FUNCTION processar_creditos_clubes() IS 
'Processa créditos mensais de pontos para parceiros com clubes ativos. Executa no dia da cobrança e evita duplicações.';

COMMENT ON FUNCTION gerar_lembretes_clubes() IS 
'Gera atividades/lembretes para créditos de clubes que vão acontecer nos próximos 7 dias.';
