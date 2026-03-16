/*
  # Adicionar campo conta_bancaria_id à tabela compras

  1. Modificações
    - Adicionar coluna `conta_bancaria_id` na tabela `compras`
      - `conta_bancaria_id` (uuid) - Referência para contas_bancarias (Banco Emissor)
      - Opcional, usado quando forma_pagamento é "Pix"

  2. Relacionamentos
    - Criar foreign key para contas_bancarias
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'conta_bancaria_id'
  ) THEN
    ALTER TABLE compras ADD COLUMN conta_bancaria_id uuid REFERENCES contas_bancarias(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_compras_conta_bancaria ON compras(conta_bancaria_id);
  END IF;
END $$;
