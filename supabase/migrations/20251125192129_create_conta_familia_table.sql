/*
  # Criar tabela Conta Família

  1. Nova Tabela
    - `conta_familia`
      - `id` (uuid, chave primária)
      - `id_conta_familia` (text, chave de referência única, obrigatória)
      - `cliente_id` (uuid, FK para clientes, obrigatório)
      - `parceiro_id` (uuid, FK para parceiros, obrigatório)
      - `data_vinculo` (date, data do vínculo, padrão hoje)
      - `status` (text, status da conta: Ativa/Inativa, padrão Ativa)
      - `obs` (text, observações)
      - `created_at` (timestamp, data de criação)
      - `updated_at` (timestamp, data de atualização)

  2. Segurança
    - Habilitar RLS na tabela `conta_familia`
    - Criar políticas para permitir operações CRUD para usuários autenticados
    - Garantir integridade referencial com clientes e parceiros

  3. Índices
    - Índice na coluna `cliente_id` para otimizar buscas
    - Índice na coluna `parceiro_id` para otimizar buscas
    - Índice único na coluna `id_conta_familia`
*/

-- Criar tabela conta_familia
CREATE TABLE IF NOT EXISTS conta_familia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_conta_familia text UNIQUE NOT NULL,
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  data_vinculo date DEFAULT CURRENT_DATE,
  status text DEFAULT 'Ativa' CHECK (status IN ('Ativa', 'Inativa')),
  obs text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índices para otimização de busca
CREATE INDEX IF NOT EXISTS idx_conta_familia_cliente ON conta_familia(cliente_id);
CREATE INDEX IF NOT EXISTS idx_conta_familia_parceiro ON conta_familia(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_conta_familia_id_conta ON conta_familia(id_conta_familia);

-- Habilitar RLS
ALTER TABLE conta_familia ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para conta_familia
CREATE POLICY "Users can view all conta_familia"
  ON conta_familia FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert conta_familia"
  ON conta_familia FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update conta_familia"
  ON conta_familia FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete conta_familia"
  ON conta_familia FOR DELETE
  TO authenticated
  USING (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conta_familia_updated_at
  BEFORE UPDATE ON conta_familia
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
