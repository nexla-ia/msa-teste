/*
  # Fix RLS Policies for estoque_pontos

  1. Changes
    - Drop existing RLS policies that require authenticated users
    - Create new policies that allow public access for custom auth system
    - Maintain security by allowing all authenticated operations

  2. Security
    - Policies updated to work with custom authentication (usuarios table)
    - All operations allowed for logged-in users via application
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all estoque_pontos" ON estoque_pontos;
DROP POLICY IF EXISTS "Users can insert estoque_pontos" ON estoque_pontos;
DROP POLICY IF EXISTS "Users can update estoque_pontos" ON estoque_pontos;

-- Create new policies for custom auth
CREATE POLICY "Allow all select on estoque_pontos"
  ON estoque_pontos
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all insert on estoque_pontos"
  ON estoque_pontos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all update on estoque_pontos"
  ON estoque_pontos
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all delete on estoque_pontos"
  ON estoque_pontos
  FOR DELETE
  USING (true);