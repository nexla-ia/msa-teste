/*
  # Criar tabela de Parceiros

  Esta migration cria a tabela de parceiros com todos os campos necessários.

  1. **Nova Tabela: parceiros**
     - `id` (uuid, primary key) - ID real do sistema
     - `id_parceiro` (text, unique) - ID customizado definido pelo usuário
     - `nome_parceiro` (text, required) - Nome do parceiro
     - `telefone` (text) - Telefone
     - `dt_nasc` (date) - Data de nascimento
     - `cpf` (text) - CPF
     - `rg` (text) - RG
     - `email` (text) - Email
     - `endereco` (text) - Endereço
     - `numero` (text) - Número
     - `complemento` (text) - Complemento
     - `bairro` (text) - Bairro
     - `cidade` (text) - Cidade
     - `estado` (text) - Estado
     - `cep` (text) - CEP
     - `nome_mae` (text) - Nome da mãe
     - `nome_pai` (text) - Nome do pai
     - `tipo` (text) - Parceiro ou Fornecedor
     - `created_at` (timestamptz) - Data de criação
     - `updated_at` (timestamptz) - Data de atualização

  2. **Segurança**
     - RLS habilitado
     - Políticas para usuários autenticados
*/

-- Criar tabela parceiros
CREATE TABLE IF NOT EXISTS parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_parceiro text UNIQUE,
  nome_parceiro text NOT NULL,
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  endereco text DEFAULT '',
  numero text DEFAULT '',
  complemento text DEFAULT '',
  bairro text DEFAULT '',
  cidade text DEFAULT '',
  estado text DEFAULT '',
  cep text DEFAULT '',
  nome_mae text DEFAULT '',
  nome_pai text DEFAULT '',
  tipo text DEFAULT 'Parceiro',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar constraint para tipo
ALTER TABLE parceiros ADD CONSTRAINT parceiros_tipo_check 
  CHECK (tipo IN ('Parceiro', 'Fornecedor'));

-- Habilitar RLS
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can read parceiros"
  ON parceiros
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert parceiros"
  ON parceiros
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update parceiros"
  ON parceiros
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete parceiros"
  ON parceiros
  FOR DELETE
  TO authenticated
  USING (true);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_parceiros_id_parceiro ON parceiros(id_parceiro);
CREATE INDEX IF NOT EXISTS idx_parceiros_nome ON parceiros(nome_parceiro);
CREATE INDEX IF NOT EXISTS idx_parceiros_tipo ON parceiros(tipo);

-- Comentários
COMMENT ON TABLE parceiros IS 'Cadastro de parceiros e fornecedores';
COMMENT ON COLUMN parceiros.id_parceiro IS 'ID customizado definido pelo usuário';
COMMENT ON COLUMN parceiros.tipo IS 'Define se é Parceiro ou Fornecedor';
