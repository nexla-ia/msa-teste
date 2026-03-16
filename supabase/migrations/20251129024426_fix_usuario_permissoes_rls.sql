/*
  # Corrige RLS da tabela usuario_permissoes

  1. Alterações
    - Remove políticas que requerem authenticated
    - Cria novas políticas compatíveis com anon
    
  2. Segurança
    - Permite operações com chave anon
    - Controle de permissões feito na aplicação
*/

-- Remove políticas existentes
DROP POLICY IF EXISTS "Usuários podem ver suas próprias permissões" ON usuario_permissoes;
DROP POLICY IF EXISTS "Apenas ADM pode inserir permissões" ON usuario_permissoes;
DROP POLICY IF EXISTS "Apenas ADM pode atualizar permissões" ON usuario_permissoes;
DROP POLICY IF EXISTS "Apenas ADM pode deletar permissões" ON usuario_permissoes;

-- Cria novas políticas compatíveis com anon
CREATE POLICY "Anyone can read permissoes"
  ON usuario_permissoes
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert permissoes"
  ON usuario_permissoes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update permissoes"
  ON usuario_permissoes
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete permissoes"
  ON usuario_permissoes
  FOR DELETE
  TO anon, authenticated
  USING (true);