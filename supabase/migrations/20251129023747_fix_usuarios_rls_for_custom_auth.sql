/*
  # Corrige RLS da tabela usuarios para autenticação customizada

  1. Alterações
    - Remove políticas antigas que usavam auth.uid()
    - Cria novas políticas que funcionam com autenticação customizada
    - Permite INSERT e UPDATE sem verificação de auth.uid()
    
  2. Segurança
    - Mantém RLS ativo
    - Todas as operações permitidas para authenticated
    - A lógica de permissão é feita na aplicação
*/

-- Remove políticas antigas
DROP POLICY IF EXISTS "Public can read usuarios for login" ON usuarios;
DROP POLICY IF EXISTS "ADM can insert usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM or self can update usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM can delete usuarios" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users can read usuarios" ON usuarios;

-- Cria novas políticas compatíveis com autenticação customizada
CREATE POLICY "Allow read for authenticated"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated"
  ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated"
  ON usuarios
  FOR DELETE
  TO authenticated
  USING (true);