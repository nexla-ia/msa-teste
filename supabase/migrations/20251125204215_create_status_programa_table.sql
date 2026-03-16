/*
  # Criar tabela de Status de Programa

  1. Nova Tabela
    - `status_programa`
      - `id` (uuid, primary key)
      - `chave_referencia` (text, unique, not null) - Identificador único do status
      - `status` (text, not null) - Nome/descrição do status
      - `created_at` (timestamptz) - Data de criação

  2. Segurança
    - Habilitar RLS na tabela
    - Adicionar políticas para permitir acesso completo (compatível com auth customizado)

  3. Dados Iniciais
    - Inserir alguns status padrão comumente usados em programas de fidelidade
*/

-- Criar tabela status_programa
CREATE TABLE IF NOT EXISTS status_programa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_referencia text UNIQUE NOT NULL,
  status text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE status_programa ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Allow all to view status_programa"
  ON status_programa FOR SELECT
  USING (true);

CREATE POLICY "Allow all to insert status_programa"
  ON status_programa FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all to update status_programa"
  ON status_programa FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all to delete status_programa"
  ON status_programa FOR DELETE
  USING (true);

-- Inserir status padrão
INSERT INTO status_programa (chave_referencia, status) VALUES
  ('ativo', 'Ativo'),
  ('inativo', 'Inativo'),
  ('bloqueado', 'Bloqueado'),
  ('pendente', 'Pendente'),
  ('suspenso', 'Suspenso'),
  ('em_analise', 'Em Análise')
ON CONFLICT (chave_referencia) DO NOTHING;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_status_programa_chave 
  ON status_programa(chave_referencia);
