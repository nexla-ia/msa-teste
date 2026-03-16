/*
  # Adicionar tabela de Bancos e relacionamentos

  Esta migration cria uma tabela de bancos e adiciona relacionamentos entre tabelas:

  1. **Nova Tabela: bancos**
     - `id` (uuid, primary key)
     - `nome` (text) - Nome do banco
     - `codigo` (text) - Código do banco (ex: 001, 237, etc)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. **Relacionamentos Adicionados**
     - `cartoes_credito.banco_emissor_id` -> referencia `bancos.id`
     - `contas_bancarias.banco_id` -> referencia `bancos.id`

  3. **Segurança**
     - RLS habilitado em bancos
     - Políticas para usuários autenticados

  ## Mudanças

  ### Tabela bancos:
  - Criar tabela com campos básicos
  - Habilitar RLS
  - Adicionar políticas de acesso

  ### Alterações em cartoes_credito:
  - Adicionar coluna banco_emissor_id (uuid)
  - Manter coluna banco_emissor (text) temporariamente para não perder dados
  - Adicionar foreign key para bancos

  ### Alterações em contas_bancarias:
  - Adicionar coluna banco_id (uuid)
  - Manter coluna nome_banco (text) temporariamente
  - Adicionar foreign key para bancos
*/

-- Criar tabela de bancos
CREATE TABLE IF NOT EXISTS bancos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE bancos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para bancos
CREATE POLICY "Authenticated users can read bancos"
  ON bancos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ADM can insert bancos"
  ON bancos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can update bancos"
  ON bancos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete bancos"
  ON bancos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND nivel_acesso = 'ADM'
    )
  );

-- Adicionar coluna banco_emissor_id em cartoes_credito
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoes_credito' AND column_name = 'banco_emissor_id'
  ) THEN
    ALTER TABLE cartoes_credito ADD COLUMN banco_emissor_id uuid;
  END IF;
END $$;

-- Adicionar coluna banco_id em contas_bancarias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contas_bancarias' AND column_name = 'banco_id'
  ) THEN
    ALTER TABLE contas_bancarias ADD COLUMN banco_id uuid;
  END IF;
END $$;

-- Adicionar foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cartoes_credito_banco_emissor_id_fkey'
  ) THEN
    ALTER TABLE cartoes_credito
    ADD CONSTRAINT cartoes_credito_banco_emissor_id_fkey
    FOREIGN KEY (banco_emissor_id)
    REFERENCES bancos(id)
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contas_bancarias_banco_id_fkey'
  ) THEN
    ALTER TABLE contas_bancarias
    ADD CONSTRAINT contas_bancarias_banco_id_fkey
    FOREIGN KEY (banco_id)
    REFERENCES bancos(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_cartoes_credito_banco_emissor_id ON cartoes_credito(banco_emissor_id);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_banco_id ON contas_bancarias(banco_id);

-- Inserir alguns bancos comuns brasileiros
INSERT INTO bancos (nome, codigo) VALUES
  ('Banco do Brasil', '001'),
  ('Bradesco', '237'),
  ('Caixa Econômica Federal', '104'),
  ('Itaú Unibanco', '341'),
  ('Santander', '033'),
  ('Nubank', '260'),
  ('Inter', '077'),
  ('C6 Bank', '336'),
  ('BTG Pactual', '208'),
  ('Safra', '422'),
  ('Sicoob', '756'),
  ('Sicredi', '748'),
  ('Banco Original', '212'),
  ('Banco Pan', '623'),
  ('Banrisul', '041')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE bancos IS 'Cadastro de bancos para relacionamento com cartões e contas bancárias';
