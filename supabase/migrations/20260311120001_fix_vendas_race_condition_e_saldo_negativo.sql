/*
  # Fix: Race condition em processar_venda + saldo negativo silenciado

  ## Problema 1: Race condition em processar_venda
  - A função lê o saldo sem bloquear a linha (sem SELECT FOR UPDATE)
  - Duas vendas simultâneas podem ambas ler o mesmo saldo e ambas passarem na validação
  - O segundo UPDATE subtrai do saldo já reduzido pelo primeiro, mas a validação passou
    com o valor original, podendo causar saldo negativo

  ## Solução 1
  - Adicionar FOR UPDATE na leitura do estoque em processar_venda
  - Isso garante que apenas uma transação processe por vez o mesmo estoque

  ## Problema 2: Saldo negativo silenciado em atualizar_estoque_pontos
  - Quando saldo_posterior < 0, a função zera silenciosamente ao invés de lançar erro
  - Isso permite que operações inválidas sejam registradas sem aviso
  - O histórico mostra uma saída que não ocorreu de fato

  ## Solução 2
  - RAISE EXCEPTION quando saldo_posterior < 0
  - Todos os callers já validam saldo antes de chamar (race condition aside),
    mas a função em si deve ser a última linha de defesa
*/

-- =====================================================
-- Fix 1: processar_venda com SELECT FOR UPDATE
-- =====================================================
CREATE OR REPLACE FUNCTION processar_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo_atual numeric;
  v_custo_medio numeric;
  v_cmv numeric;
BEGIN
  -- FIX: SELECT FOR UPDATE garante exclusividade — sem race condition
  SELECT saldo_atual, custo_medio
  INTO v_saldo_atual, v_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.programa_id
  FOR UPDATE;

  -- Se não existir registro de estoque, criar com saldo 0
  IF NOT FOUND THEN
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, valor_total, custo_medio)
    VALUES (NEW.parceiro_id, NEW.programa_id, 0, 0, 0);
    v_saldo_atual := 0;
    v_custo_medio := 0;
  END IF;

  -- Validar se há saldo suficiente
  IF v_saldo_atual < NEW.quantidade_milhas THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: %, Quantidade solicitada: %',
      v_saldo_atual, NEW.quantidade_milhas;
  END IF;

  -- Calcular CMV (Custo da Mercadoria Vendida)
  v_cmv := (NEW.quantidade_milhas * v_custo_medio / 1000);

  -- Registrar saldo anterior, custo médio e CMV na venda
  NEW.saldo_anterior := v_saldo_atual;
  NEW.custo_medio := v_custo_medio;
  NEW.cmv := v_cmv;

  -- Controlar baixa de estoque baseado no tipo de cliente
  IF NEW.tipo_cliente IN ('cliente_final', 'agencia_convencional') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      NEW.quantidade_milhas,
      'Saída',
      0,
      'venda',
      'Venda #' || NEW.id::text,
      NEW.id,
      'vendas'
    );

    NEW.estoque_reservado := false;
    NEW.quantidade_reservada := 0;
  ELSE
    -- Agência grande: apenas reservar estoque (não baixa ainda)
    NEW.estoque_reservado := true;
    NEW.quantidade_reservada := NEW.quantidade_milhas;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_venda() IS
'Processa venda calculando CMV e atualizando estoque.
Usa SELECT FOR UPDATE para evitar race condition em vendas simultâneas.
Cliente final/Convencional: baixa imediata do estoque.
Agência grande: apenas reserva (baixa posterior).';

-- =====================================================
-- Fix 2: atualizar_estoque_pontos — RAISE EXCEPTION em saldo negativo
-- =====================================================
CREATE OR REPLACE FUNCTION atualizar_estoque_pontos(
  p_parceiro_id uuid,
  p_programa_id uuid,
  p_quantidade numeric,
  p_tipo text,
  p_valor_total numeric DEFAULT 0,
  p_origem text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_referencia_id uuid DEFAULT NULL,
  p_referencia_tabela text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_anterior numeric;
  v_saldo_posterior numeric;
  v_valor_anterior numeric;
  v_valor_posterior numeric;
  v_custo_medio_anterior numeric;
  v_custo_medio_posterior numeric;
  v_tipo_movimentacao text;
  v_valor_movimentacao numeric;
BEGIN
  -- Criar registro no estoque se não existir
  INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, valor_total, custo_medio)
  VALUES (p_parceiro_id, p_programa_id, 0, 0, 0)
  ON CONFLICT (parceiro_id, programa_id) DO NOTHING;

  -- Obter estado atual do estoque
  SELECT saldo_atual, valor_total, custo_medio
  INTO v_saldo_anterior, v_valor_anterior, v_custo_medio_anterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Processar ENTRADA
  IF p_tipo = 'Entrada' OR p_tipo = 'Compra de Pontos/Milhas' THEN
    v_tipo_movimentacao := 'entrada';
    v_valor_movimentacao := p_valor_total;

    v_saldo_posterior := v_saldo_anterior + p_quantidade;
    v_valor_posterior := v_valor_anterior + p_valor_total;

    -- Recalcular custo médio ponderado
    IF v_saldo_posterior > 0 THEN
      v_custo_medio_posterior := (v_valor_posterior / v_saldo_posterior) * 1000;
    ELSE
      v_custo_medio_posterior := 0;
    END IF;

  -- Processar SAÍDA
  ELSIF p_tipo = 'Saída' THEN
    v_tipo_movimentacao := 'saida';

    -- Calcular valor da saída usando custo médio VIGENTE
    v_valor_movimentacao := (p_quantidade * v_custo_medio_anterior / 1000);

    v_saldo_posterior := v_saldo_anterior - p_quantidade;
    v_valor_posterior := v_valor_anterior - v_valor_movimentacao;

    -- FIX: RAISE EXCEPTION em saldo negativo ao invés de silenciar
    IF v_saldo_posterior < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para saída. Saldo atual: %, Quantidade solicitada: %, Origem: %',
        v_saldo_anterior, p_quantidade, COALESCE(p_origem, 'não informada');
    END IF;

    IF v_valor_posterior < 0 THEN
      v_valor_posterior := 0;
    END IF;

    -- Custo médio MANTÉM (não recalcula na saída)
    IF v_saldo_posterior = 0 THEN
      v_custo_medio_posterior := 0;
      v_valor_posterior := 0;
    ELSE
      v_custo_medio_posterior := v_custo_medio_anterior;
    END IF;

  ELSE
    RAISE EXCEPTION 'Tipo inválido: %. Use "Entrada" ou "Saída"', p_tipo;
  END IF;

  -- Atualizar estoque com novos valores
  UPDATE estoque_pontos
  SET
    saldo_atual = v_saldo_posterior,
    valor_total = v_valor_posterior,
    custo_medio = v_custo_medio_posterior,
    updated_at = now()
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Registrar movimentação no histórico (IMUTÁVEL)
  INSERT INTO estoque_movimentacoes (
    parceiro_id,
    programa_id,
    tipo,
    quantidade,
    valor_total,
    saldo_anterior,
    saldo_posterior,
    custo_medio_anterior,
    custo_medio_posterior,
    origem,
    observacao,
    referencia_id,
    referencia_tabela
  ) VALUES (
    p_parceiro_id,
    p_programa_id,
    v_tipo_movimentacao,
    p_quantidade,
    v_valor_movimentacao,
    v_saldo_anterior,
    v_saldo_posterior,
    v_custo_medio_anterior,
    v_custo_medio_posterior,
    p_origem,
    p_observacao,
    p_referencia_id,
    p_referencia_tabela
  );
END;
$$;

COMMENT ON FUNCTION atualizar_estoque_pontos IS
'Atualiza estoque com custo médio ponderado.
ENTRADA: recalcula custo médio.
SAÍDA: mantém custo médio, subtrai valor calculado (qtd × custo), RAISE EXCEPTION se saldo insuficiente.
Nunca silencia saldo negativo — callers devem validar saldo antes de chamar.';
