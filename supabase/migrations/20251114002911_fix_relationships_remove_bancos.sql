/*
  # Corrigir relacionamentos - Remover tabela bancos

  Esta migration corrige os relacionamentos removendo a tabela bancos incorreta
  e criando o relacionamento correto entre cartões e contas bancárias.

  1. **Remover relacionamentos com bancos**
     - Remove foreign key de cartoes_credito.banco_emissor_id
     - Remove foreign key de contas_bancarias.banco_id
     - Remove colunas banco_emissor_id e banco_id

  2. **Criar relacionamento correto**
     - Adicionar conta_bancaria_id em cartoes_credito
     - Criar foreign key para contas_bancarias

  3. **Limpar**
     - Remover tabela bancos
     - Remover índices não utilizados

  ## Mudanças

  ### Cartões de Crédito:
  - Remove banco_emissor_id
  - Adiciona conta_bancaria_id com foreign key para contas_bancarias
  - Mantém banco_emissor (text) temporariamente

  ### Contas Bancárias:
  - Remove banco_id
  - Mantém estrutura atual
*/

-- Remover foreign keys existentes
ALTER TABLE cartoes_credito DROP CONSTRAINT IF EXISTS cartoes_credito_banco_emissor_id_fkey;
ALTER TABLE contas_bancarias DROP CONSTRAINT IF EXISTS contas_bancarias_banco_id_fkey;

-- Remover índices
DROP INDEX IF EXISTS idx_cartoes_credito_banco_emissor_id;
DROP INDEX IF EXISTS idx_contas_bancarias_banco_id;

-- Remover colunas de relacionamento com bancos
ALTER TABLE cartoes_credito DROP COLUMN IF EXISTS banco_emissor_id;
ALTER TABLE contas_bancarias DROP COLUMN IF EXISTS banco_id;

-- Adicionar relacionamento correto: cartoes -> contas_bancarias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoes_credito' AND column_name = 'conta_bancaria_id'
  ) THEN
    ALTER TABLE cartoes_credito ADD COLUMN conta_bancaria_id uuid;
  END IF;
END $$;

-- Criar foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cartoes_credito_conta_bancaria_id_fkey'
  ) THEN
    ALTER TABLE cartoes_credito
    ADD CONSTRAINT cartoes_credito_conta_bancaria_id_fkey
    FOREIGN KEY (conta_bancaria_id)
    REFERENCES contas_bancarias(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_cartoes_credito_conta_bancaria_id ON cartoes_credito(conta_bancaria_id);

-- Remover políticas RLS da tabela bancos
DROP POLICY IF EXISTS "Authenticated users can read bancos" ON bancos;
DROP POLICY IF EXISTS "ADM can insert bancos" ON bancos;
DROP POLICY IF EXISTS "ADM can update bancos" ON bancos;
DROP POLICY IF EXISTS "ADM can delete bancos" ON bancos;

-- Remover tabela bancos
DROP TABLE IF EXISTS bancos CASCADE;

COMMENT ON COLUMN cartoes_credito.conta_bancaria_id IS 'Referência para a conta bancária do cartão';
