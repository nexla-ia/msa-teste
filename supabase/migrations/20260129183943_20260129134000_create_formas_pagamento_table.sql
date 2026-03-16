/*
  # Criar tabela de formas de pagamento

  1. Nova Tabela
    - `formas_pagamento`
      - `id` (uuid, primary key)
      - `nome` (text, obrigatório, único)
      - `descricao` (text, opcional)
      - `ativo` (boolean, padrão true)
      - `registrar_fluxo_caixa` (boolean, padrão true) - se deve ou não registrar no fluxo de caixa
      - `ordem` (integer, opcional) - para ordenação customizada
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - Habilitar RLS
    - Políticas para leitura e escrita

  3. Dados Iniciais
    - Inserir formas de pagamento padrão
*/

-- Criar tabela
CREATE TABLE IF NOT EXISTS formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  ativo boolean DEFAULT true NOT NULL,
  registrar_fluxo_caixa boolean DEFAULT true NOT NULL,
  ordem integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_ativo ON formas_pagamento(ativo);
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_ordem ON formas_pagamento(ordem);

-- Habilitar RLS
ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Permitir leitura de formas de pagamento"
  ON formas_pagamento
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir inserção de formas de pagamento"
  ON formas_pagamento
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de formas de pagamento"
  ON formas_pagamento
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão de formas de pagamento"
  ON formas_pagamento
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Inserir formas de pagamento padrão
INSERT INTO formas_pagamento (nome, descricao, registrar_fluxo_caixa, ordem)
VALUES 
  ('Não registrar no fluxo de caixa', 'Operações que não devem ser contabilizadas no fluxo de caixa', false, 1),
  ('Dinheiro', 'Pagamento em dinheiro', true, 2),
  ('PIX', 'Pagamento via PIX', true, 3),
  ('Débito', 'Pagamento com cartão de débito', true, 4),
  ('Crédito', 'Pagamento com cartão de crédito', true, 5),
  ('Transferência', 'Transferência bancária', true, 6)
ON CONFLICT (nome) DO NOTHING;

COMMENT ON TABLE formas_pagamento IS 'Formas de pagamento disponíveis no sistema';
COMMENT ON COLUMN formas_pagamento.registrar_fluxo_caixa IS 'Indica se essa forma de pagamento deve ser registrada no fluxo de caixa';
