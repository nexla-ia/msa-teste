/*
  # Adicionar campo cartao_id à tabela compras

  1. Modificações
    - Adicionar coluna `cartao_id` na tabela `compras`
      - `cartao_id` (uuid) - Referência para cartoes_credito
      - Opcional, usado quando forma_pagamento é "Cartão"

  2. Relacionamentos
    - Criar foreign key para cartoes_credito
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'cartao_id'
  ) THEN
    ALTER TABLE compras ADD COLUMN cartao_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_compras_cartao ON compras(cartao_id);
  END IF;
END $$;
