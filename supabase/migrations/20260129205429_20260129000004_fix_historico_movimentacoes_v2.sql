/*
  # Corrigir histórico de movimentações

  1. Descrição
    - Remove todas as versões antigas da função atualizar_estoque_pontos
    - Cria versão única e definitiva da função
    - Garante que valor_total está sendo registrado corretamente

  2. Mudanças
    - DROP de todas as versões antigas
    - Criação da função com assinatura completa
*/

-- Remover TODAS as versões da função primeiro
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text);
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text, numeric);
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text, numeric, text);
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text, numeric, text, text);
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text, numeric, text, text, uuid);
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text, numeric, text, text, uuid, text);

-- Criar versão única e definitiva
CREATE FUNCTION atualizar_estoque_pontos(
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
  v_custo_medio_anterior numeric;
  v_custo_medio_posterior numeric;
  v_custo_total_acumulado numeric;
  v_tipo_movimentacao text;
BEGIN
  -- Criar registro no estoque se não existir
  INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
  VALUES (p_parceiro_id, p_programa_id, 0, 0)
  ON CONFLICT (parceiro_id, programa_id) DO NOTHING;

  -- Obter saldo e custo médio atuais
  SELECT saldo_atual, custo_medio
  INTO v_saldo_anterior, v_custo_medio_anterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Determinar tipo de movimentação
  IF p_tipo = 'Entrada' OR p_tipo = 'Compra de Pontos/Milhas' THEN
    v_tipo_movimentacao := 'entrada';

    -- Calcular novo custo médio ponderado
    v_custo_total_acumulado := (v_saldo_anterior * v_custo_medio_anterior / 1000) + p_valor_total;
    v_saldo_posterior := v_saldo_anterior + p_quantidade;

    IF v_saldo_posterior > 0 THEN
      v_custo_medio_posterior := (v_custo_total_acumulado / v_saldo_posterior) * 1000;
    ELSE
      v_custo_medio_posterior := 0;
    END IF;

  ELSIF p_tipo = 'Saída' THEN
    v_tipo_movimentacao := 'saida';

    v_saldo_posterior := v_saldo_anterior - p_quantidade;

    IF v_saldo_posterior < 0 THEN
      v_saldo_posterior := 0;
    END IF;

    IF v_saldo_posterior = 0 THEN
      v_custo_medio_posterior := 0;
    ELSE
      v_custo_medio_posterior := v_custo_medio_anterior;
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo inválido: %. Use "Entrada" ou "Saída"', p_tipo;
  END IF;

  -- Atualizar saldo no estoque
  UPDATE estoque_pontos
  SET 
    saldo_atual = v_saldo_posterior,
    custo_medio = v_custo_medio_posterior,
    updated_at = now()
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- OBRIGATÓRIO: Registrar movimentação no histórico com valor_total
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
    p_valor_total,
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
'Atualiza estoque de pontos e registra movimentação no histórico. Calcula custo médio ponderado para entradas e mantém para saídas. SEMPRE registra valor_total quando informado.';
