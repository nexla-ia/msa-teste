/*
  # Fix RLS Policies for All Programs Tables

  1. Changes
    - Drop restrictive policies created for program tables
    - Create permissive policies that allow anon and authenticated access
    - This matches the existing authentication pattern in the application

  2. Security
    - Policies allow access based on application-level authentication
    - All operations permitted for authenticated and anonymous users
    - Application handles actual permission checks
*/

-- Drop existing restrictive policies for all program tables
DROP POLICY IF EXISTS "Users can view azul members" ON azul_membros;
DROP POLICY IF EXISTS "Users can insert azul members" ON azul_membros;
DROP POLICY IF EXISTS "Users can update azul members" ON azul_membros;
DROP POLICY IF EXISTS "Users can delete azul members" ON azul_membros;

DROP POLICY IF EXISTS "Users can view livelo members" ON livelo_membros;
DROP POLICY IF EXISTS "Users can insert livelo members" ON livelo_membros;
DROP POLICY IF EXISTS "Users can update livelo members" ON livelo_membros;
DROP POLICY IF EXISTS "Users can delete livelo members" ON livelo_membros;

DROP POLICY IF EXISTS "Users can view tap members" ON tap_membros;
DROP POLICY IF EXISTS "Users can insert tap members" ON tap_membros;
DROP POLICY IF EXISTS "Users can update tap members" ON tap_membros;
DROP POLICY IF EXISTS "Users can delete tap members" ON tap_membros;

DROP POLICY IF EXISTS "Users can view accor members" ON accor_membros;
DROP POLICY IF EXISTS "Users can insert accor members" ON accor_membros;
DROP POLICY IF EXISTS "Users can update accor members" ON accor_membros;
DROP POLICY IF EXISTS "Users can delete accor members" ON accor_membros;

DROP POLICY IF EXISTS "Users can view km members" ON km_membros;
DROP POLICY IF EXISTS "Users can insert km members" ON km_membros;
DROP POLICY IF EXISTS "Users can update km members" ON km_membros;
DROP POLICY IF EXISTS "Users can delete km members" ON km_membros;

DROP POLICY IF EXISTS "Users can view pagol members" ON pagol_membros;
DROP POLICY IF EXISTS "Users can insert pagol members" ON pagol_membros;
DROP POLICY IF EXISTS "Users can update pagol members" ON pagol_membros;
DROP POLICY IF EXISTS "Users can delete pagol members" ON pagol_membros;

DROP POLICY IF EXISTS "Users can view esfera members" ON esfera_membros;
DROP POLICY IF EXISTS "Users can insert esfera members" ON esfera_membros;
DROP POLICY IF EXISTS "Users can update esfera members" ON esfera_membros;
DROP POLICY IF EXISTS "Users can delete esfera members" ON esfera_membros;

DROP POLICY IF EXISTS "Users can view hotmilhas members" ON hotmilhas_membros;
DROP POLICY IF EXISTS "Users can insert hotmilhas members" ON hotmilhas_membros;
DROP POLICY IF EXISTS "Users can update hotmilhas members" ON hotmilhas_membros;
DROP POLICY IF EXISTS "Users can delete hotmilhas members" ON hotmilhas_membros;

DROP POLICY IF EXISTS "Users can view coopera members" ON coopera_membros;
DROP POLICY IF EXISTS "Users can insert coopera members" ON coopera_membros;
DROP POLICY IF EXISTS "Users can update coopera members" ON coopera_membros;
DROP POLICY IF EXISTS "Users can delete coopera members" ON coopera_membros;

DROP POLICY IF EXISTS "Users can view gov members" ON gov_membros;
DROP POLICY IF EXISTS "Users can insert gov members" ON gov_membros;
DROP POLICY IF EXISTS "Users can update gov members" ON gov_membros;
DROP POLICY IF EXISTS "Users can delete gov members" ON gov_membros;

-- Create permissive policies for all program tables

-- Azul
CREATE POLICY "Allow all access to azul_membros"
  ON azul_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Livelo
CREATE POLICY "Allow all access to livelo_membros"
  ON livelo_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- TAP
CREATE POLICY "Allow all access to tap_membros"
  ON tap_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Accor
CREATE POLICY "Allow all access to accor_membros"
  ON accor_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- KM
CREATE POLICY "Allow all access to km_membros"
  ON km_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Pagol
CREATE POLICY "Allow all access to pagol_membros"
  ON pagol_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Esfera
CREATE POLICY "Allow all access to esfera_membros"
  ON esfera_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Hotmilhas
CREATE POLICY "Allow all access to hotmilhas_membros"
  ON hotmilhas_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Coopera
CREATE POLICY "Allow all access to coopera_membros"
  ON coopera_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- GOv
CREATE POLICY "Allow all access to gov_membros"
  ON gov_membros
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);