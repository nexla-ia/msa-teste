/*
  # Corrigir estoque removendo pontos de compras pendentes

  1. Problema
    - Compras com status Pendente já foram creditadas no estoque
    - Precisam ser removidas até que o status mude para Concluído
    
  2. Solução
    - Identificar compras pendentes
    - Remover seus pontos do estoque
    - Quando forem processadas (status = Concluído), os pontos voltam automaticamente
*/

DO $$
DECLARE
  compra_record RECORD;
BEGIN
  -- Para cada compra pendente, remover pontos do estoque
  FOR compra_record IN
    SELECT 
      id,
      parceiro_id,
      programa_id,
      pontos_milhas,
      bonus,
      valor_total,
      tipo,
      status
    FROM compras
    WHERE status = 'Pendente'
  LOOP
    -- Remover pontos do estoque
    PERFORM atualizar_estoque_pontos(
      compra_record.parceiro_id,
      compra_record.programa_id,
      -(COALESCE(compra_record.pontos_milhas, 0) + COALESCE(compra_record.bonus, 0)),
      compra_record.tipo,
      -COALESCE(compra_record.valor_total, 0)
    );
    
    RAISE NOTICE 'Removidos pontos da compra pendente: %', compra_record.id;
  END LOOP;
  
  RAISE NOTICE 'Correção de estoque concluída';
END $$;
