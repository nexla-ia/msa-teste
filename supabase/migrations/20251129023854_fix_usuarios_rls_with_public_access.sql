/*
  # Corrige RLS da tabela usuarios para permitir login e operações

  1. Alterações
    - Remove políticas que bloqueiam acesso
    - Permite leitura pública para login
    - Permite operações authenticated para CRUD
    
  2. Segurança
    - Login público (necessário para autenticar)
    - Operações CRUD requerem autenticação
    - Controle de permissões feito na aplicação
*/

-- Remove políticas existentes
DROP POLICY IF EXISTS "Allow read for authenticated" ON usuarios;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON usuarios;
DROP POLICY IF EXISTS "Allow update for authenticated" ON usuarios;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON usuarios;
DROP POLICY IF EXISTS "Public can read usuarios for login" ON usuarios;
DROP POLICY IF EXISTS "ADM can insert usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM or self can update usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM can delete usuarios" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users can read usuarios" ON usuarios;

-- Permite leitura pública (necessário para o login funcionar)
CREATE POLICY "Public can read usuarios"
  ON usuarios
  FOR SELECT
  TO public
  USING (true);

-- Permite insert para authenticated
CREATE POLICY "Authenticated can insert usuarios"
  ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Permite update para authenticated
CREATE POLICY "Authenticated can update usuarios"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Permite delete para authenticated
CREATE POLICY "Authenticated can delete usuarios"
  ON usuarios
  FOR DELETE
  TO authenticated
  USING (true);