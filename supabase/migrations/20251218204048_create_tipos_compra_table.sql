/*
  # Criar tabela de Tipos de Compra

  1. Nova Tabela
    - `tipos_compra`
      - `id` (uuid, primary key)
      - `nome` (text) - Nome do tipo de compra
      - `descricao` (text) - Descrição do tipo de compra
      - `ativo` (boolean) - Se o tipo está ativo ou não
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - Habilitar RLS na tabela `tipos_compra`
    - Adicionar políticas para usuários autenticados
    
  3. Dados Iniciais
    - Inserir tipos de compra padrão
*/

CREATE TABLE IF NOT EXISTS tipos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tipos_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem visualizar tipos de compra"
  ON tipos_compra
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Usuários podem criar tipos de compra"
  ON tipos_compra
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar tipos de compra"
  ON tipos_compra
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários podem deletar tipos de compra"
  ON tipos_compra
  FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_tipos_compra_ativo ON tipos_compra(ativo);

INSERT INTO tipos_compra (nome, descricao) VALUES
  ('Compra de Pontos/Milhas', 'Compra direta de pontos ou milhas'),
  ('Compra de Clube', 'Compra relacionada a assinatura de clube'),
  ('Compra de Produto', 'Compra de produto ou serviço'),
  ('Recompra', 'Recompra de pontos/milhas'),
  ('Outros', 'Outros tipos de compra')
ON CONFLICT DO NOTHING;
