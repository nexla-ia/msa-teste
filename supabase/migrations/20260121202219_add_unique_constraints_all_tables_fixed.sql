/*
  # Adicionar Constraints Únicas para Evitar Duplicações
  
  Esta migration adiciona constraints únicas em todas as tabelas para garantir
  que não seja possível criar registros duplicados, nem ao criar nem ao editar.
  
  ## Tabelas Afetadas
  
  ### 1. Clientes
  - Adiciona constraint única para `cnpj_cpf` (quando não vazio)
  - Mantém constraint única para `chave_referencia`
  
  ### 2. Cartões de Crédito
  - Adiciona constraint única para o nome do `cartao` (quando não vazio)
  
  ### 3. Contas Bancárias
  - Adiciona constraint única para combinação `codigo_banco` + `agencia` + `numero_conta`
  
  ### 4. Produtos
  - Adiciona constraint única para `nome`
  
  ### 5. Lojas
  - Adiciona constraint única para `nome`
  
  ## Segurança
  - Constraints aplicadas com WHERE para permitir valores vazios/null
  - Mantém RLS existente
*/

-- =====================
-- CLIENTES
-- =====================

-- Adicionar constraint única para CNPJ/CPF
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'clientes_cnpj_cpf_unique'
  ) THEN
    CREATE UNIQUE INDEX clientes_cnpj_cpf_unique 
    ON clientes(cnpj_cpf) 
    WHERE cnpj_cpf IS NOT NULL AND cnpj_cpf != '';
  END IF;
END $$;

-- =====================
-- CARTÕES DE CRÉDITO
-- =====================

-- Adicionar constraint única para nome do cartão
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'cartoes_credito_cartao_unique'
  ) THEN
    CREATE UNIQUE INDEX cartoes_credito_cartao_unique 
    ON cartoes_credito(cartao) 
    WHERE cartao IS NOT NULL AND cartao != '';
  END IF;
END $$;

-- =====================
-- CONTAS BANCÁRIAS
-- =====================

-- Adicionar constraint única para combinação banco+agencia+conta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'contas_bancarias_unique'
  ) THEN
    CREATE UNIQUE INDEX contas_bancarias_unique 
    ON contas_bancarias(codigo_banco, agencia, numero_conta) 
    WHERE codigo_banco IS NOT NULL AND codigo_banco != ''
      AND agencia IS NOT NULL AND agencia != ''
      AND numero_conta IS NOT NULL AND numero_conta != '';
  END IF;
END $$;

-- =====================
-- PRODUTOS
-- =====================

-- Adicionar constraint única para nome do produto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'produtos_nome_unique'
  ) THEN
    CREATE UNIQUE INDEX produtos_nome_unique 
    ON produtos(nome) 
    WHERE nome IS NOT NULL AND nome != '';
  END IF;
END $$;

-- =====================
-- LOJAS
-- =====================

-- Adicionar constraint única para nome da loja
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'lojas_nome_unique'
  ) THEN
    CREATE UNIQUE INDEX lojas_nome_unique 
    ON lojas(nome) 
    WHERE nome IS NOT NULL AND nome != '';
  END IF;
END $$;

-- Comentários
COMMENT ON INDEX clientes_cnpj_cpf_unique IS 'Garante que não existam clientes com mesmo CNPJ/CPF';
COMMENT ON INDEX cartoes_credito_cartao_unique IS 'Garante que não existam cartões com mesmo nome';
COMMENT ON INDEX contas_bancarias_unique IS 'Garante que não existam contas bancárias duplicadas';
COMMENT ON INDEX produtos_nome_unique IS 'Garante que não existam produtos com mesmo nome';
COMMENT ON INDEX lojas_nome_unique IS 'Garante que não existam lojas com mesmo nome';
