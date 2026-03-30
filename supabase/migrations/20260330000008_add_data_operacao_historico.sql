/*
  # Adiciona data_operacao ao histórico de movimentações

  Permite que o histórico mostre a data real da operação (ex: compra feita no dia 27)
  em vez da data de inserção no banco (created_at).

  ## Mudanças
  1. Adiciona coluna `data_operacao` em `estoque_movimentacoes` (default = created_at)
  2. Atualiza `atualizar_estoque_pontos()` para aceitar `p_data_operacao` opcional
  3. Atualiza trigger de compras para passar `NEW.data_entrada`
  4. Atualiza triggers de transferência de pontos para passar `NEW.data_transferencia`
*/

-- ============================================================
-- 1. Adicionar coluna data_operacao à tabela
-- ============================================================
ALTER TABLE estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS data_operacao timestamptz DEFAULT now();

-- Preencher registros existentes com created_at
UPDATE estoque_movimentacoes
SET data_operacao = created_at
WHERE data_operacao IS NULL;

CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_data_operacao
  ON estoque_movimentacoes(data_operacao);

-- ============================================================
-- 2. Atualizar atualizar_estoque_pontos() com novo parâmetro
-- ============================================================
CREATE OR REPLACE FUNCTION atualizar_estoque_pontos(
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
  p_data_operacao     timestamptz DEFAULT NULL
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
    COALESCE(p_data_operacao, now())
  );
END;
$$;

-- ============================================================
-- 3. Trigger compras: passa data_entrada
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_compras_after_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_saldo_atual       decimal;
  v_custo_medio_atual decimal;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Concluído' THEN
      IF NEW.observacao = 'Compra no Carrinho' THEN
        SELECT saldo_atual, custo_medio INTO v_saldo_atual, v_custo_medio_atual
        FROM estoque_pontos
        WHERE parceiro_id = NEW.parceiro_id AND programa_id = NEW.programa_id;

        INSERT INTO estoque_movimentacoes (
          parceiro_id, programa_id, tipo, quantidade,
          saldo_anterior, saldo_posterior,
          custo_medio_anterior, custo_medio_posterior,
          valor_total, origem, observacao,
          referencia_id, referencia_tabela,
          data_operacao
        ) VALUES (
          NEW.parceiro_id, NEW.programa_id, 'entrada', NEW.pontos_milhas,
          v_saldo_atual, v_saldo_atual,
          v_custo_medio_atual, v_custo_medio_atual,
          COALESCE(NEW.valor_total, 0), 'compra', 'Compra no Carrinho',
          NEW.id, 'compras',
          COALESCE(NEW.data_entrada::timestamptz, now())
        );

        RETURN NEW;
      END IF;

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada',
        COALESCE(NEW.valor_total, 0),
        'compra',
        'Compra de pontos/milhas',
        NEW.id,
        'compras',
        NULL,
        COALESCE(NEW.data_entrada::timestamptz, now())
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'Pendente' AND NEW.status = 'Concluído' THEN
      IF NEW.observacao = 'Compra no Carrinho' THEN
        RETURN NEW;
      END IF;

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada',
        COALESCE(NEW.valor_total, 0),
        'compra',
        'Compra de pontos/milhas',
        NEW.id,
        'compras',
        NULL,
        COALESCE(NEW.data_entrada::timestamptz, now())
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Pendente' THEN
      IF OLD.observacao = 'Compra no Carrinho' THEN
        RETURN NEW;
      END IF;

      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída',
        COALESCE(OLD.valor_total, 0),
        'estorno_compra',
        'Estorno de compra de pontos/milhas',
        OLD.id,
        'compras',
        NULL,
        now()
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Concluído' AND (
      OLD.pontos_milhas <> NEW.pontos_milhas OR
      OLD.bonus <> NEW.bonus OR
      OLD.valor_total <> NEW.valor_total OR
      OLD.parceiro_id <> NEW.parceiro_id OR
      OLD.programa_id <> NEW.programa_id
    ) THEN
      IF OLD.observacao = 'Compra no Carrinho' THEN
        RETURN NEW;
      END IF;

      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída',
        COALESCE(OLD.valor_total, 0),
        'ajuste_compra',
        'Ajuste de compra - reversão',
        OLD.id,
        'compras',
        NULL,
        now()
      );

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada',
        COALESCE(NEW.valor_total, 0),
        'compra',
        'Compra de pontos/milhas (atualizada)',
        NEW.id,
        'compras',
        NULL,
        COALESCE(NEW.data_entrada::timestamptz, now())
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'Concluído' AND OLD.observacao != 'Compra no Carrinho' THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída',
        COALESCE(OLD.valor_total, 0),
        'exclusao_compra',
        'Exclusão de compra de pontos/milhas',
        OLD.id,
        'compras',
        NULL,
        now()
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- ============================================================
-- 4. Triggers de transferência de pontos: passa data_transferencia
-- ============================================================
CREATE OR REPLACE FUNCTION processar_transferencia_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destino_programa_nome text;
  v_qtd_estoque           decimal;
BEGIN
  SELECT nome INTO v_destino_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.destino_programa_id;

  IF NEW.realizar_compra_carrinho = true THEN
    v_qtd_estoque := COALESCE(NEW.origem_quantidade, 0) - COALESCE(NEW.compra_quantidade, 0);

    IF v_qtd_estoque <= 0 THEN
      RETURN NEW;
    END IF;

    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      v_qtd_estoque,
      'Saída',
      0,
      'Transferência de Pontos',
      'Transferência para ' || COALESCE(v_destino_programa_nome, 'destino'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_saida',
      COALESCE(NEW.data_transferencia::timestamptz, now())
    );

    RETURN NEW;
  END IF;

  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.origem_programa_id,
    NEW.origem_quantidade,
    'Saída',
    0,
    'Transferência de Pontos',
    'Transferência para ' || COALESCE(v_destino_programa_nome, 'destino'),
    NEW.id,
    'transferencia_pontos',
    'transferencia_saida',
    COALESCE(NEW.data_transferencia::timestamptz, now())
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION processar_transferencia_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_custo_medio   decimal;
  v_valor_destino        decimal;
  v_origem_programa_nome text;
  v_qtd_estoque          decimal;
BEGIN
  SELECT custo_medio INTO v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.origem_programa_id;

  SELECT nome INTO v_origem_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.origem_programa_id;

  IF NEW.realizar_compra_carrinho = true THEN
    v_qtd_estoque   := COALESCE(NEW.origem_quantidade, 0) - COALESCE(NEW.compra_quantidade, 0);
    v_valor_destino := (GREATEST(v_qtd_estoque, 0) / 1000.0) * COALESCE(v_origem_custo_medio, 0)
                       + COALESCE(NEW.compra_valor_total, 0);
  ELSE
    v_valor_destino := (NEW.destino_quantidade / 1000.0) * COALESCE(v_origem_custo_medio, 0);
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      v_valor_destino,
      'Transferência de Pontos',
      'Recebimento de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada',
      COALESCE(NEW.data_transferencia::timestamptz, now())
    );
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_bonus',
      COALESCE(NEW.data_transferencia::timestamptz, now())
    );
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus bumerangue',
      NEW.id,
      'transferencia_pontos',
      'bumerangue_retorno',
      COALESCE(NEW.data_transferencia::timestamptz, now())
    );
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      v_valor_destino,
      'Transferência de Pontos',
      'Recebimento de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada',
      COALESCE(NEW.data_transferencia::timestamptz, now())
    );
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_destino = 'Pendente' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_bonus',
      COALESCE(NEW.data_transferencia::timestamptz, now())
    );
  END IF;

  RETURN NEW;
END;
$$;
