/*
  # Add cartao_id and conta_bancaria_id to compra_bonificada
  
  1. Changes
    - Add `cartao_id` (uuid, foreign key to cartoes_credito) - Cartão usado no pagamento
    - Add `conta_bancaria_id` (uuid, foreign key to contas_bancarias) - Conta bancária usada no pagamento
    
  2. Notes
    - These fields are optional and only used when relevant to the payment method
    - cartao_id is used when forma_pagamento is "Débito" or "Crédito"
    - conta_bancaria_id is used when forma_pagamento is "Transferência", "PIX", etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compra_bonificada' AND column_name = 'cartao_id'
  ) THEN
    ALTER TABLE compra_bonificada ADD COLUMN cartao_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compra_bonificada' AND column_name = 'conta_bancaria_id'
  ) THEN
    ALTER TABLE compra_bonificada ADD COLUMN conta_bancaria_id uuid REFERENCES contas_bancarias(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compra_bonificada_cartao ON compra_bonificada(cartao_id);
CREATE INDEX IF NOT EXISTS idx_compra_bonificada_conta_bancaria ON compra_bonificada(conta_bancaria_id);
