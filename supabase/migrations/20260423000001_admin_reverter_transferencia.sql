/*
  # Fix admin delete de transferencia_pontos

  ## Problema
  1. set_admin_mode() usa set_config(..., true) que é transaction-local.
     O próximo rpc (reverter_transferencia_pontos) roda em transação separada
     e não enxerga o admin mode → o bypass não funciona.
  2. atualizar_estoque_pontos não respeita app.is_admin mesmo se setado.

  ## Solução
  1. Patch em atualizar_estoque_pontos: se app.is_admin = 'true', permite
     saldo negativo (clampado em 0) em vez de lançar exceção.
  2. Nova função admin_reverter_transferencia_pontos(transfer_id, usuario_id):
     seta app.is_admin e chama o reverter na MESMA transação.
*/

-- ── 1. Patch em atualizar_estoque_pontos ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_estoque_pontos(
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
  v_is_admin              text := 'false';
BEGIN
  BEGIN
    v_is_admin := current_setting('app.is_admin', true);
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := 'false';
  END;

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
      -- Admin bypass: permite reversão mesmo sem saldo suficiente
      IF v_is_admin = 'true' THEN
        v_saldo_posterior := 0;
        v_valor_posterior := 0;
      ELSE
        RAISE EXCEPTION 'Saldo insuficiente para saída. Saldo atual: %, Quantidade solicitada: %, Origem: %',
          v_saldo_anterior, p_quantidade, COALESCE(p_origem, 'não informada');
      END IF;
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
    parceiro_id, programa_id, tipo, quantidade, valor_total,
    saldo_anterior, saldo_posterior, custo_medio_anterior, custo_medio_posterior,
    origem, observacao, referencia_id, referencia_tabela, data_operacao
  ) VALUES (
    p_parceiro_id, p_programa_id, v_tipo_movimentacao, p_quantidade, v_valor_movimentacao,
    v_saldo_anterior, v_saldo_posterior, v_custo_medio_anterior, v_custo_medio_posterior,
    p_origem, p_observacao, p_referencia_id, p_referencia_tabela,
    COALESCE(p_data_operacao, CURRENT_DATE)
  );
END;
$$;

-- ── 2. Wrapper admin para reverter transferência ──────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reverter_transferencia_pontos(
  p_transfer_id uuid,
  p_usuario_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nivel_acesso text;
  v_result       jsonb;
BEGIN
  SELECT nivel_acesso INTO v_nivel_acesso
  FROM usuarios WHERE id = p_usuario_id;

  IF v_nivel_acesso IS NULL OR v_nivel_acesso != 'ADM' THEN
    RAISE EXCEPTION 'Apenas administradores podem usar esta função.';
  END IF;

  -- set_config com local=true: válido por toda esta transação
  PERFORM set_config('app.is_admin', 'true', true);

  v_result := reverter_transferencia_pontos(p_transfer_id);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_reverter_transferencia_pontos(uuid, uuid) IS
'Reverte transferência de pontos como administrador.
set_config e reverter_transferencia_pontos ocorrem na mesma transação,
garantindo que o bypass de saldo funcione corretamente.';
