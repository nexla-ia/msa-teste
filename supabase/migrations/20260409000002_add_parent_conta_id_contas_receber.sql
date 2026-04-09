/*
  # Adicionar parent_conta_id em contas_receber

  Permite rastrear qual conta originou um pagamento parcial,
  viabilizando agrupamento pai → filho na interface.
*/

ALTER TABLE contas_receber
  ADD COLUMN IF NOT EXISTS parent_conta_id uuid REFERENCES contas_receber(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_receber_parent ON contas_receber(parent_conta_id);
