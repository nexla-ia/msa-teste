/*
  # Corrigir RLS para autenticação customizada

  Como o sistema usa autenticação customizada (tabela usuarios) e não o auth.users do Supabase,
  as políticas RLS precisam ser ajustadas para permitir acesso anônimo autenticado via anon key.

  ## Mudanças
  
  - Remove políticas que dependem de auth.uid()
  - Cria políticas mais permissivas para chave anônima
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Allow authenticated users to read parceiros" ON parceiros;
DROP POLICY IF EXISTS "Allow authenticated users to insert parceiros" ON parceiros;
DROP POLICY IF EXISTS "Allow authenticated users to update parceiros" ON parceiros;
DROP POLICY IF EXISTS "Allow authenticated users to delete parceiros" ON parceiros;

-- Criar novas políticas permissivas para anon key
CREATE POLICY "Allow anon to read parceiros"
  ON parceiros
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon to insert parceiros"
  ON parceiros
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update parceiros"
  ON parceiros
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete parceiros"
  ON parceiros
  FOR DELETE
  TO anon, authenticated
  USING (true);
