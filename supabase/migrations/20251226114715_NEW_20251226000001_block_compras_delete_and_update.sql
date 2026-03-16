/*
  # Bloquear Exclusões e Atualizações em Compras

  ## Objetivo
  Proteger a integridade do estoque de pontos/milhas bloqueando operações de exclusão
  e atualização na tabela `compras` após o registro ser criado.

  ## Alterações

  ### 1. Políticas RLS
  - Remove todas as políticas de DELETE existentes
  - Remove todas as políticas de UPDATE existentes
  - Mantém apenas políticas de SELECT e INSERT

  ### 2. Função de Trigger
  - Cria função que bloqueia UPDATE e DELETE via trigger
  - Retorna erro descritivo quando tentativa de modificação é detectada

  ## Justificativa
  As entradas de compras afetam diretamente o estoque de pontos/milhas.
  Permitir edições ou exclusões pode causar inconsistências graves nos saldos.
  Esta política garante auditoria completa e integridade dos dados.

  ## Nota Importante
  Esta migration deve ser aplicada APÓS a implementação da interface que
  já não oferece mais botões de editar/excluir.
*/

-- Remove políticas de DELETE e UPDATE existentes na tabela compras
DROP POLICY IF EXISTS "Authenticated users can delete compras" ON compras;
DROP POLICY IF EXISTS "Authenticated users can update compras" ON compras;
DROP POLICY IF EXISTS "Users can delete compras" ON compras;
DROP POLICY IF EXISTS "Users can update compras" ON compras;

-- Cria função que bloqueia UPDATE e DELETE
CREATE OR REPLACE FUNCTION prevent_compras_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operação não permitida: Registros de compras não podem ser editados ou excluídos para manter a integridade do estoque.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger para BEFORE UPDATE
DROP TRIGGER IF EXISTS block_compras_update ON compras;
CREATE TRIGGER block_compras_update
  BEFORE UPDATE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION prevent_compras_modification();

-- Cria trigger para BEFORE DELETE
DROP TRIGGER IF EXISTS block_compras_delete ON compras;
CREATE TRIGGER block_compras_delete
  BEFORE DELETE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION prevent_compras_modification();

-- Confirma que as políticas de SELECT e INSERT continuam ativas
-- (estas já existem nas migrations anteriores e não devem ser removidas)
