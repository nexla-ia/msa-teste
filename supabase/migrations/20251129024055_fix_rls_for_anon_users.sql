/*
  # Corrige RLS para permitir operações com chave anon

  1. Alterações
    - Altera políticas de authenticated para anon/public
    - Permite todas as operações com a chave anon
    
  2. Segurança
    - Autenticação customizada via aplicação
    - Controle de permissões na camada da aplicação
*/

-- Remove políticas existentes
DROP POLICY IF EXISTS "Public can read usuarios" ON usuarios;
DROP POLICY IF EXISTS "Authenticated can insert usuarios" ON usuarios;
DROP POLICY IF EXISTS "Authenticated can update usuarios" ON usuarios;
DROP POLICY IF EXISTS "Authenticated can delete usuarios" ON usuarios;

-- Cria políticas que funcionam com chave anon
CREATE POLICY "Anyone can read usuarios"
  ON usuarios
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert usuarios"
  ON usuarios
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update usuarios"
  ON usuarios
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete usuarios"
  ON usuarios
  FOR DELETE
  TO anon, authenticated
  USING (true);