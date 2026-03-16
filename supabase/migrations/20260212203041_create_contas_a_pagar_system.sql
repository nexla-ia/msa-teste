/*
  # Sistema de Contas a Pagar

  ## Descrição
  Cria o sistema completo de contas a pagar para controlar todas as despesas do sistema.

  ## 1. Nova Tabela
    - `contas_a_pagar`
      - `id` (uuid, PK)
      - `origem_tipo` (text) - Tipo da operação: 'compra', 'compra_bonificada', 'clube', 'transferencia_pontos', 'ajuste'
      - `origem_id` (uuid) - ID do registro de origem
      - `parceiro_id` (uuid, FK) - Parceiro relacionado (quando aplicável)
      - `programa_id` (uuid, FK) - Programa relacionado (quando aplicável)
      - `descricao` (text) - Descrição do pagamento
      - `data_vencimento` (date) - Data de vencimento
      - `valor_parcela` (numeric) - Valor da parcela
      - `numero_parcela` (integer) - Número da parcela (1, 2, 3...)
      - `total_parcelas` (integer) - Total de parcelas
      - `forma_pagamento` (text) - Forma de pagamento
      - `cartao_id` (uuid, FK) - Cartão usado
      - `conta_bancaria_id` (uuid, FK) - Conta bancária usada
      - `status_pagamento` (text) - 'pendente', 'pago', 'atrasado', 'cancelado'
      - `data_pagamento` (date) - Data efetiva do pagamento
      - `valor_pago` (numeric) - Valor efetivamente pago
      - `observacao` (text)
      - `created_by` (uuid, FK → usuarios)
      - `created_at`, `updated_at` (timestamptz)

  ## 2. Security
    - Enable RLS on `contas_a_pagar` table
    - Add policies for authenticated users

  ## 3. Indexes
    - Index on origem_tipo and origem_id for lookups
    - Index on data_vencimento for filtering
    - Index on status_pagamento for filtering
    - Index on cartao_id for card statements
*/

-- Criar tabela contas_a_pagar
CREATE TABLE IF NOT EXISTS contas_a_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('compra', 'compra_bonificada', 'clube', 'transferencia_pontos', 'ajuste', 'outro')),
  origem_id uuid,
  parceiro_id uuid REFERENCES parceiros(id) ON DELETE SET NULL,
  programa_id uuid REFERENCES programas_fidelidade(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  data_vencimento date NOT NULL,
  valor_parcela numeric(15, 2) NOT NULL CHECK (valor_parcela >= 0),
  numero_parcela integer NOT NULL DEFAULT 1 CHECK (numero_parcela > 0),
  total_parcelas integer NOT NULL DEFAULT 1 CHECK (total_parcelas > 0),
  forma_pagamento text,
  cartao_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  status_pagamento text NOT NULL DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  data_pagamento date,
  valor_pago numeric(15, 2),
  observacao text,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (numero_parcela <= total_parcelas),
  CHECK (status_pagamento != 'pago' OR (data_pagamento IS NOT NULL AND valor_pago IS NOT NULL))
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_origem ON contas_a_pagar(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_vencimento ON contas_a_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_status ON contas_a_pagar(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_cartao ON contas_a_pagar(cartao_id) WHERE cartao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_conta ON contas_a_pagar(conta_bancaria_id) WHERE conta_bancaria_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_parceiro ON contas_a_pagar(parceiro_id) WHERE parceiro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_programa ON contas_a_pagar(programa_id) WHERE programa_id IS NOT NULL;

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_contas_a_pagar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS set_contas_a_pagar_updated_at ON contas_a_pagar;
CREATE TRIGGER set_contas_a_pagar_updated_at
  BEFORE UPDATE ON contas_a_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_a_pagar_updated_at();

-- Habilitar RLS
ALTER TABLE contas_a_pagar ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view contas a pagar"
  ON contas_a_pagar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert contas a pagar"
  ON contas_a_pagar FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update contas a pagar"
  ON contas_a_pagar FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete contas a pagar"
  ON contas_a_pagar FOR DELETE
  TO authenticated
  USING (true);

-- Função para verificar e atualizar status de contas atrasadas
CREATE OR REPLACE FUNCTION verificar_contas_atrasadas()
RETURNS void AS $$
BEGIN
  UPDATE contas_a_pagar
  SET status_pagamento = 'atrasado'
  WHERE status_pagamento = 'pendente'
    AND data_vencimento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários na tabela
COMMENT ON TABLE contas_a_pagar IS 'Registro de todas as contas a pagar do sistema';
COMMENT ON COLUMN contas_a_pagar.origem_tipo IS 'Tipo da operação que gerou a conta: compra, compra_bonificada, clube, transferencia_pontos, ajuste, outro';
COMMENT ON COLUMN contas_a_pagar.origem_id IS 'ID do registro de origem (compra_id, programa_clube_id, etc)';
COMMENT ON COLUMN contas_a_pagar.status_pagamento IS 'Status: pendente, pago, atrasado, cancelado';
COMMENT ON COLUMN contas_a_pagar.numero_parcela IS 'Número desta parcela (1, 2, 3...)';
COMMENT ON COLUMN contas_a_pagar.total_parcelas IS 'Total de parcelas da operação';