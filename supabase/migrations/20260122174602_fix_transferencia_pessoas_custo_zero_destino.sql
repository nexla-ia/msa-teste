/*
  # Corrigir custo médio em transferências entre pessoas
  
  1. Problema
    - Quando um parceiro recebe pontos via transferência entre pessoas, o custo médio está sendo calculado
    - Isso está errado porque quem recebe não pagou nada pelos pontos
  
  2. Solução
    - Destino recebe os pontos com custo ZERO
    - Recalcular custo médio considerando pontos recebidos gratuitamente
    - Origem mantém seu custo médio inalterado
  
  3. Comportamento
    - Origem: perde pontos mas mantém custo médio
    - Destino: ganha pontos com custo zero, reduzindo o custo médio total
*/

-- Recriar função com custo zero para destino
CREATE OR REPLACE FUNCTION process_transferencia_pessoas()
RETURNS TRIGGER AS $$
DECLARE
  v_origem_estoque_id uuid;
  v_destino_estoque_id uuid;
  v_origem_saldo numeric;
  v_origem_custo_medio numeric;
  v_destino_saldo numeric;
  v_destino_custo_medio numeric;
  v_novo_saldo_destino numeric;
  v_novo_custo_medio numeric;
  v_programa_destino_id uuid;
BEGIN
  -- Determinar programa de destino (usar destino_programa_id se existir, senão usar programa_id)
  v_programa_destino_id := COALESCE(NEW.destino_programa_id, NEW.programa_id);

  -- Buscar estoque da origem
  SELECT id, saldo_atual, custo_medio INTO v_origem_estoque_id, v_origem_saldo, v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

  -- Validar se origem tem saldo suficiente
  IF v_origem_saldo IS NULL OR v_origem_saldo < NEW.quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no estoque de origem';
  END IF;

  -- Buscar ou criar estoque do destino
  SELECT id, saldo_atual, custo_medio INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.destino_parceiro_id AND programa_id = v_programa_destino_id;

  IF v_destino_estoque_id IS NULL THEN
    -- Criar estoque para o destino com custo zero
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
    VALUES (NEW.destino_parceiro_id, v_programa_destino_id, 0, 0)
    RETURNING id, saldo_atual, custo_medio INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio;
  END IF;

  -- Atualizar estoque de origem (diminuir)
  -- Mantém o custo médio inalterado
  UPDATE estoque_pontos
  SET saldo_atual = saldo_atual - NEW.quantidade,
      updated_at = now()
  WHERE id = v_origem_estoque_id;

  -- Calcular novo saldo e custo médio do destino
  v_novo_saldo_destino := v_destino_saldo + NEW.quantidade;
  
  -- Pontos recebidos gratuitamente têm custo ZERO
  -- Recalcular custo médio: (saldo_anterior * custo_anterior + quantidade_nova * 0) / saldo_novo
  IF v_novo_saldo_destino > 0 THEN
    v_novo_custo_medio := (v_destino_saldo * COALESCE(v_destino_custo_medio, 0)) / v_novo_saldo_destino;
  ELSE
    v_novo_custo_medio := 0;
  END IF;

  -- Atualizar estoque de destino (aumentar com custo zero)
  UPDATE estoque_pontos
  SET saldo_atual = v_novo_saldo_destino,
      custo_medio = v_novo_custo_medio,
      updated_at = now()
  WHERE id = v_destino_estoque_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_transferencia_pessoas() TO anon, authenticated;

COMMENT ON FUNCTION process_transferencia_pessoas() IS 
'Processa transferências entre pessoas. Pontos recebidos gratuitamente têm custo zero, reduzindo o custo médio do destino.';