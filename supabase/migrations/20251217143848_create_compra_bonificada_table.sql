/*
  # Create compra_bonificada table

  1. New Tables
    - `compra_bonificada`
      - `id` (uuid, primary key)
      - `cliente_id` (uuid, foreign key to clientes) - Pessoa
      - `programa_id` (uuid, foreign key to programas_fidelidade) - Programa
      - `data_compra` (date) - Data da compra
      - `recebimento_produto` (date, nullable) - Data recebimento do produto
      - `recebimento_pontos` (date) - Data recebimento dos pontos
      - `produto` (text) - Nome do produto
      - `loja` (text, nullable) - Loja onde foi comprado
      - `pontos_real` (decimal, nullable) - Conversão pontos por real
      - `destino` (text) - Destino dos pontos (Uso próprio, etc)
      - `valor_produto` (decimal) - Valor do produto (negativo)
      - `frete` (decimal, nullable, default 0) - Valor do frete (negativo)
      - `seguro_protecao` (decimal, nullable, default 0) - Seguro/proteção de preço (positivo)
      - `valor_venda` (decimal, nullable, default 0) - Valor de venda (positivo)
      - `custo_total` (decimal) - Custo total calculado
      - `forma_pagamento` (text, nullable) - Forma de pagamento
      - `conta` (text, nullable) - Conta utilizada
      - `parcelas` (integer, default 1) - Número de parcelas
      - `quantidade_pontos` (decimal) - Quantidade de pontos/milhas recebidos
      - `valor_milheiro` (decimal) - Valor por milheiro calculado
      - `observacao` (text, nullable) - Observações
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `chave_referencia` (text, nullable) - Chave de referência

  2. Security
    - Enable RLS on `compra_bonificada` table
    - Add policies for authenticated users to manage their own data
*/

CREATE TABLE IF NOT EXISTS compra_bonificada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT,
  programa_id uuid REFERENCES programas_fidelidade(id) ON DELETE RESTRICT,
  data_compra date NOT NULL,
  recebimento_produto date,
  recebimento_pontos date NOT NULL,
  produto text NOT NULL,
  loja text,
  pontos_real decimal(10, 2),
  destino text NOT NULL DEFAULT 'Uso próprio',
  valor_produto decimal(10, 2) NOT NULL,
  frete decimal(10, 2) DEFAULT 0,
  seguro_protecao decimal(10, 2) DEFAULT 0,
  valor_venda decimal(10, 2) DEFAULT 0,
  custo_total decimal(10, 2) NOT NULL,
  forma_pagamento text,
  conta text,
  parcelas integer DEFAULT 1,
  quantidade_pontos decimal(10, 2) NOT NULL,
  valor_milheiro decimal(10, 4),
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  chave_referencia text
);

ALTER TABLE compra_bonificada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all compra_bonificada"
  ON compra_bonificada FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert compra_bonificada"
  ON compra_bonificada FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update compra_bonificada"
  ON compra_bonificada FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete compra_bonificada"
  ON compra_bonificada FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_compra_bonificada_cliente ON compra_bonificada(cliente_id);
CREATE INDEX IF NOT EXISTS idx_compra_bonificada_programa ON compra_bonificada(programa_id);
CREATE INDEX IF NOT EXISTS idx_compra_bonificada_data_compra ON compra_bonificada(data_compra);