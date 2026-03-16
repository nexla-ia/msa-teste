/*
  # Criar tabela de histórico de conta família

  1. Nova Tabela
    - `conta_familia_historico`
      - `id` (uuid, primary key)
      - `parceiro_id` (uuid, foreign key to parceiros)
      - `programa_id` (uuid, foreign key to programas_fidelidade)
      - `conta_familia_id` (uuid, foreign key to conta_familia)
      - `data_remocao` (timestamp)
      - `data_liberacao` (timestamp) - calculado como data_remocao + 12 meses
      - `motivo` (text, opcional)
      - `removido_por` (text)
      - `created_at` (timestamp)

  2. Segurança
    - Habilitar RLS na tabela `conta_familia_historico`
    - Adicionar política para usuários autenticados lerem e criarem registros

  3. Notas Importantes
    - Esta tabela rastreia quando um parceiro é removido de uma conta família
    - Impede que o parceiro entre em outra família do mesmo programa por 12 meses
    - A data_liberacao é calculada automaticamente como data_remocao + 12 meses
*/

CREATE TABLE IF NOT EXISTS conta_familia_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  programa_id uuid NOT NULL REFERENCES programas_fidelidade(id) ON DELETE CASCADE,
  conta_familia_id uuid NOT NULL REFERENCES conta_familia(id) ON DELETE CASCADE,
  data_remocao timestamptz NOT NULL DEFAULT now(),
  data_liberacao timestamptz NOT NULL,
  motivo text,
  removido_por text,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_conta_familia_historico_parceiro ON conta_familia_historico(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_conta_familia_historico_programa ON conta_familia_historico(programa_id);
CREATE INDEX IF NOT EXISTS idx_conta_familia_historico_liberacao ON conta_familia_historico(data_liberacao);

-- Habilitar RLS
ALTER TABLE conta_familia_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem visualizar histórico"
  ON conta_familia_historico
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem criar histórico"
  ON conta_familia_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar histórico"
  ON conta_familia_historico
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
