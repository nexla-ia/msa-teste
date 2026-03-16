/*
  # Create Compras (Entradas) Table

  1. New Tables
    - `compras`
      - `id` (uuid, primary key)
      - `parceiro_id` (uuid, foreign key to parceiros)
      - `programa_id` (uuid, foreign key to programas)
      - `tipo` (text) - Tipo de entrada: Compra de Pontos/Milhas, Recebimento de Bônus, etc.
      - `data_entrada` (date) - Data da entrada
      - `pontos_milhas` (numeric) - Quantidade de pontos/milhas
      - `valor_total` (numeric) - Valor total da transação
      - `valor_milheiro` (numeric) - Valor por milheiro
      - `tipo_valor` (text) - VT (Valor Total) ou VM (Valor Milheiro)
      - `saldo_atual` (numeric) - Saldo atual após a transação
      - `custo_medio` (numeric) - Custo médio
      - `observacao` (text) - Observações
      - `agendar_entrada` (boolean) - Se é agendamento
      - `agendamento_recorrente` (boolean) - Se tem recorrência
      - `periodicidade` (text) - Semanal, Quinzenal, Mensal, etc.
      - `quantidade_recorrencia` (integer) - Quantidade de recorrências
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - ID do usuário que criou

  2. Security
    - Enable RLS on `compras` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid REFERENCES parceiros(id) ON DELETE CASCADE,
  programa_id uuid REFERENCES programas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'Compra de Pontos/Milhas',
    'Recebimento de Bônus',
    'Assinatura de Clube',
    'Pontos do Cartão de Crédito',
    'Ajuste de Saldo'
  )),
  data_entrada date NOT NULL DEFAULT CURRENT_DATE,
  pontos_milhas numeric(15,2) NOT NULL DEFAULT 0,
  valor_total numeric(15,2) DEFAULT 0,
  valor_milheiro numeric(15,2) DEFAULT 0,
  tipo_valor text CHECK (tipo_valor IN ('VT', 'VM')),
  saldo_atual numeric(15,2) DEFAULT 0,
  custo_medio numeric(15,2) DEFAULT 0,
  observacao text,
  agendar_entrada boolean DEFAULT false,
  agendamento_recorrente boolean DEFAULT false,
  periodicidade text CHECK (periodicidade IN (
    'Semanal',
    'Quinzenal',
    'Mensal',
    'Bimestral',
    'Trimestral',
    'Semestral',
    'Anual'
  )),
  quantidade_recorrencia integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all compras"
  ON compras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert compras"
  ON compras
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update compras"
  ON compras
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete compras"
  ON compras
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_compras_parceiro ON compras(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_compras_programa ON compras(programa_id);
CREATE INDEX IF NOT EXISTS idx_compras_data_entrada ON compras(data_entrada);
CREATE INDEX IF NOT EXISTS idx_compras_created_at ON compras(created_at);
