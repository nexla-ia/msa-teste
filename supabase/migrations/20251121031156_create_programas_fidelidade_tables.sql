/*
  # Criar estrutura para programas de fidelidade

  1. Novas Tabelas
    - `programas`
      - `id` (uuid, primary key)
      - `nome_programa` (text) - Nome do programa (ex: Smiles, Livelo, etc)
      - `descricao` (text, nullable)
      - `ativo` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `programas_membros`
      - `id` (uuid, primary key)
      - `programa_id` (uuid, foreign key -> programas)
      - `parceiro_id` (uuid, foreign key -> parceiros)
      - `numero_fidelidade` (text) - Número da conta no programa
      - `senha` (text, nullable)
      - `conta_familia` (text, nullable)
      - `data_exclusao_conta_familia` (date, nullable)
      - `clube_produto_id` (uuid, nullable, foreign key -> produtos)
      - `cartao_id` (uuid, nullable, foreign key -> cartoes_credito)
      - `data_ultima_assinatura` (date, nullable)
      - `dia_cobranca` (integer, nullable)
      - `valor` (decimal, nullable)
      - `tempo_clube_meses` (integer, nullable, default 0)
      - `liminar` (text, nullable)
      - `mudanca_clube` (text, nullable) - DownGrade/UpGrade
      - `milhas_expirando` (text, nullable)
      - `observacoes` (text, nullable)
      - `parceiro_fornecedor` (text, nullable)
      - `status_conta` (text, default 'Aguarda Confirmação')
      - `status_restricao` (text, default 'Sem restrição')
      - `conferente` (text, nullable)
      - `ultima_data_conferencia` (date, nullable)
      - `grupo_liminar` (text, nullable)
      - `status_programa` (text, nullable) - Diamond, Platinum, Gold
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - Habilitar RLS em ambas as tabelas
    - Adicionar políticas para acesso via anon key
*/

-- Criar tabela de programas
CREATE TABLE IF NOT EXISTS programas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_programa text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de membros dos programas
CREATE TABLE IF NOT EXISTS programas_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id uuid NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  numero_fidelidade text NOT NULL,
  senha text,
  conta_familia text,
  data_exclusao_conta_familia date,
  clube_produto_id uuid REFERENCES produtos(id) ON DELETE SET NULL,
  cartao_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL,
  data_ultima_assinatura date,
  dia_cobranca integer CHECK (dia_cobranca >= 1 AND dia_cobranca <= 31),
  valor decimal(10,2),
  tempo_clube_meses integer DEFAULT 0,
  liminar text,
  mudanca_clube text,
  milhas_expirando text,
  observacoes text,
  parceiro_fornecedor text,
  status_conta text DEFAULT 'Aguarda Confirmação',
  status_restricao text DEFAULT 'Sem restrição',
  conferente text,
  ultima_data_conferencia date,
  grupo_liminar text,
  status_programa text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(programa_id, parceiro_id, numero_fidelidade)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_programas_membros_programa ON programas_membros(programa_id);
CREATE INDEX IF NOT EXISTS idx_programas_membros_parceiro ON programas_membros(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_programas_membros_clube ON programas_membros(clube_produto_id);
CREATE INDEX IF NOT EXISTS idx_programas_membros_cartao ON programas_membros(cartao_id);

-- Habilitar RLS
ALTER TABLE programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE programas_membros ENABLE ROW LEVEL SECURITY;

-- Políticas para tabela programas
CREATE POLICY "Allow anon to read programas"
  ON programas FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon to insert programas"
  ON programas FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update programas"
  ON programas FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete programas"
  ON programas FOR DELETE
  TO anon, authenticated
  USING (true);

-- Políticas para tabela programas_membros
CREATE POLICY "Allow anon to read programas_membros"
  ON programas_membros FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon to insert programas_membros"
  ON programas_membros FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update programas_membros"
  ON programas_membros FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete programas_membros"
  ON programas_membros FOR DELETE
  TO anon, authenticated
  USING (true);

-- Inserir programa Smiles como padrão
INSERT INTO programas (nome_programa, descricao, ativo)
VALUES ('Smiles', 'Programa de fidelidade Smiles/Gol', true)
ON CONFLICT DO NOTHING;
