/*
  # Create Additional Loyalty Programs Tables

  1. New Tables
    - `azul_membros` - Members of Azul program
    - `livelo_membros` - Members of Livelo program
    - `tap_membros` - Members of TAP program
    - `accor_membros` - Members of Accor program
    - `km_membros` - Members of KM program
    - `pagol_membros` - Members of Pagol program
    - `esfera_membros` - Members of Esfera program
    - `hotmilhas_membros` - Members of Hotmilhas program
    - `coopera_membros` - Members of Coopera program
    - `gov_membros` - Members of GOv program

  2. Columns (all tables have the same structure)
    - `id` (uuid, primary key)
    - `id_transacao` (text)
    - `parceiro_id` (uuid, foreign key to parceiros)
    - `nome_parceiro` (text)
    - `telefone` (text)
    - `dt_nasc` (date)
    - `cpf` (text)
    - `rg` (text)
    - `email` (text)
    - `idade` (integer)
    - `programa` (text)
    - `n_fidelidade` (text)
    - `senha` (text)
    - `conta_familia` (text)
    - `data_exclusao_cf` (date)
    - `clube` (text)
    - `cartao` (text)
    - `data_ultima_assinatura` (date)
    - `dia_cobranca` (integer)
    - `valor` (numeric)
    - `tempo_clube_mes` (integer)
    - `liminar` (text)
    - `atualizado_em` (timestamptz)
    - `obs` (text)
    - `parceiro_fornecedor` (text)
    - `status_conta` (text)
    - `status_restricao` (text)
    - `conferente` (text)
    - `ultima_data_conferencia` (date)
    - `grupo_liminar` (text)
    - `status_programa` (text) - Only for some programs

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read their allowed data
    - Add policies for authenticated users to insert/update/delete
*/

-- Azul Members Table
CREATE TABLE IF NOT EXISTS azul_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'Azul',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE azul_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view azul members"
  ON azul_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert azul members"
  ON azul_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update azul members"
  ON azul_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete azul members"
  ON azul_membros FOR DELETE
  TO authenticated
  USING (true);

-- Livelo Members Table
CREATE TABLE IF NOT EXISTS livelo_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'Livelo',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE livelo_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view livelo members"
  ON livelo_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert livelo members"
  ON livelo_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update livelo members"
  ON livelo_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete livelo members"
  ON livelo_membros FOR DELETE
  TO authenticated
  USING (true);

-- TAP Members Table
CREATE TABLE IF NOT EXISTS tap_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'TAP',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tap_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tap members"
  ON tap_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert tap members"
  ON tap_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tap members"
  ON tap_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete tap members"
  ON tap_membros FOR DELETE
  TO authenticated
  USING (true);

-- Accor Members Table
CREATE TABLE IF NOT EXISTS accor_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'Accor',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accor_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accor members"
  ON accor_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert accor members"
  ON accor_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update accor members"
  ON accor_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete accor members"
  ON accor_membros FOR DELETE
  TO authenticated
  USING (true);

-- KM Members Table
CREATE TABLE IF NOT EXISTS km_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'KM',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE km_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view km members"
  ON km_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert km members"
  ON km_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update km members"
  ON km_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete km members"
  ON km_membros FOR DELETE
  TO authenticated
  USING (true);

-- Pagol Members Table
CREATE TABLE IF NOT EXISTS pagol_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'Pagol',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pagol_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pagol members"
  ON pagol_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert pagol members"
  ON pagol_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update pagol members"
  ON pagol_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete pagol members"
  ON pagol_membros FOR DELETE
  TO authenticated
  USING (true);

-- Esfera Members Table
CREATE TABLE IF NOT EXISTS esfera_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'Esfera',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE esfera_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view esfera members"
  ON esfera_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert esfera members"
  ON esfera_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update esfera members"
  ON esfera_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete esfera members"
  ON esfera_membros FOR DELETE
  TO authenticated
  USING (true);

-- Hotmilhas Members Table
CREATE TABLE IF NOT EXISTS hotmilhas_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'Hotmilhas',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hotmilhas_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hotmilhas members"
  ON hotmilhas_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert hotmilhas members"
  ON hotmilhas_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update hotmilhas members"
  ON hotmilhas_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete hotmilhas members"
  ON hotmilhas_membros FOR DELETE
  TO authenticated
  USING (true);

-- Coopera Members Table
CREATE TABLE IF NOT EXISTS coopera_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'Coopera',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coopera_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view coopera members"
  ON coopera_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert coopera members"
  ON coopera_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update coopera members"
  ON coopera_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete coopera members"
  ON coopera_membros FOR DELETE
  TO authenticated
  USING (true);

-- GOv Members Table
CREATE TABLE IF NOT EXISTS gov_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text DEFAULT '',
  parceiro_id uuid REFERENCES parceiros(id),
  nome_parceiro text DEFAULT '',
  telefone text DEFAULT '',
  dt_nasc date,
  cpf text DEFAULT '',
  rg text DEFAULT '',
  email text DEFAULT '',
  idade integer DEFAULT 0,
  programa text DEFAULT 'GOv',
  n_fidelidade text DEFAULT '',
  senha text DEFAULT '',
  conta_familia text DEFAULT '',
  data_exclusao_cf date,
  clube text DEFAULT '',
  cartao text DEFAULT '',
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric DEFAULT 0,
  tempo_clube_mes integer DEFAULT 0,
  liminar text DEFAULT '',
  atualizado_em timestamptz DEFAULT now(),
  obs text DEFAULT '',
  parceiro_fornecedor text DEFAULT '',
  status_conta text DEFAULT '',
  status_restricao text DEFAULT '',
  conferente text DEFAULT '',
  ultima_data_conferencia date,
  grupo_liminar text DEFAULT '',
  status_programa text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gov_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gov members"
  ON gov_membros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert gov members"
  ON gov_membros FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update gov members"
  ON gov_membros FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete gov members"
  ON gov_membros FOR DELETE
  TO authenticated
  USING (true);