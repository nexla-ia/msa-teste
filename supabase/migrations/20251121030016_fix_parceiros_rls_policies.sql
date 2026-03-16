/*
  # Corrigir políticas RLS da tabela parceiros

  Remove as políticas antigas e cria novas políticas mais robustas
  que verificam corretamente a autenticação do usuário.

  ## Mudanças
  
  - Remove todas as políticas antigas
  - Cria novas políticas que verificam auth.uid()
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can read parceiros" ON parceiros;
DROP POLICY IF EXISTS "Authenticated users can insert parceiros" ON parceiros;
DROP POLICY IF EXISTS "Authenticated users can update parceiros" ON parceiros;
DROP POLICY IF EXISTS "Authenticated users can delete parceiros" ON parceiros;

-- Criar novas políticas
CREATE POLICY "Allow authenticated users to read parceiros"
  ON parceiros
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert parceiros"
  ON parceiros
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update parceiros"
  ON parceiros
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete parceiros"
  ON parceiros
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
