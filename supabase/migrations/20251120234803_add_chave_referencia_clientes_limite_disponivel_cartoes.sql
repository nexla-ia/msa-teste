/*
  # Adicionar chave_referencia em clientes e limite_disponivel em cartões

  Esta migration adiciona novos campos nas tabelas:

  1. **Tabela clientes**
     - Adiciona coluna `chave_referencia` (text, unique) - Chave de referência criada pelo usuário
  
  2. **Tabela cartoes_credito**
     - Adiciona coluna `limite_disponivel` (numeric) - Limite disponível no cartão

  ## Mudanças

  ### Clientes:
  - Nova coluna chave_referencia (text, nullable, unique)
  - Permite ao usuário criar uma chave personalizada para identificar o cliente

  ### Cartões de Crédito:
  - Nova coluna limite_disponivel (numeric, default 0)
  - Campo para controlar o limite disponível (futura integração com financeiro)
*/

-- Adicionar chave_referencia em clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'chave_referencia'
  ) THEN
    ALTER TABLE clientes ADD COLUMN chave_referencia text;
  END IF;
END $$;

-- Adicionar constraint de unicidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'clientes_chave_referencia_key'
  ) THEN
    ALTER TABLE clientes ADD CONSTRAINT clientes_chave_referencia_key UNIQUE(chave_referencia);
  END IF;
END $$;

-- Adicionar limite_disponivel em cartoes_credito
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoes_credito' AND column_name = 'limite_disponivel'
  ) THEN
    ALTER TABLE cartoes_credito ADD COLUMN limite_disponivel numeric DEFAULT 0;
  END IF;
END $$;

-- Adicionar índice para chave_referencia
CREATE INDEX IF NOT EXISTS idx_clientes_chave_referencia ON clientes(chave_referencia);

-- Comentários
COMMENT ON COLUMN clientes.chave_referencia IS 'Chave de referência personalizada criada pelo usuário para identificar o cliente';
COMMENT ON COLUMN cartoes_credito.limite_disponivel IS 'Limite disponível no cartão (será integrado com sistema financeiro)';
