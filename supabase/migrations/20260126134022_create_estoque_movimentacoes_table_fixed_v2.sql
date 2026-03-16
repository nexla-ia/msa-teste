/*
  # Criar tabela de movimentações do estoque

  Tabela para histórico de movimentações do estoque de pontos.
  Esta migration cria a tabela e as políticas RLS se não existirem.
*/

CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  programa_id uuid NOT NULL REFERENCES programas_fidelidade(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  quantidade decimal(15, 2) NOT NULL,
  saldo_anterior decimal(15, 2),
  saldo_posterior decimal(15, 2),
  custo_medio_anterior decimal(10, 4),
  custo_medio_posterior decimal(10, 4),
  valor_total decimal(15, 2),
  origem text,
  observacao text,
  referencia_id uuid,
  referencia_tabela text,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_parceiro ON estoque_movimentacoes(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_programa ON estoque_movimentacoes(programa_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_created_at ON estoque_movimentacoes(created_at);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_referencia ON estoque_movimentacoes(referencia_id, referencia_tabela);

-- Habilitar RLS
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Permitir leitura de movimentações" ON estoque_movimentacoes;
DROP POLICY IF EXISTS "Permitir inserção de movimentações" ON estoque_movimentacoes;
DROP POLICY IF EXISTS "Permitir atualização de movimentações" ON estoque_movimentacoes;

-- Criar novas políticas
CREATE POLICY "Permitir leitura de movimentações"
  ON estoque_movimentacoes
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir inserção de movimentações"
  ON estoque_movimentacoes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de movimentações"
  ON estoque_movimentacoes
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
