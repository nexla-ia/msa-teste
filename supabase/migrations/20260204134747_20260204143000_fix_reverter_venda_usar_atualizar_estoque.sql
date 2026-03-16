/*
  # Corrigir reversão de venda para usar atualizar_estoque_pontos()

  1. Problema
    - A função `reverter_venda()` estava fazendo UPDATE direto no estoque
    - Não devolvia o valor monetário ao estoque
    - Histórico de movimentações não era registrado

  2. Correção
    - Usar `atualizar_estoque_pontos()` para devolver pontos ao estoque
    - Devolver o valor (CMV) que foi baixado na venda original
    - Registrar movimentação de reversão no histórico

  3. Lógica
    - Ao cancelar venda: ENTRADA com valor = CMV da venda original
    - Isso restaura quantidade E valor ao estoque
    - Histórico mostra reversão claramente
*/

-- Corrigir função reverter_venda para usar atualizar_estoque_pontos
CREATE OR REPLACE FUNCTION reverter_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cmv_original numeric;
BEGIN
  -- Só reverter se o status mudou para 'cancelada'
  IF OLD.status != 'cancelada' AND NEW.status = 'cancelada' THEN
    
    -- Buscar CMV da venda (se não tiver, calcular)
    v_cmv_original := COALESCE(OLD.cmv, (OLD.quantidade_milhas * OLD.custo_medio / 1000));

    -- Devolver as milhas ao estoque usando atualizar_estoque_pontos
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.programa_id,
      OLD.quantidade_milhas,
      'Entrada',
      v_cmv_original, -- Devolver o valor que foi baixado
      'reversao_venda',
      'Reversão da venda #' || OLD.id::text,
      OLD.id,
      'vendas'
    );

    -- Cancelar todas as contas a receber relacionadas
    UPDATE contas_receber
    SET status_pagamento = 'cancelado',
        updated_at = now()
    WHERE venda_id = OLD.id
      AND status_pagamento = 'pendente';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION reverter_venda() IS 
'Reverte venda cancelada devolvendo pontos e valor ao estoque.
Usa atualizar_estoque_pontos() para manter integridade histórica.';
