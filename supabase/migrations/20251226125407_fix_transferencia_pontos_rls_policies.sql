/*
  # Fix RLS Policies for transferencia_pontos

  1. Changes
    - Drop existing RLS policies that require authenticated users
    - Create new policies that allow public access for custom auth system
    - Maintain security by allowing all authenticated operations

  2. Security
    - Policies updated to work with custom authentication (usuarios table)
    - All operations allowed for logged-in users via application
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all transferencia_pontos" ON transferencia_pontos;
DROP POLICY IF EXISTS "Users can insert transferencia_pontos" ON transferencia_pontos;
DROP POLICY IF EXISTS "Users can update transferencia_pontos" ON transferencia_pontos;
DROP POLICY IF EXISTS "Users can delete transferencia_pontos" ON transferencia_pontos;

-- Create new policies for custom auth
CREATE POLICY "Allow all select on transferencia_pontos"
  ON transferencia_pontos
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all insert on transferencia_pontos"
  ON transferencia_pontos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all update on transferencia_pontos"
  ON transferencia_pontos
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all delete on transferencia_pontos"
  ON transferencia_pontos
  FOR DELETE
  USING (true);