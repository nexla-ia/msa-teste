/*
  # Corrigir referência de programa em conta_familia

  1. Alterações
    - Remover foreign key antiga que referencia tabela 'programas'
    - Adicionar nova foreign key que referencia tabela 'programas_fidelidade'

  2. Segurança
    - Manter RLS habilitado
    - Não altera políticas existentes
*/

-- Remover a foreign key antiga
ALTER TABLE conta_familia 
  DROP CONSTRAINT IF EXISTS conta_familia_programa_id_fkey;

-- Adicionar nova foreign key para programas_fidelidade
ALTER TABLE conta_familia
  ADD CONSTRAINT conta_familia_programa_id_fkey 
  FOREIGN KEY (programa_id) 
  REFERENCES programas_fidelidade(id);
