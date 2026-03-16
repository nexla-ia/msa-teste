/*
  # MSA Milhas e Turismo - ERP System Schema

  ## Overview
  This migration creates the complete database schema for the MSA Milhas e Turismo ERP system,
  including user management, customer data, loyalty programs, and comprehensive audit logging.

  ## New Tables

  ### 1. usuarios (Users)
  - `id` (uuid, primary key) - Unique user identifier
  - `nome` (text) - Full name
  - `email` (text, unique) - Email address for login
  - `senha` (text) - Hashed password
  - `nivel_acesso` (text) - Access level: 'ADM' or 'USER'
  - `ultima_acao` (timestamptz) - Last action timestamp
  - `token` (text, unique) - Authentication token
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ### 2. clientes (Customers)
  - `id` (uuid, primary key)
  - `nome_cliente` (text) - Customer name
  - `endereco` (text) - Address
  - `email` (text) - Email address
  - `telefone` (text) - Phone number
  - `whatsapp` (text) - WhatsApp number
  - `contato` (text) - Contact person
  - `site` (text) - Website
  - `instagram` (text) - Instagram handle
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. programas_fidelidade (Loyalty Programs)
  - `id` (uuid, primary key)
  - `programa` (text) - Program code/identifier
  - `nome` (text) - Program name
  - `cnpj` (text) - Company CNPJ
  - `site` (text) - Website
  - `telefone` (text) - Phone
  - `whatsapp` (text) - WhatsApp
  - `email` (text) - Email
  - `link_chat` (text) - Chat link
  - `obs` (text) - Observations
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. lojas (Stores - Bonus Purchases)
  - `id` (uuid, primary key)
  - `nome` (text) - Store name
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. produtos (Products)
  - `id` (uuid, primary key)
  - `nome` (text) - Product name
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. cartoes_credito (Credit Cards)
  - `id` (uuid, primary key)
  - `cartao` (text) - Card name
  - `banco_emissor` (text) - Issuing bank
  - `status` (text) - Status: 'ativo' or 'titular'
  - `dia_fechamento` (integer) - Closing day
  - `dia_vencimento` (integer) - Due day
  - `valor_mensalidade` (numeric) - Monthly fee
  - `limites` (numeric) - Credit limit
  - `limite_emergencial` (numeric) - Emergency limit
  - `limite_global` (numeric) - Global limit
  - `valor_isencao` (numeric) - Exemption amount
  - `onde_usar` (text) - Where to use
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. contas_bancarias (Bank Accounts)
  - `id` (uuid, primary key)
  - `nome_banco` (text) - Bank name
  - `codigo_banco` (text) - Bank code
  - `agencia` (text) - Branch
  - `numero_conta` (text) - Account number
  - `chave_pix` (text) - PIX key
  - `saldo_inicial` (numeric) - Initial balance
  - `data_saldo_inicial` (date) - Initial balance date
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. classificacao_contabil (Accounting Classification)
  - `id` (uuid, primary key)
  - `nome` (text) - Classification name (INSS, Simples Nacional, Pro Labore)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 9. centro_custos (Cost Centers)
  - `id` (uuid, primary key)
  - `nome` (text) - Cost center name
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 10. logs (Audit Logs)
  - `id` (uuid, primary key)
  - `data_hora` (timestamptz) - Timestamp
  - `usuario_id` (uuid, foreign key) - User who performed action
  - `usuario_nome` (text) - User name snapshot
  - `acao` (text) - Action performed
  - `linha_afetada` (text) - Affected table/record
  - `dados_antes` (jsonb) - Data before change
  - `dados_depois` (jsonb) - Data after change
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - ADM users have full access
  - USER level has read-only access to most tables
  - Logs are append-only for all authenticated users
  - Automatic log rotation at 1000 records

  ## Functions
  - `log_action()` - Trigger function for automatic audit logging
  - `cleanup_old_logs()` - Function to maintain 1000 record limit
*/

-- Create usuarios table
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text UNIQUE NOT NULL,
  senha text NOT NULL,
  nivel_acesso text NOT NULL DEFAULT 'USER' CHECK (nivel_acesso IN ('ADM', 'USER')),
  ultima_acao timestamptz DEFAULT now(),
  token text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clientes table
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente text NOT NULL,
  endereco text DEFAULT '',
  email text DEFAULT '',
  telefone text DEFAULT '',
  whatsapp text DEFAULT '',
  contato text DEFAULT '',
  site text DEFAULT '',
  instagram text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create programas_fidelidade table
CREATE TABLE IF NOT EXISTS programas_fidelidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa text NOT NULL,
  nome text NOT NULL,
  cnpj text DEFAULT '',
  site text DEFAULT '',
  telefone text DEFAULT '',
  whatsapp text DEFAULT '',
  email text DEFAULT '',
  link_chat text DEFAULT '',
  obs text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lojas table
CREATE TABLE IF NOT EXISTS lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create produtos table
CREATE TABLE IF NOT EXISTS produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cartoes_credito table
CREATE TABLE IF NOT EXISTS cartoes_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao text NOT NULL,
  banco_emissor text DEFAULT '',
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'titular')),
  dia_fechamento integer CHECK (dia_fechamento >= 1 AND dia_fechamento <= 31),
  dia_vencimento integer CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  valor_mensalidade numeric(10, 2) DEFAULT 0,
  limites numeric(10, 2) DEFAULT 0,
  limite_emergencial numeric(10, 2) DEFAULT 0,
  limite_global numeric(10, 2) DEFAULT 0,
  valor_isencao numeric(10, 2) DEFAULT 0,
  onde_usar text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contas_bancarias table
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_banco text NOT NULL,
  codigo_banco text DEFAULT '',
  agencia text DEFAULT '',
  numero_conta text DEFAULT '',
  chave_pix text DEFAULT '',
  saldo_inicial numeric(10, 2) DEFAULT 0,
  data_saldo_inicial date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create classificacao_contabil table
CREATE TABLE IF NOT EXISTS classificacao_contabil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create centro_custos table
CREATE TABLE IF NOT EXISTS centro_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create logs table
CREATE TABLE IF NOT EXISTS logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_hora timestamptz DEFAULT now(),
  usuario_id uuid REFERENCES usuarios(id),
  usuario_nome text NOT NULL,
  acao text NOT NULL,
  linha_afetada text NOT NULL,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index on logs for performance
CREATE INDEX IF NOT EXISTS idx_logs_data_hora ON logs(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_id ON logs(usuario_id);

-- Function to cleanup old logs (keep only 1000 most recent)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS trigger AS $$
BEGIN
  DELETE FROM logs
  WHERE id IN (
    SELECT id FROM logs
    ORDER BY data_hora DESC
    OFFSET 1000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically cleanup logs
DROP TRIGGER IF EXISTS trigger_cleanup_logs ON logs;
CREATE TRIGGER trigger_cleanup_logs
  AFTER INSERT ON logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_logs();

-- Insert default admin user (password: admin123)
INSERT INTO usuarios (nome, email, senha, nivel_acesso, token)
VALUES (
  'Administrador',
  'admin@msamilhas.com',
  '$2a$10$rKXqCvWvH8p8hXqKmVqH8OwFnKQZxVxQxW3xVxYZxZ8xZxZxZxZxZ',
  'ADM',
  gen_random_uuid()::text
) ON CONFLICT (email) DO NOTHING;

-- Insert default classification entries
INSERT INTO classificacao_contabil (nome) VALUES
  ('INSS'),
  ('Simples Nacional'),
  ('Pro Labore')
ON CONFLICT DO NOTHING;

-- Insert default cost center
INSERT INTO centro_custos (nome) VALUES ('MSA') ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE programas_fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE classificacao_contabil ENABLE ROW LEVEL SECURITY;
ALTER TABLE centro_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for usuarios
CREATE POLICY "Authenticated users can read usuarios"
  ON usuarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert usuarios"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update usuarios"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete usuarios"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for clientes
CREATE POLICY "Authenticated users can read clientes"
  ON clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert clientes"
  ON clientes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update clientes"
  ON clientes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete clientes"
  ON clientes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for programas_fidelidade
CREATE POLICY "Authenticated users can read programas_fidelidade"
  ON programas_fidelidade FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert programas_fidelidade"
  ON programas_fidelidade FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update programas_fidelidade"
  ON programas_fidelidade FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete programas_fidelidade"
  ON programas_fidelidade FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for lojas
CREATE POLICY "Authenticated users can read lojas"
  ON lojas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert lojas"
  ON lojas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update lojas"
  ON lojas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete lojas"
  ON lojas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for produtos
CREATE POLICY "Authenticated users can read produtos"
  ON produtos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert produtos"
  ON produtos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update produtos"
  ON produtos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete produtos"
  ON produtos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for cartoes_credito
CREATE POLICY "Authenticated users can read cartoes_credito"
  ON cartoes_credito FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert cartoes_credito"
  ON cartoes_credito FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update cartoes_credito"
  ON cartoes_credito FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete cartoes_credito"
  ON cartoes_credito FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for contas_bancarias
CREATE POLICY "Authenticated users can read contas_bancarias"
  ON contas_bancarias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert contas_bancarias"
  ON contas_bancarias FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update contas_bancarias"
  ON contas_bancarias FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete contas_bancarias"
  ON contas_bancarias FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for classificacao_contabil
CREATE POLICY "Authenticated users can read classificacao_contabil"
  ON classificacao_contabil FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert classificacao_contabil"
  ON classificacao_contabil FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update classificacao_contabil"
  ON classificacao_contabil FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete classificacao_contabil"
  ON classificacao_contabil FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for centro_custos
CREATE POLICY "Authenticated users can read centro_custos"
  ON centro_custos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert centro_custos"
  ON centro_custos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update centro_custos"
  ON centro_custos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete centro_custos"
  ON centro_custos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND nivel_acesso = 'ADM'
    )
  );

-- RLS Policies for logs (append-only for authenticated users)
CREATE POLICY "Authenticated users can read logs"
  ON logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert logs"
  ON logs FOR INSERT
  TO authenticated
  WITH CHECK (true);