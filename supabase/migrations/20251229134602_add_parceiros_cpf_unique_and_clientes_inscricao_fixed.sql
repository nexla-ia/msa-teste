/*
  # Melhorias em Parceiros e Clientes

  ## 1. Parceiros
  - Adicionar constraint de CPF único para evitar duplicidades
  - Adicionar constraint de nome_parceiro único

  ## 2. Clientes
  - Adicionar campo inscricao_municipal (não obrigatório)

  ## 3. Segurança
  - Mantém RLS existente
*/

-- =====================
-- Parceiros
-- =====================

-- Criar constraint de CPF único (permitindo null para casos onde não se aplica)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parceiros_cpf_unique'
  ) THEN
    CREATE UNIQUE INDEX parceiros_cpf_unique ON parceiros(cpf) WHERE cpf IS NOT NULL AND cpf != '';
  END IF;
END $$;

-- Criar constraint de nome_parceiro único
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parceiros_nome_parceiro_unique'
  ) THEN
    CREATE UNIQUE INDEX parceiros_nome_parceiro_unique ON parceiros(nome_parceiro) WHERE nome_parceiro IS NOT NULL AND nome_parceiro != '';
  END IF;
END $$;

-- =====================
-- Clientes
-- =====================

-- Adicionar campo inscricao_municipal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'inscricao_municipal'
  ) THEN
    ALTER TABLE clientes 
    ADD COLUMN inscricao_municipal text;
  END IF;
END $$;

-- Criar índice para melhor performance em buscas
CREATE INDEX IF NOT EXISTS idx_clientes_inscricao_municipal ON clientes(inscricao_municipal) WHERE inscricao_municipal IS NOT NULL;
