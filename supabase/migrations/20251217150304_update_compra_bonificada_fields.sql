/*
  # Update compra_bonificada table fields

  1. Changes
    - Rename cliente_id to parceiro_id
    - Update foreign key constraint
    - Change loja from text to uuid referencing lojas table
    - Add tipo_pontos_real field (Pontos or Moeda Real)

  2. Security
    - Maintain existing RLS policies
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compra_bonificada' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE compra_bonificada RENAME COLUMN cliente_id TO parceiro_id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compra_bonificada' AND column_name = 'loja_id'
  ) THEN
    ALTER TABLE compra_bonificada ADD COLUMN loja_id uuid REFERENCES lojas(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compra_bonificada' AND column_name = 'tipo_pontos_real'
  ) THEN
    ALTER TABLE compra_bonificada ADD COLUMN tipo_pontos_real text DEFAULT 'Pontos';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compra_bonificada_loja ON compra_bonificada(loja_id);