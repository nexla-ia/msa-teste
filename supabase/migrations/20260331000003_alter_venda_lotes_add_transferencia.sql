/*
  # Alterar venda_lotes para suportar lotes de transferência

  compra_id era NOT NULL mas lotes de transferência não têm compra_id.
  Adiciona referencia_id + referencia_tipo para identificar qualquer lote.
*/

-- Tornar compra_id nullable
ALTER TABLE venda_lotes
  ALTER COLUMN compra_id DROP NOT NULL;

-- Adicionar campos de referência genérica
ALTER TABLE venda_lotes
  ADD COLUMN IF NOT EXISTS referencia_id uuid,
  ADD COLUMN IF NOT EXISTS referencia_tipo text,
  ADD COLUMN IF NOT EXISTS tipo_origem text;
