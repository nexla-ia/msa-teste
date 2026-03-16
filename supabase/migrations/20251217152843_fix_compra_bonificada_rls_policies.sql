/*
  # Fix compra_bonificada RLS policies

  1. Changes
    - Drop existing RLS policies that use TO authenticated
    - Create new policies using TO public (for custom authentication)
    - Maintain same permissions structure

  2. Security
    - Users can view all records
    - Users can insert new records
    - Users can update existing records
    - Users can delete records
*/

DROP POLICY IF EXISTS "Users can view all compra_bonificada" ON compra_bonificada;
DROP POLICY IF EXISTS "Users can insert compra_bonificada" ON compra_bonificada;
DROP POLICY IF EXISTS "Users can update compra_bonificada" ON compra_bonificada;
DROP POLICY IF EXISTS "Users can delete compra_bonificada" ON compra_bonificada;

CREATE POLICY "Users can view all compra_bonificada"
  ON compra_bonificada FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert compra_bonificada"
  ON compra_bonificada FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update compra_bonificada"
  ON compra_bonificada FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete compra_bonificada"
  ON compra_bonificada FOR DELETE
  TO public
  USING (true);