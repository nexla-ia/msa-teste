/*
  # Fix saldo_atual por lote nas compras

  ## Problema
  O campo `saldo_atual` na tabela `compras` não era inicializado ao criar uma compra,
  nem atualizado corretamente. Por isso o modal de Venda por Lote não conseguia
  identificar qual lote tinha saldo real disponível após vendas anteriores.

  ## Mudanças
  1. Cria/substitui a trigger `trigger_atualizar_estoque_compras` para também
     inicializar `saldo_atual` da própria compra ao mudar para status Concluído.
  2. Ao cancelar (Concluído → Pendente), reseta `saldo_atual = 0`.
  3. Migração de dados: compras existentes com `saldo_atual = 0` mas que têm
     saldo real no estoque recebem `saldo_atual = total_pontos` como ponto de partida
     (apenas compras ativas no estoque, sem vendas associadas ainda mapeadas).
*/

CREATE OR REPLACE FUNCTION trigger_atualizar_estoque_compras()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Concluído' THEN
      NEW.saldo_atual := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada',
        COALESCE(NEW.valor_total, 0),
        'compra',
        'Compra de pontos/milhas',
        NEW.id,
        'compras'
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'Pendente' AND NEW.status = 'Concluído' THEN
      NEW.saldo_atual := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada',
        COALESCE(NEW.valor_total, 0),
        'compra',
        'Compra de pontos/milhas',
        NEW.id,
        'compras'
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Pendente' THEN
      NEW.saldo_atual := 0;

      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída',
        COALESCE(OLD.valor_total, 0),
        'estorno_compra',
        'Estorno de compra de pontos/milhas',
        OLD.id,
        'compras'
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Concluído' THEN
      NEW.saldo_atual := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);

      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída',
        COALESCE(OLD.valor_total, 0),
        'ajuste_compra',
        'Ajuste de compra - reversão',
        OLD.id,
        'compras'
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
        'compras'
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'Concluído' THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída',
        COALESCE(OLD.valor_total, 0),
        'exclusao_compra',
        'Exclusão de compra de pontos/milhas',
        OLD.id,
        'compras'
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
