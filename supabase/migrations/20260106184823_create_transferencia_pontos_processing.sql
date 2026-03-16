/*
  # Sistema de processamento de transferências de pontos

  1. Funções
    - processar_transferencia_origem() - Debita pontos da origem imediatamente
    - processar_transferencia_destino() - Credita pontos no destino quando status muda para Concluído
    - verificar_e_atualizar_status_transferencias() - Job que verifica datas e atualiza status
    
  2. Triggers
    - Após INSERT: debita origem imediatamente, credita destino se data = hoje
    - Após UPDATE de status: processa créditos quando status muda para Concluído
    
  3. Comportamento
    - Origem sempre é debitada imediatamente no INSERT
    - Destino só é creditado quando status = Concluído
    - Bônus destino só é creditado quando status_bonus_destino = Concluído
    - Bônus bumerangue só é creditado quando status_bonus_bumerangue = Concluído
*/

-- Função para processar débito da origem (sempre imediato)
CREATE OR REPLACE FUNCTION processar_transferencia_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Debita da origem
  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.origem_programa_id,
    -NEW.origem_quantidade,
    'Saída',
    0
  );
  
  RETURN NEW;
END;
$$;

-- Função para processar créditos no destino (apenas quando status = Concluído)
CREATE OR REPLACE FUNCTION processar_transferencia_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_custo_medio decimal;
BEGIN
  -- Buscar custo médio da origem
  SELECT custo_medio INTO v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id 
    AND programa_id = NEW.origem_programa_id;
  
  -- Se for INSERT e status = Concluído, creditar pontos principais
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      (NEW.destino_quantidade / 1000) * COALESCE(v_origem_custo_medio, 0)
    );
  END IF;
  
  -- Se for INSERT e status_bonus_destino = Concluído e tem bônus, creditar bônus
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0
    );
  END IF;
  
  -- Se for INSERT e status_bonus_bumerangue = Concluído e tem bônus, creditar bônus bumerangue
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0
    );
  END IF;
  
  -- Se for UPDATE de Pendente para Concluído, processar pontos principais
  IF (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      (NEW.destino_quantidade / 1000) * COALESCE(v_origem_custo_medio, 0)
    );
  END IF;
  
  -- Se for UPDATE de status_bonus_destino de Pendente para Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_destino = 'Pendente' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0
    );
  END IF;
  
  -- Se for UPDATE de status_bonus_bumerangue de Pendente para Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_bumerangue = 'Pendente' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para debitar origem imediatamente após INSERT
DROP TRIGGER IF EXISTS trigger_transferencia_debitar_origem ON transferencia_pontos;

CREATE TRIGGER trigger_transferencia_debitar_origem
  AFTER INSERT ON transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_origem();

-- Trigger para creditar destino (INSERT e UPDATE de status)
DROP TRIGGER IF EXISTS trigger_transferencia_creditar_destino_insert ON transferencia_pontos;
DROP TRIGGER IF EXISTS trigger_transferencia_creditar_destino_update ON transferencia_pontos;

CREATE TRIGGER trigger_transferencia_creditar_destino_insert
  AFTER INSERT ON transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_destino();

CREATE TRIGGER trigger_transferencia_creditar_destino_update
  AFTER UPDATE ON transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_destino();

-- Função para verificar e atualizar status de transferências (job diário)
CREATE OR REPLACE FUNCTION verificar_e_atualizar_status_transferencias()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  transferencia_record RECORD;
BEGIN
  -- Atualizar status dos pontos principais
  UPDATE transferencia_pontos
  SET status = 'Concluído'
  WHERE status = 'Pendente'
    AND destino_data_recebimento <= CURRENT_DATE;
  
  -- Atualizar status do bônus de destino
  UPDATE transferencia_pontos
  SET status_bonus_destino = 'Concluído'
  WHERE status_bonus_destino = 'Pendente'
    AND destino_data_recebimento_bonus IS NOT NULL
    AND destino_data_recebimento_bonus <= CURRENT_DATE
    AND destino_quantidade_bonus > 0;
  
  -- Atualizar status do bônus bumerangue
  UPDATE transferencia_pontos
  SET status_bonus_bumerangue = 'Concluído'
  WHERE status_bonus_bumerangue = 'Pendente'
    AND bumerangue_data_recebimento IS NOT NULL
    AND bumerangue_data_recebimento <= CURRENT_DATE
    AND bumerangue_quantidade_bonus > 0;
    
  RAISE NOTICE 'Status de transferências atualizado com sucesso';
END;
$$;

-- Função para definir status inicial baseado nas datas (será chamada antes do INSERT via trigger)
CREATE OR REPLACE FUNCTION definir_status_inicial_transferencia()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Definir status dos pontos principais
  IF NEW.destino_data_recebimento <= CURRENT_DATE THEN
    NEW.status := 'Concluído';
  ELSE
    NEW.status := 'Pendente';
  END IF;
  
  -- Definir status do bônus de destino
  IF NEW.destino_quantidade_bonus > 0 AND NEW.destino_data_recebimento_bonus IS NOT NULL THEN
    IF NEW.destino_data_recebimento_bonus <= CURRENT_DATE THEN
      NEW.status_bonus_destino := 'Concluído';
    ELSE
      NEW.status_bonus_destino := 'Pendente';
    END IF;
  ELSE
    NEW.status_bonus_destino := 'N/A';
  END IF;
  
  -- Definir status do bônus bumerangue
  IF NEW.bumerangue_quantidade_bonus > 0 AND NEW.bumerangue_data_recebimento IS NOT NULL THEN
    IF NEW.bumerangue_data_recebimento <= CURRENT_DATE THEN
      NEW.status_bonus_bumerangue := 'Concluído';
    ELSE
      NEW.status_bonus_bumerangue := 'Pendente';
    END IF;
  ELSE
    NEW.status_bonus_bumerangue := 'N/A';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para definir status inicial ANTES do INSERT
DROP TRIGGER IF EXISTS trigger_definir_status_inicial ON transferencia_pontos;

CREATE TRIGGER trigger_definir_status_inicial
  BEFORE INSERT ON transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION definir_status_inicial_transferencia();

COMMENT ON FUNCTION processar_transferencia_origem() IS 
'Debita pontos da origem imediatamente após INSERT de transferência';

COMMENT ON FUNCTION processar_transferencia_destino() IS 
'Credita pontos no destino apenas quando status = Concluído';

COMMENT ON FUNCTION verificar_e_atualizar_status_transferencias() IS 
'Job diário que verifica datas e atualiza status de transferências pendentes';

COMMENT ON FUNCTION definir_status_inicial_transferencia() IS 
'Define o status inicial da transferência baseado nas datas antes do INSERT';
