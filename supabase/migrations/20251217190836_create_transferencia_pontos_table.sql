/*
  # Create transferencia_pontos table

  1. New Tables
    - `transferencia_pontos`
      - `id` (uuid, primary key)
      - `parceiro_id` (uuid, foreign key to parceiros) - Pessoa que realiza a transferência
      - `data_transferencia` (date) - Data da transferência
      
      **Origem:**
      - `origem_programa_id` (uuid, foreign key to programas_fidelidade)
      - `origem_quantidade` (decimal) - Quantidade de pontos a transferir
      - `origem_paridade` (decimal) - Taxa de paridade (ex: 1:1, 1:2)
      - `realizar_compra_carrinho` (boolean) - Se vai realizar compra no carrinho
      - `realizar_retorno_bumerangue` (boolean) - Se vai realizar retorno de pontos
      
      **Compra no Carrinho (quando realizar_compra_carrinho = true):**
      - `compra_quantidade` (decimal) - Quantidade de pontos a comprar
      - `compra_valor_total` (decimal) - Valor total da compra
      - `compra_valor_milheiro` (decimal) - Valor por milheiro
      - `compra_forma_pagamento` (text) - Forma de pagamento
      - `compra_conta` (text) - Conta bancária usada
      - `compra_parcelas` (integer) - Número de parcelas
      
      **Retorno Bumerangue (quando realizar_retorno_bumerangue = true):**
      - `bumerangue_bonus_percentual` (decimal) - Percentual de bônus
      - `bumerangue_quantidade_bonus` (decimal) - Quantidade de bônus
      - `bumerangue_data_recebimento` (date) - Data de recebimento do bônus
      
      **Destino:**
      - `destino_programa_id` (uuid, foreign key to programas_fidelidade)
      - `destino_quantidade` (decimal) - Quantidade que será recebida no destino
      - `destino_data_recebimento` (date) - Data de recebimento das milhas
      - `destino_bonus_percentual` (decimal) - Percentual de bônus no destino
      - `destino_quantidade_bonus` (decimal) - Quantidade de bônus no destino
      - `destino_data_recebimento_bonus` (date) - Data de recebimento do bônus
      
      - `observacao` (text) - Observações
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to usuarios)

  2. Security
    - Enable RLS on transferencia_pontos table
    - Add policies for authenticated users to manage their transfers
*/

CREATE TABLE IF NOT EXISTS transferencia_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid REFERENCES parceiros(id) ON DELETE CASCADE NOT NULL,
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Origem
  origem_programa_id uuid REFERENCES programas_fidelidade(id) ON DELETE RESTRICT NOT NULL,
  origem_quantidade decimal(15, 2) NOT NULL DEFAULT 0,
  origem_paridade decimal(10, 2) DEFAULT 1,
  realizar_compra_carrinho boolean DEFAULT false,
  realizar_retorno_bumerangue boolean DEFAULT false,
  
  -- Compra no Carrinho
  compra_quantidade decimal(15, 2) DEFAULT 0,
  compra_valor_total decimal(15, 2) DEFAULT 0,
  compra_valor_milheiro decimal(10, 4) DEFAULT 0,
  compra_forma_pagamento text,
  compra_conta text,
  compra_parcelas integer DEFAULT 1,
  
  -- Retorno Bumerangue
  bumerangue_bonus_percentual decimal(5, 2) DEFAULT 0,
  bumerangue_quantidade_bonus decimal(15, 2) DEFAULT 0,
  bumerangue_data_recebimento date,
  
  -- Destino
  destino_programa_id uuid REFERENCES programas_fidelidade(id) ON DELETE RESTRICT NOT NULL,
  destino_quantidade decimal(15, 2) NOT NULL DEFAULT 0,
  destino_data_recebimento date NOT NULL,
  destino_bonus_percentual decimal(5, 2) DEFAULT 0,
  destino_quantidade_bonus decimal(15, 2) DEFAULT 0,
  destino_data_recebimento_bonus date,
  
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

ALTER TABLE transferencia_pontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all transferencia_pontos"
  ON transferencia_pontos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert transferencia_pontos"
  ON transferencia_pontos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update transferencia_pontos"
  ON transferencia_pontos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete transferencia_pontos"
  ON transferencia_pontos FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_transferencia_pontos_parceiro ON transferencia_pontos(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_pontos_origem_programa ON transferencia_pontos(origem_programa_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_pontos_destino_programa ON transferencia_pontos(destino_programa_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_pontos_data ON transferencia_pontos(data_transferencia);
