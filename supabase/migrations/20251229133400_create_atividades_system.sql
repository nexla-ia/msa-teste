/*
  # Sistema de Atividades e Créditos Recorrentes

  ## 1. Nova Tabela: atividades
  Tabela para rastrear todas as atividades/lembretes do sistema:
  - Transferências de pontos agendadas para o futuro
  - Créditos mensais de clubes a serem processados
  - Bônus de bumerangue a receber
  - Outras atividades importantes

  ## 2. Função: processar_creditos_clubes_mensais
  Processa automaticamente os créditos mensais dos clubes:
  - Verifica clubes ativos com data_ultima_assinatura
  - Calcula próximas datas de crédito baseado no dia_cobranca
  - Registra pontos mensais + bônus (se aplicável) em estoque_pontos
  - Atualiza data_ultima_assinatura

  ## 3. Triggers
  - Criar atividades quando transferências têm datas futuras
  - Criar atividades para novos clubes assinados
  - Atualizar atividades quando dados são modificados

  ## 4. View: atividades_pendentes
  View otimizada para dashboard mostrar atividades da semana

  ## 5. Segurança
  - RLS habilitado em atividades
  - Políticas para usuários autenticados
*/

-- Criar tabela de atividades
CREATE TABLE IF NOT EXISTS atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_atividade text NOT NULL CHECK (tipo_atividade IN (
    'transferencia_entrada',
    'transferencia_bonus',
    'bumerangue_retorno',
    'clube_credito_mensal',
    'clube_credito_bonus',
    'outro'
  )),
  titulo text NOT NULL,
  descricao text,
  parceiro_id uuid REFERENCES parceiros(id) ON DELETE CASCADE,
  parceiro_nome text,
  programa_id uuid REFERENCES programas_fidelidade(id),
  programa_nome text,
  quantidade_pontos numeric(15,2),
  data_prevista date NOT NULL,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'processado', 'cancelado')),
  referencia_id uuid,
  referencia_tabela text,
  prioridade text DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  processado_em timestamptz,
  processado_por uuid,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_atividades_data_prevista ON atividades(data_prevista);
CREATE INDEX IF NOT EXISTS idx_atividades_status ON atividades(status);
CREATE INDEX IF NOT EXISTS idx_atividades_parceiro ON atividades(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_atividades_tipo ON atividades(tipo_atividade);
CREATE INDEX IF NOT EXISTS idx_atividades_referencia ON atividades(referencia_id, referencia_tabela);

-- Habilitar RLS
ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem visualizar atividades"
  ON atividades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem inserir atividades"
  ON atividades FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar atividades"
  ON atividades FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários podem deletar atividades"
  ON atividades FOR DELETE
  TO authenticated
  USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_atividades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_atividades_updated_at
  BEFORE UPDATE ON atividades
  FOR EACH ROW
  EXECUTE FUNCTION update_atividades_updated_at();

-- Função para criar atividades de transferências futuras
CREATE OR REPLACE FUNCTION criar_atividades_transferencia()
RETURNS TRIGGER AS $$
BEGIN
  -- Atividade para recebimento principal
  IF NEW.destino_data_recebimento > CURRENT_DATE THEN
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
      'transferencia_entrada',
      'Entrada de pontos agendada',
      'Transferência de ' || NEW.destino_quantidade || ' pontos',
      NEW.parceiro_id,
      p.nome,
      NEW.destino_programa_id,
      pf.nome,
      NEW.destino_quantidade,
      NEW.destino_data_recebimento,
      NEW.id,
      'transferencia_pontos',
      'normal'
    FROM parceiros p
    LEFT JOIN programas_fidelidade pf ON pf.id = NEW.destino_programa_id
    WHERE p.id = NEW.parceiro_id;
  END IF;

  -- Atividade para bônus (se houver)
  IF NEW.destino_data_recebimento_bonus IS NOT NULL 
     AND NEW.destino_data_recebimento_bonus > CURRENT_DATE 
     AND NEW.destino_quantidade_bonus > 0 THEN
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
      'transferencia_bonus',
      'Bônus de transferência agendado',
      'Bônus de ' || NEW.destino_quantidade_bonus || ' pontos (' || NEW.destino_bonus_percentual || '%)',
      NEW.parceiro_id,
      p.nome,
      NEW.destino_programa_id,
      pf.nome,
      NEW.destino_quantidade_bonus,
      NEW.destino_data_recebimento_bonus,
      NEW.id,
      'transferencia_pontos',
      'normal'
    FROM parceiros p
    LEFT JOIN programas_fidelidade pf ON pf.id = NEW.destino_programa_id
    WHERE p.id = NEW.parceiro_id;
  END IF;

  -- Atividade para bumerangue (se houver)
  IF NEW.bumerangue_data_recebimento IS NOT NULL 
     AND NEW.bumerangue_data_recebimento > CURRENT_DATE 
     AND NEW.bumerangue_quantidade_bonus > 0 THEN
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
      'bumerangue_retorno',
      'Retorno de bumerangue agendado',
      'Retorno de ' || NEW.bumerangue_quantidade_bonus || ' pontos (' || NEW.bumerangue_bonus_percentual || '%)',
      NEW.parceiro_id,
      p.nome,
      NEW.origem_programa_id,
      pf.nome,
      NEW.bumerangue_quantidade_bonus,
      NEW.bumerangue_data_recebimento,
      NEW.id,
      'transferencia_pontos',
      'alta'
    FROM parceiros p
    LEFT JOIN programas_fidelidade pf ON pf.id = NEW.origem_programa_id
    WHERE p.id = NEW.parceiro_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar atividades de transferências
DROP TRIGGER IF EXISTS trigger_criar_atividades_transferencia ON transferencia_pontos;
CREATE TRIGGER trigger_criar_atividades_transferencia
  AFTER INSERT ON transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION criar_atividades_transferencia();

-- Função para criar atividades de clubes
CREATE OR REPLACE FUNCTION criar_atividades_clube()
RETURNS TRIGGER AS $$
DECLARE
  v_proximo_credito date;
BEGIN
  -- Só processar se tem_clube = true e tem os dados necessários
  IF NEW.tem_clube = true 
     AND NEW.data_ultima_assinatura IS NOT NULL 
     AND NEW.dia_cobranca IS NOT NULL 
     AND NEW.quantidade_pontos > 0 THEN
    
    -- Calcular próxima data de crédito
    v_proximo_credito := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    v_proximo_credito := MAKE_DATE(
      EXTRACT(YEAR FROM v_proximo_credito)::int,
      EXTRACT(MONTH FROM v_proximo_credito)::int,
      LEAST(NEW.dia_cobranca, EXTRACT(DAY FROM v_proximo_credito)::int)
    );

    -- Se a data calculada já passou neste mês, usar o próximo mês
    IF v_proximo_credito < CURRENT_DATE THEN
      v_proximo_credito := MAKE_DATE(
        EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        LEAST(NEW.dia_cobranca, EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 month') - INTERVAL '1 day'))::int)
      );
    END IF;

    -- Criar atividade para crédito mensal
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

    -- Se tem bônus de boas-vindas e é primeira assinatura, criar atividade de bônus
    IF NEW.bonus_porcentagem > 0 AND NEW.data_ultima_assinatura = CURRENT_DATE THEN
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
        'Bônus de ' || FLOOR(NEW.quantidade_pontos * NEW.bonus_porcentagem / 100) || ' pontos (' || NEW.bonus_porcentagem || '%) do clube ' || pr.nome,
        NEW.parceiro_id,
        p.nome,
        NEW.programa_id,
        pf.nome,
        FLOOR(NEW.quantidade_pontos * NEW.bonus_porcentagem / 100),
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

-- Trigger para criar atividades de clubes
DROP TRIGGER IF EXISTS trigger_criar_atividades_clube ON programas_clubes;
CREATE TRIGGER trigger_criar_atividades_clube
  AFTER INSERT OR UPDATE OF tem_clube, data_ultima_assinatura, dia_cobranca, quantidade_pontos
  ON programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION criar_atividades_clube();

-- Função para processar créditos mensais de clubes automaticamente
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
  -- Buscar clubes ativos que devem receber crédito hoje
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
    -- Calcular bônus se aplicável (apenas no primeiro mês)
    v_bonus := 0;
    IF v_clube.bonus_porcentagem > 0 
       AND (v_clube.data_ultima_assinatura IS NULL 
            OR DATE_TRUNC('month', v_clube.data_ultima_assinatura) < DATE_TRUNC('month', CURRENT_DATE)) THEN
      v_bonus := FLOOR(v_clube.quantidade_pontos * v_clube.bonus_porcentagem / 100);
    END IF;

    v_total_pontos := v_clube.quantidade_pontos + v_bonus;

    -- Inserir no estoque de pontos
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

    -- Atualizar data da última assinatura
    UPDATE programas_clubes
    SET data_ultima_assinatura = CURRENT_DATE,
        updated_at = now()
    WHERE id = v_clube.id;

    -- Marcar atividade como processada
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

-- View para mostrar atividades pendentes (útil para dashboard)
CREATE OR REPLACE VIEW atividades_pendentes AS
SELECT 
  a.*,
  CASE 
    WHEN a.data_prevista = CURRENT_DATE THEN 'Hoje'
    WHEN a.data_prevista = CURRENT_DATE + 1 THEN 'Amanhã'
    WHEN a.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 THEN 'Esta semana'
    WHEN a.data_prevista BETWEEN CURRENT_DATE + 8 AND CURRENT_DATE + 30 THEN 'Este mês'
    ELSE 'Futuro'
  END as periodo,
  a.data_prevista - CURRENT_DATE as dias_restantes
FROM atividades a
WHERE a.status = 'pendente'
  AND a.data_prevista >= CURRENT_DATE
ORDER BY a.data_prevista ASC, a.prioridade DESC, a.created_at ASC;
