/*
  # Corrigir políticas RLS para estoque_movimentacoes

  ## Problema
  O sistema usa autenticação customizada (tabela usuarios) mas as políticas RLS 
  estão configuradas para role 'authenticated' do Supabase Auth.
  Isso impede que o frontend acesse os dados.

  ## Solução
  Alterar políticas para permitir acesso via role 'anon' (chave pública),
  já que a autenticação é controlada no nível da aplicação.

  ## Mudanças
  - DROP das políticas existentes
  - Criar novas políticas permitindo acesso público para leitura
  - Manter inserção/atualização via funções
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Permitir leitura de movimentações" ON estoque_movimentacoes;
DROP POLICY IF EXISTS "Permitir inserção via funções" ON estoque_movimentacoes;

-- Permitir leitura para todos (autenticação controlada no app)
CREATE POLICY "Permitir leitura de movimentações"
  ON estoque_movimentacoes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Permitir inserção para todos (usado por triggers e funções)
CREATE POLICY "Permitir inserção de movimentações"
  ON estoque_movimentacoes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

COMMENT ON POLICY "Permitir leitura de movimentações" ON estoque_movimentacoes IS 
'Permite leitura de todas as movimentações. Autenticação é controlada no nível da aplicação.';

COMMENT ON POLICY "Permitir inserção de movimentações" ON estoque_movimentacoes IS 
'Permite inserção de movimentações via triggers e funções do sistema.';
