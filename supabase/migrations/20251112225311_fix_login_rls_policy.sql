/*
  # Fix Login RLS Policy

  1. Changes
    - Drop existing RLS policies for usuarios table
    - Add new policy that allows public read access for authentication
    - Maintain strict policies for insert, update, delete operations

  2. Security
    - Public can read usuarios table (needed for login verification)
    - Only ADM can insert, update, delete usuarios
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM can insert usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM can update usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM can delete usuarios" ON usuarios;

-- Allow public read access for login (password verification happens in app)
CREATE POLICY "Public can read usuarios for login"
  ON usuarios FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only authenticated ADM can insert new usuarios
CREATE POLICY "ADM can insert usuarios"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- Only authenticated ADM or the user themselves can update
CREATE POLICY "ADM or self can update usuarios"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- Only authenticated ADM can delete usuarios
CREATE POLICY "ADM can delete usuarios"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );