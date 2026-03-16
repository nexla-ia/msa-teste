/*
  # Adicionar Permissões RLS para Funções de Automação de Clubes

  ## Descrição
  Garante que usuários autenticados possam executar as funções de automação
  de clubes e que as políticas RLS permitam as inserções automáticas.

  ## Mudanças
  - Concede permissões de execução para as funções de automação
  - Garante que as políticas RLS da tabela estoque_pontos permitam inserções do sistema
*/

-- Concede permissão para executar as funções de automação
GRANT EXECUTE ON FUNCTION processar_creditos_clubes() TO authenticated;
GRANT EXECUTE ON FUNCTION gerar_lembretes_clubes() TO authenticated;

-- Garante que a política pública de inserção existe para estoque_pontos
DO $$ 
BEGIN
  -- Remove política antiga se existir
  DROP POLICY IF EXISTS "Sistema pode inserir no estoque" ON estoque_pontos;
  
  -- Cria nova política que permite inserções do sistema
  CREATE POLICY "Sistema pode inserir no estoque"
    ON estoque_pontos
    FOR INSERT
    TO public
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
