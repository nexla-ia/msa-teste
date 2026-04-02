/*
  # Drop ALL overloads de atualizar_estoque_pontos e recriar versão única

  Usa pg_proc para encontrar e dropar TODAS as versões existentes,
  independente da assinatura exata, depois recria apenas a versão correta.
*/

-- Dropar TODAS as versões existentes de atualizar_estoque_pontos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid, pg_get_function_identity_arguments(oid) AS args
    FROM pg_proc
    WHERE proname = 'atualizar_estoque_pontos'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.atualizar_estoque_pontos(' || r.args || ') CASCADE';
  END LOOP;
END;
$$;

-- Recriar versão única e definitiva (11 parâmetros)
CREATE FUNCTION atualizar_estoque_pontos(
  p_parceiro_id       uuid,
  p_programa_id       uuid,
  p_quantidade        numeric,
  p_tipo              text,
  p_valor_total       numeric    DEFAULT 0,
  p_origem            text       DEFAULT NULL,
  p_observacao        text       DEFAULT NULL,
  p_referencia_id     uuid       DEFAULT NULL,
  p_referencia_tabela text       DEFAULT NULL,
  p_tipo_movimentacao text       DEFAULT NULL,
  p_data_operacao     date       DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_anterior        numeric;
  v_saldo_posterior       numeric;
  v_valor_anterior        numeric;
  v_valor_posterior       numeric;
  v_custo_medio_anterior  numeric;
  v_custo_medio_posterior numeric;
  v_tipo_movimentacao     text;
  v_valor_movimentacao    numeric;
BEGIN
  INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, valor_total, custo_medio)
  VALUES (p_parceiro_id, p_programa_id, 0, 0, 0)
  ON CONFLICT (parceiro_id, programa_id) DO NOTHING;

  SELECT saldo_atual, valor_total, custo_medio
  INTO v_saldo_anterior, v_valor_anterior, v_custo_medio_anterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  IF p_tipo = 'Entrada' OR p_tipo = 'Compra de Pontos/Milhas' THEN
    v_tipo_movimentacao  := COALESCE(p_tipo_movimentacao, 'entrada');
    v_valor_movimentacao := p_valor_total;

    v_saldo_posterior := v_saldo_anterior + p_quantidade;
    v_valor_posterior := v_valor_anterior + p_valor_total;

    IF v_saldo_posterior > 0 THEN
      v_custo_medio_posterior := (v_valor_posterior / v_saldo_posterior) * 1000;
    ELSE
      v_custo_medio_posterior := 0;
    END IF;

  ELSIF p_tipo = 'Saída' THEN
    v_tipo_movimentacao  := COALESCE(p_tipo_movimentacao, 'saida');
    v_valor_movimentacao := (p_quantidade * v_custo_medio_anterior / 1000);

    v_saldo_posterior := v_saldo_anterior - p_quantidade;
    v_valor_posterior := v_valor_anterior - v_valor_movimentacao;

    IF v_saldo_posterior < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para saída. Saldo atual: %, Quantidade solicitada: %, Origem: %',
        v_saldo_anterior, p_quantidade, COALESCE(p_origem, 'não informada');
    END IF;

    IF v_valor_posterior < 0 THEN
      v_valor_posterior := 0;
    END IF;

    IF v_saldo_posterior = 0 THEN
      v_custo_medio_posterior := 0;
      v_valor_posterior := 0;
    ELSE
      v_custo_medio_posterior := v_custo_medio_anterior;
    END IF;

  ELSE
    RAISE EXCEPTION 'Tipo inválido: %. Use "Entrada" ou "Saída"', p_tipo;
  END IF;

  UPDATE estoque_pontos
  SET
    saldo_atual = v_saldo_posterior,
    valor_total = v_valor_posterior,
    custo_medio = v_custo_medio_posterior,
    updated_at  = now()
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

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
    referencia_tabela,
    data_operacao
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
    p_referencia_tabela,
    COALESCE(p_data_operacao, CURRENT_DATE)
  );
END;
$$;
