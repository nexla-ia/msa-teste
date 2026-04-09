/*
  # Fix trigger_compras_after_estoque — undo via Entrada negativa

  ## Problema
  O trigger ativo na tabela compras chama trigger_compras_after_estoque(),
  não trigger_atualizar_estoque_compras() (que foi corrigida antes por engano).

  No branch UPDATE Concluído→Concluído, o passo de "undo" usava tipo 'Saída'.
  A função atualizar_estoque_pontos no branch Saída calcula:
    v_valor_movimentacao = p_quantidade × custo_medio_atual / 1000
  e ignora completamente o p_valor_total passado. Isso significa que o undo
  remove do valor_total um montante errado (baseado no custo médio atual,
  não no custo original da compra), corrompendo o custo médio no estoque.

  O mesmo problema existia no branch DELETE.

  ## Correção
  Trocar o undo de 'Saída' por 'Entrada' com quantidade e valor_total negativos.
  No branch Entrada, atualizar_estoque_pontos usa diretamente o p_valor_total,
  garantindo que o valor exato original seja subtraído.

  Também corrige condição de comparação de NULL: <> → IS DISTINCT FROM.
*/

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

      -- Undo (old): Entrada negativa — subtrai o valor exato da compra antiga
      -- (usar 'Saída' ignoraria p_valor_total e usaria custo_medio × quantidade,
      --  corrompendo o custo médio no estoque)
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        'Entrada', -COALESCE(OLD.valor_total, 0),
        'ajuste_compra', 'Ajuste de compra - reversão',
        OLD.id, 'compras', NULL, CURRENT_DATE
      );

      -- Apply (new): Entrada positiva — adiciona os novos valores
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
      -- Entrada negativa — subtrai o valor exato da compra excluída
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        'Entrada', -COALESCE(OLD.valor_total, 0),
        'exclusao_compra', 'Exclusão de compra de pontos/milhas',
        OLD.id, 'compras', NULL, CURRENT_DATE
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
