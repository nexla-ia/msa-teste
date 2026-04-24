/*
  # Fix: custo médio corrompido por edição de compras

  ## Problema
  Quando uma compra era editada (Concluído → Concluído), o trigger usava tipo
  'Saída' para desfazer os valores antigos. A função atualizar_estoque_pontos
  no branch Saída calcula:
    v_valor_movimentacao = p_quantidade × custo_medio_atual / 1000
  ...ignorando o p_valor_total original. Isso subtraía um valor errado de
  valor_total em estoque_pontos, corrompendo o custo médio.

  ## Solução
  1. Atualiza trigger_atualizar_estoque_compras() para usar UPDATE direto no
     passo de "undo" (subtrai os valores exatos, sem passar por
     atualizar_estoque_pontos que ignora p_valor_total no branch Saída).

  2. Recalcula valor_total e custo_medio em estoque_pontos para todas as linhas
     onde saldo_atual = total de pontos de compras (ou seja, não há saídas de
     estoque — seguro recalcular direto das compras).
*/

-- ============================================================
-- 1. Corrigir trigger_atualizar_estoque_compras()
--    undo via UPDATE direto, não via atualizar_estoque_pontos
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_atualizar_estoque_compras()
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
        SELECT saldo_atual, custo_medio
        INTO v_saldo_atual, v_custo_medio_atual
        FROM estoque_pontos
        WHERE parceiro_id = NEW.parceiro_id AND programa_id = NEW.programa_id;

        INSERT INTO estoque_movimentacoes (
          parceiro_id, programa_id, tipo, quantidade,
          saldo_anterior, saldo_posterior,
          custo_medio_anterior, custo_medio_posterior,
          valor_total, origem, observacao,
          referencia_id, referencia_tabela, data_operacao
        ) VALUES (
          NEW.parceiro_id, NEW.programa_id, 'entrada', NEW.pontos_milhas,
          v_saldo_atual, v_saldo_atual,
          v_custo_medio_atual, v_custo_medio_atual,
          COALESCE(NEW.valor_total, 0), 'compra', 'Compra no Carrinho',
          NEW.id, 'compras',
          COALESCE(NEW.data_entrada, CURRENT_DATE)
        );

        RETURN NEW;
      END IF;

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas',
        NEW.id, 'compras', NULL,
        COALESCE(NEW.data_entrada, CURRENT_DATE)
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'Pendente' AND NEW.status = 'Concluído' THEN
      IF NEW.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas',
        NEW.id, 'compras', NULL,
        COALESCE(NEW.data_entrada, CURRENT_DATE)
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Pendente' THEN
      IF OLD.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;

      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída', COALESCE(OLD.valor_total, 0),
        'estorno_compra', 'Estorno de compra de pontos/milhas',
        OLD.id, 'compras', NULL, CURRENT_DATE
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Concluído' AND (
      OLD.pontos_milhas IS DISTINCT FROM NEW.pontos_milhas OR
      OLD.bonus IS DISTINCT FROM NEW.bonus OR
      OLD.valor_total IS DISTINCT FROM NEW.valor_total OR
      OLD.parceiro_id IS DISTINCT FROM NEW.parceiro_id OR
      OLD.programa_id IS DISTINCT FROM NEW.programa_id
    ) THEN
      IF OLD.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;

      -- Undo (old): subtrai os valores EXATOS da compra antiga diretamente em
      -- estoque_pontos, sem chamar atualizar_estoque_pontos (cujo branch Saída
      -- usaria custo_medio × quantidade e ignoraria o valor real da compra).
      UPDATE estoque_pontos
      SET
        saldo_atual = saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        valor_total = valor_total - COALESCE(OLD.valor_total, 0),
        custo_medio = CASE
          WHEN (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0))) > 0
            THEN ((valor_total - COALESCE(OLD.valor_total, 0)) /
                  (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)))) * 1000
          ELSE 0
        END,
        updated_at = now()
      WHERE parceiro_id = OLD.parceiro_id AND programa_id = OLD.programa_id;

      -- Apply (new): adiciona os novos valores normalmente
      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas (atualizada)',
        NEW.id, 'compras', NULL,
        COALESCE(NEW.data_entrada, CURRENT_DATE)
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'Concluído' AND COALESCE(OLD.observacao, '') != 'Compra no Carrinho' THEN
      -- Subtrai os valores exatos da compra excluída diretamente em estoque_pontos
      UPDATE estoque_pontos
      SET
        saldo_atual = saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        valor_total = valor_total - COALESCE(OLD.valor_total, 0),
        custo_medio = CASE
          WHEN (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0))) > 0
            THEN ((valor_total - COALESCE(OLD.valor_total, 0)) /
                  (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)))) * 1000
          ELSE 0
        END,
        updated_at = now()
      WHERE parceiro_id = OLD.parceiro_id AND programa_id = OLD.programa_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- ============================================================
-- 2. Recalcular valor_total e custo_medio nos estoque_pontos
--    corrompidos por edições passadas de compras.
--
--    Condição de segurança: só atualiza linhas em que o saldo_atual
--    bate com a soma de pontos de TODAS as compras Concluídas do
--    mesmo parceiro+programa. Se saldo_atual != soma de compras,
--    há saídas (vendas/transferências) e não é seguro recalcular
--    somente a partir das compras.
-- ============================================================
WITH compras_totais AS (
  SELECT
    parceiro_id,
    programa_id,
    SUM(COALESCE(pontos_milhas, 0) + COALESCE(bonus, 0)) AS total_pontos,
    SUM(COALESCE(valor_total, 0))                         AS total_valor
  FROM compras
  WHERE status = 'Concluído'
    AND COALESCE(observacao, '') != 'Compra no Carrinho'
  GROUP BY parceiro_id, programa_id
)
UPDATE estoque_pontos ep
SET
  valor_total = ct.total_valor,
  custo_medio = CASE
    WHEN ep.saldo_atual > 0
      THEN (ct.total_valor / ep.saldo_atual) * 1000
    ELSE 0
  END,
  updated_at = now()
FROM compras_totais ct
WHERE ep.parceiro_id = ct.parceiro_id
  AND ep.programa_id = ct.programa_id
  -- Seguro recalcular apenas quando saldo = total de pontos comprados
  -- (nenhuma saída afetou o saldo)
  AND ABS(ep.saldo_atual - ct.total_pontos) < 1;
