/*
  # Adicionar colunas faltantes em transferencia_pontos

  1. Colunas Adicionadas
    - `compra_custo_medio_final` (numeric) - Custo médio final da compra no carrinho
    - `compra_cartao_id` (uuid) - FK para cartoes_credito quando forma pagamento é crédito/débito
    - `compra_conta_bancaria_id` (uuid) - FK para contas_bancarias quando forma pagamento é PIX/transferência
    - `custo_transferencia` (numeric) - Custo da transferência de pontos
    - `forma_pagamento_transferencia` (text) - Forma de pagamento da transferência
    - `cartao_id` (uuid) - FK para cartoes_credito para pagamento da transferência
    - `conta_bancaria_id` (uuid) - FK para contas_bancarias para pagamento da transferência
  
  2. Foreign Keys
    - Adiciona FKs para cartoes_credito e contas_bancarias
*/

-- Adicionar colunas de compra no carrinho
ALTER TABLE transferencia_pontos
ADD COLUMN IF NOT EXISTS compra_custo_medio_final numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS compra_cartao_id uuid REFERENCES cartoes_credito(id),
ADD COLUMN IF NOT EXISTS compra_conta_bancaria_id uuid REFERENCES contas_bancarias(id);

-- Adicionar colunas de pagamento da transferência
ALTER TABLE transferencia_pontos
ADD COLUMN IF NOT EXISTS custo_transferencia numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS forma_pagamento_transferencia text,
ADD COLUMN IF NOT EXISTS cartao_id uuid REFERENCES cartoes_credito(id),
ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES contas_bancarias(id);
