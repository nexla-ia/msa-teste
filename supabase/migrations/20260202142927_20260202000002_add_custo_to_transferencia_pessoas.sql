/*
  # Adicionar campos de custo em transferencia_pessoas

  1. New Columns
    - tem_custo (boolean) - indica se a transferência tem custo financeiro
    - valor_custo (numeric) - valor do custo da transferência
    - forma_pagamento_id (uuid) - referência à forma de pagamento utilizada

  2. Logic
    - Se tem_custo = true, o valor_custo é adicionado ao custo médio de quem recebe
    - O custo é pago pela origem e recebido pelo destino
*/

-- Adicionar campos de custo
ALTER TABLE transferencia_pessoas
  ADD COLUMN IF NOT EXISTS tem_custo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_custo numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid REFERENCES formas_pagamento(id);

-- Constraint: se tem_custo = true, valor_custo deve ser > 0
ALTER TABLE transferencia_pessoas
  DROP CONSTRAINT IF EXISTS check_custo_valido;

ALTER TABLE transferencia_pessoas
  ADD CONSTRAINT check_custo_valido 
  CHECK (
    (tem_custo = false AND (valor_custo IS NULL OR valor_custo = 0)) OR
    (tem_custo = true AND valor_custo > 0)
  );