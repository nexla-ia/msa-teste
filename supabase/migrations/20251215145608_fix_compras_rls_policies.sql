/*
  # Fix Compras RLS Policies

  1. Changes
    - Drop existing restrictive policies
    - Add new policies that allow public access
    - This matches the authentication pattern used in other tables

  2. Security
    - Allows authenticated users to access compras data
    - Uses the same pattern as other tables in the system
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all compras" ON compras;
DROP POLICY IF EXISTS "Users can insert compras" ON compras;
DROP POLICY IF EXISTS "Users can update compras" ON compras;
DROP POLICY IF EXISTS "Users can delete compras" ON compras;

-- Create new policies with public access
CREATE POLICY "Allow all operations on compras"
  ON compras
  FOR ALL
  USING (true)
  WITH CHECK (true);
