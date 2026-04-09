/*
  # Fix trigger_compras_after_estoque — undo via UPDATE direto em estoque_pontos

  ## Problema
  A abordagem anterior usava 'Entrada' com quantidade negativa para desfazer
  a compra antiga, mas estoque_movimentacoes tem CHECK constraint que exige
  quantidade >= 0, causando erro ao editar ou excluir compras.

  ## Correção
  O passo de "undo" agora faz UPDATE direto em estoque_pontos, subtraindo
  os valores exatos da compra antiga sem passar por atualizar_estoque_pontos.
  O passo de "apply" continua usando atualizar_estoque_pontos normalmente.
*/

CREATE OR REPLACE FUNCTION public.trigger_compras_after_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_saldo_atual       decimal;
  v_custo_medio_atual decimal;
  v_novo_saldo        decimal;
  v_novo_valor_total  decimal;
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

      -- Undo (old): subtrai os valores exatos da compra antiga diretamente em estoque_pontos
      -- Não usa atualizar_estoque_pontos para evitar o CHECK constraint de quantidade >= 0
      UPDATE estoque_pontos
      SET
        saldo_atual  = saldo_atual  - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        valor_total  = valor_total  - COALESCE(OLD.valor_total, 0),
        custo_medio  = CASE
          WHEN (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0))) > 0
            THEN ((valor_total - COALESCE(OLD.valor_total, 0)) /
                  (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)))) * 1000
          ELSE 0
        END,
        updated_at   = now()
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
        saldo_atual  = saldo_atual  - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        valor_total  = valor_total  - COALESCE(OLD.valor_total, 0),
        custo_medio  = CASE
          WHEN (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0))) > 0
            THEN ((valor_total - COALESCE(OLD.valor_total, 0)) /
                  (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)))) * 1000
          ELSE 0
        END,
        updated_at   = now()
      WHERE parceiro_id = OLD.parceiro_id AND programa_id = OLD.programa_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
