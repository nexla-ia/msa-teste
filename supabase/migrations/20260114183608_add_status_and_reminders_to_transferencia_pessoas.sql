/*
  # Sistema de agendamento e lembretes para transferência entre pessoas

  1. Alterações na tabela transferencia_pessoas
    - Adicionar campo `status` (Pendente/Concluído) - controla quando os pontos entram no destino
    
  2. Lógica de Status
    - Se `data_recebimento` <= hoje: status = Concluído (pontos entram imediatamente)
    - Se `data_recebimento` > hoje: status = Pendente (pontos entram na data)
    
  3. Comportamento
    - A origem SEMPRE é debitada imediatamente (sem agendamento)
    - O destino segue a regra de agendamento baseada na data_recebimento
    - Cria atividade/lembrete quando transferência é criada
    
  4. Atividades/Lembretes
    - Quando uma transferência é criada com data futura, cria uma atividade
    - Tipo: "Lembrete - Transferência entre Pessoas"
    - Descrição: detalha origem, destino, programa e quantidade
*/

-- Adicionar campo status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transferencia_pessoas' AND column_name = 'status'
  ) THEN
    ALTER TABLE transferencia_pessoas ADD COLUMN status text DEFAULT 'Pendente';
  END IF;
END $$;

-- Remover o trigger antigo que processava imediatamente
DROP TRIGGER IF EXISTS trigger_process_transferencia_pessoas ON transferencia_pessoas;

-- Função para debitar origem imediatamente
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_saldo numeric;
  v_destino_parceiro_nome text;
BEGIN
  -- Validar saldo da origem
  SELECT saldo_atual INTO v_origem_saldo
  FROM estoque_pontos
  WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;
  
  IF v_origem_saldo < NEW.quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no estoque de origem';
  END IF;
  
  -- Buscar nome do parceiro destino para histórico
  SELECT nome_parceiro INTO v_destino_parceiro_nome
  FROM parceiros
  WHERE id = NEW.destino_parceiro_id;
  
  -- Debitar da origem
  PERFORM atualizar_estoque_pontos(
    NEW.origem_parceiro_id,
    NEW.programa_id,
    -NEW.quantidade,
    'Saída',
    0
  );
  
  -- Registrar movimentação no histórico (saída)
  PERFORM registrar_movimentacao_transferencia_pessoas(
    NEW.origem_parceiro_id,
    NEW.programa_id,
    'saida',
    NEW.quantidade,
    NEW.custo_transferencia,
    v_destino_parceiro_nome,
    NEW.id
  );
  
  RETURN NEW;
END;
$$;

-- Função para creditar destino (apenas quando status = Concluído)
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destino_estoque_id uuid;
  v_destino_saldo numeric;
  v_destino_custo_medio numeric;
  v_origem_custo_medio numeric;
  v_novo_saldo_destino numeric;
  v_novo_custo_medio numeric;
  v_origem_parceiro_nome text;
BEGIN
  -- Se for INSERT e status = Concluído, creditar pontos
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    
    -- Buscar nome do parceiro origem para histórico
    SELECT nome_parceiro INTO v_origem_parceiro_nome
    FROM parceiros
    WHERE id = NEW.origem_parceiro_id;
    
    -- Buscar custo médio da origem
    SELECT custo_medio INTO v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;
    
    -- Buscar ou criar estoque do destino
    SELECT id, saldo_atual, custo_medio 
    INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.destino_parceiro_id AND programa_id = NEW.programa_id;
    
    IF v_destino_estoque_id IS NULL THEN
      -- Criar estoque para o destino
      INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
      VALUES (NEW.destino_parceiro_id, NEW.programa_id, 0, 0)
      RETURNING id, saldo_atual, custo_medio 
      INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio;
    END IF;
    
    -- Calcular novo saldo e custo médio do destino
    v_novo_saldo_destino := v_destino_saldo + NEW.quantidade;
    IF v_novo_saldo_destino > 0 THEN
      v_novo_custo_medio := ((v_destino_saldo * v_destino_custo_medio) + (NEW.quantidade * COALESCE(v_origem_custo_medio, 0))) / v_novo_saldo_destino;
    ELSE
      v_novo_custo_medio := 0;
    END IF;
    
    -- Atualizar estoque de destino
    UPDATE estoque_pontos
    SET saldo_atual = v_novo_saldo_destino,
        custo_medio = v_novo_custo_medio,
        updated_at = now()
    WHERE id = v_destino_estoque_id;
    
    -- Registrar movimentação no histórico (entrada)
    PERFORM registrar_movimentacao_transferencia_pessoas(
      NEW.destino_parceiro_id,
      NEW.programa_id,
      'entrada',
      NEW.quantidade,
      0,
      v_origem_parceiro_nome,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para definir status inicial baseado na data
CREATE OR REPLACE FUNCTION definir_status_inicial_transferencia_pessoas()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Definir status baseado na data de recebimento
  IF NEW.data_recebimento <= CURRENT_DATE THEN
    NEW.status := 'Concluído';
  ELSE
    NEW.status := 'Pendente';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para criar atividade/lembrete
CREATE OR REPLACE FUNCTION criar_lembrete_transferencia_pessoas()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_parceiro_nome text;
  v_destino_parceiro_nome text;
  v_programa_nome text;
  v_descricao text;
BEGIN
  -- Apenas criar lembrete se status for Pendente (data futura)
  IF NEW.status = 'Pendente' THEN
    -- Buscar nomes
    SELECT nome_parceiro INTO v_origem_parceiro_nome
    FROM parceiros WHERE id = NEW.origem_parceiro_id;
    
    SELECT nome_parceiro INTO v_destino_parceiro_nome
    FROM parceiros WHERE id = NEW.destino_parceiro_id;
    
    SELECT nome INTO v_programa_nome
    FROM programas_fidelidade WHERE id = NEW.programa_id;
    
    -- Montar descrição
    v_descricao := 'Transferência entre pessoas: ' || 
                   NEW.quantidade::text || ' pontos de ' || 
                   v_origem_parceiro_nome || ' para ' || 
                   v_destino_parceiro_nome || ' no programa ' || 
                   v_programa_nome || '. ' ||
                   'Entrada programada para ' || TO_CHAR(NEW.data_recebimento, 'DD/MM/YYYY') || '.';
    
    -- Criar atividade
    INSERT INTO atividades (
      tipo,
      descricao,
      data_atividade,
      status,
      created_by
    ) VALUES (
      'Lembrete - Transferência entre Pessoas',
      v_descricao,
      NEW.data_recebimento,
      'Pendente',
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para verificar e processar transferências pendentes (job diário)
CREATE OR REPLACE FUNCTION verificar_e_processar_transferencias_pessoas()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Atualizar status das transferências cuja data chegou
  UPDATE transferencia_pessoas
  SET status = 'Concluído'
  WHERE status = 'Pendente'
    AND data_recebimento <= CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RAISE NOTICE 'Processadas % transferências entre pessoas pendentes', v_count;
END;
$$;

-- Criar triggers

-- Trigger para definir status inicial ANTES do INSERT
DROP TRIGGER IF EXISTS trigger_definir_status_inicial_transferencia_pessoas ON transferencia_pessoas;
CREATE TRIGGER trigger_definir_status_inicial_transferencia_pessoas
  BEFORE INSERT ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION definir_status_inicial_transferencia_pessoas();

-- Trigger para debitar origem imediatamente APÓS INSERT
DROP TRIGGER IF EXISTS trigger_transferencia_pessoas_debitar_origem ON transferencia_pessoas;
CREATE TRIGGER trigger_transferencia_pessoas_debitar_origem
  AFTER INSERT ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_pessoas_origem();

-- Trigger para creditar destino (INSERT e UPDATE de status)
DROP TRIGGER IF EXISTS trigger_transferencia_pessoas_creditar_destino_insert ON transferencia_pessoas;
DROP TRIGGER IF EXISTS trigger_transferencia_pessoas_creditar_destino_update ON transferencia_pessoas;

CREATE TRIGGER trigger_transferencia_pessoas_creditar_destino_insert
  AFTER INSERT ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_pessoas_destino();

CREATE TRIGGER trigger_transferencia_pessoas_creditar_destino_update
  AFTER UPDATE ON transferencia_pessoas
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION processar_transferencia_pessoas_destino();

-- Trigger para criar lembrete APÓS INSERT
DROP TRIGGER IF EXISTS trigger_criar_lembrete_transferencia_pessoas ON transferencia_pessoas;
CREATE TRIGGER trigger_criar_lembrete_transferencia_pessoas
  AFTER INSERT ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION criar_lembrete_transferencia_pessoas();

-- Atualizar transferências existentes para terem status baseado na data
UPDATE transferencia_pessoas
SET status = CASE
  WHEN data_recebimento <= CURRENT_DATE THEN 'Concluído'
  ELSE 'Pendente'
END
WHERE status IS NULL OR status = 'Pendente';

COMMENT ON FUNCTION processar_transferencia_pessoas_origem() IS 
'Debita pontos da origem imediatamente após INSERT de transferência entre pessoas';

COMMENT ON FUNCTION processar_transferencia_pessoas_destino() IS 
'Credita pontos no destino apenas quando status = Concluído';

COMMENT ON FUNCTION definir_status_inicial_transferencia_pessoas() IS 
'Define o status inicial da transferência baseado na data_recebimento antes do INSERT';

COMMENT ON FUNCTION criar_lembrete_transferencia_pessoas() IS 
'Cria atividade de lembrete quando transferência é criada com data futura';

COMMENT ON FUNCTION verificar_e_processar_transferencias_pessoas() IS 
'Job diário que verifica datas e processa transferências pendentes';
