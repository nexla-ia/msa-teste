/*
  # Adicionar campos obrigatórios e observações

  1. Alterações em Clientes
    - Tornar `chave_referencia` obrigatória (NOT NULL)
    - Adicionar coluna `cnpj_cpf` (TEXT)
    - Adicionar coluna `obs` (TEXT) para observações

  2. Alterações em Parceiros
    - Tornar `id_parceiro` obrigatório (NOT NULL)
    - Adicionar coluna `obs` (TEXT) para observações
    - Tornar todos os campos obrigatórios conforme necessário

  3. Alterações em Produtos
    - Adicionar coluna `valor_unitario` (NUMERIC) para valor unitário

  4. Alterações em Classificação Contábil
    - Adicionar coluna `chave_referencia` obrigatória (TEXT NOT NULL)

  5. Alterações em Centro de Custos
    - Adicionar coluna `chave_referencia` obrigatória (TEXT NOT NULL)

  6. Notas
    - Campos existentes com valores NULL serão atualizados com valores únicos antes de torná-los obrigatórios
    - Usa gen_random_uuid() para gerar chaves únicas quando necessário
*/

-- Atualizar clientes: adicionar CNPJ/CPF e observações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'cnpj_cpf'
  ) THEN
    ALTER TABLE clientes ADD COLUMN cnpj_cpf TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'obs'
  ) THEN
    ALTER TABLE clientes ADD COLUMN obs TEXT;
  END IF;
END $$;

-- Atualizar chave_referencia NULL com valores únicos em clientes
UPDATE clientes 
SET chave_referencia = 'CLI-' || gen_random_uuid()::text 
WHERE chave_referencia IS NULL OR chave_referencia = '';

-- Tornar chave_referencia obrigatória em clientes
ALTER TABLE clientes ALTER COLUMN chave_referencia SET NOT NULL;

-- Atualizar parceiros: adicionar observações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parceiros' AND column_name = 'obs'
  ) THEN
    ALTER TABLE parceiros ADD COLUMN obs TEXT;
  END IF;
END $$;

-- Atualizar id_parceiro NULL com valores únicos em parceiros
UPDATE parceiros 
SET id_parceiro = 'PARC-' || gen_random_uuid()::text 
WHERE id_parceiro IS NULL OR id_parceiro = '';

-- Tornar id_parceiro obrigatório em parceiros
ALTER TABLE parceiros ALTER COLUMN id_parceiro SET NOT NULL;

-- Tornar campos obrigatórios em parceiros
UPDATE parceiros SET nome_parceiro = '' WHERE nome_parceiro IS NULL;
ALTER TABLE parceiros ALTER COLUMN nome_parceiro SET NOT NULL;

UPDATE parceiros SET telefone = '' WHERE telefone IS NULL;
ALTER TABLE parceiros ALTER COLUMN telefone SET NOT NULL;

UPDATE parceiros SET cpf = '' WHERE cpf IS NULL;
ALTER TABLE parceiros ALTER COLUMN cpf SET NOT NULL;

UPDATE parceiros SET rg = '' WHERE rg IS NULL;
ALTER TABLE parceiros ALTER COLUMN rg SET NOT NULL;

UPDATE parceiros SET email = '' WHERE email IS NULL;
ALTER TABLE parceiros ALTER COLUMN email SET NOT NULL;

-- Atualizar produtos: adicionar valor_unitario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produtos' AND column_name = 'valor_unitario'
  ) THEN
    ALTER TABLE produtos ADD COLUMN valor_unitario NUMERIC(15,2) DEFAULT 0;
  END IF;
END $$;

-- Atualizar classificacao_contabil: adicionar chave_referencia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classificacao_contabil' AND column_name = 'chave_referencia'
  ) THEN
    ALTER TABLE classificacao_contabil ADD COLUMN chave_referencia TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Atualizar centro_custos: adicionar chave_referencia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_custos' AND column_name = 'chave_referencia'
  ) THEN
    ALTER TABLE centro_custos ADD COLUMN chave_referencia TEXT NOT NULL DEFAULT '';
  END IF;
END $$;
