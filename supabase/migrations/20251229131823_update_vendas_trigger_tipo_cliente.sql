/*
  # Atualizar Trigger de Vendas para Controlar Baixa de Estoque

  1. Modificações na função processar_venda
    - Cliente Final: baixa estoque imediatamente
    - Agência Convencional: baixa estoque imediatamente
    - Agência Grande: apenas reserva estoque (não baixa)

  2. Nova função: processar_emissao_massa
    - Processa planilha de emissões para agências grandes
    - Baixa estoque proporcional às emissões

  3. Notas
    - Estoque só é abatido quando necessário
    - Agências grandes têm estoque reservado até emissão
*/

-- Atualizar função para processar venda com tipo_cliente
CREATE OR REPLACE FUNCTION processar_venda()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo_atual numeric;
  v_custo_medio numeric;
BEGIN
  -- Buscar saldo atual e custo médio do estoque
  SELECT saldo_atual, custo_medio
  INTO v_saldo_atual, v_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.programa_id;

  -- Se não existir registro de estoque, criar com saldo 0
  IF NOT FOUND THEN
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
    VALUES (NEW.parceiro_id, NEW.programa_id, 0, 0);
    v_saldo_atual := 0;
    v_custo_medio := 0;
  END IF;

  -- Validar se há saldo suficiente
  IF v_saldo_atual < NEW.quantidade_milhas THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: %, Quantidade solicitada: %', 
      v_saldo_atual, NEW.quantidade_milhas;
  END IF;

  -- Registrar saldo anterior e custo médio na venda
  NEW.saldo_anterior := v_saldo_atual;
  NEW.custo_medio := v_custo_medio;

  -- Controlar baixa de estoque baseado no tipo de cliente
  IF NEW.tipo_cliente IN ('cliente_final', 'agencia_convencional') THEN
    -- Baixar do estoque imediatamente
    UPDATE estoque_pontos
    SET saldo_atual = saldo_atual - NEW.quantidade_milhas,
        updated_at = now()
    WHERE parceiro_id = NEW.parceiro_id
      AND programa_id = NEW.programa_id;
    
    NEW.estoque_reservado := false;
    NEW.quantidade_reservada := 0;
  ELSE
    -- Agência grande: apenas reservar estoque
    NEW.estoque_reservado := true;
    NEW.quantidade_reservada := NEW.quantidade_milhas;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para processar emissões em massa (agências grandes)
CREATE OR REPLACE FUNCTION processar_emissao_massa(
  p_venda_id uuid,
  p_quantidade_emitida numeric
)
RETURNS void AS $$
DECLARE
  v_venda RECORD;
  v_quantidade_reservada numeric;
BEGIN
  -- Buscar dados da venda
  SELECT v.*, v.quantidade_reservada
  INTO v_venda
  FROM vendas v
  WHERE v.id = p_venda_id
    AND v.tipo_cliente = 'agencia_grande'
    AND v.estoque_reservado = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada ou não é de agência grande';
  END IF;

  -- Validar se quantidade emitida não excede a reservada
  IF p_quantidade_emitida > v_venda.quantidade_reservada THEN
    RAISE EXCEPTION 'Quantidade emitida (%) excede quantidade reservada (%)', 
      p_quantidade_emitida, v_venda.quantidade_reservada;
  END IF;

  -- Baixar do estoque a quantidade emitida
  UPDATE estoque_pontos
  SET saldo_atual = saldo_atual - p_quantidade_emitida,
      updated_at = now()
  WHERE parceiro_id = v_venda.parceiro_id
    AND programa_id = v_venda.programa_id;

  -- Atualizar quantidade reservada na venda
  UPDATE vendas
  SET quantidade_reservada = quantidade_reservada - p_quantidade_emitida,
      estoque_reservado = CASE 
        WHEN (quantidade_reservada - p_quantidade_emitida) <= 0 THEN false 
        ELSE true 
      END,
      updated_at = now()
  WHERE id = p_venda_id;

END;
$$ LANGUAGE plpgsql;

-- Recriar trigger
DROP TRIGGER IF EXISTS processar_venda_trigger ON vendas;
CREATE TRIGGER processar_venda_trigger
  BEFORE INSERT ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION processar_venda();
