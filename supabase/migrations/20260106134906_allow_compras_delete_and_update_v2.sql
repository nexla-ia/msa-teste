/*
  # Permitir Exclusão e Edição de Compras

  ## Objetivo
  Reverter o bloqueio de exclusões e atualizações na tabela `compras`,
  permitindo que usuários autenticados possam editar e excluir registros.

  ## Alterações

  ### 1. Remover Triggers de Bloqueio
  - Remove trigger `block_compras_update`
  - Remove trigger `block_compras_delete`
  - Remove função `prevent_compras_modification` (com CASCADE)

  ### 2. Restaurar Políticas RLS
  - Adiciona política de DELETE para usuários autenticados
  - Adiciona política de UPDATE para usuários autenticados

  ## Nota
  Os triggers de atualização de estoque (`trigger_atualizar_estoque_compras_*`)
  continuam funcionando normalmente e garantem que o estoque seja atualizado
  corretamente quando compras forem modificadas ou excluídas.
*/

-- Remove a função de bloqueio com CASCADE (remove os triggers automaticamente)
DROP FUNCTION IF EXISTS prevent_compras_modification() CASCADE;

-- Restaura política de DELETE
CREATE POLICY "Authenticated users can delete compras"
  ON compras FOR DELETE
  TO authenticated
  USING (true);

-- Restaura política de UPDATE
CREATE POLICY "Authenticated users can update compras"
  ON compras FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);