/*
  # Criar tabela Transferência entre Pessoas

  1. Nova Tabela
    - `transferencia_pessoas`
      - `id` (uuid, primary key)
      - `data_transferencia` (date) - Data da transferência
      - `programa_id` (uuid) - Programa de fidelidade
      - `origem_parceiro_id` (uuid) - Parceiro que está enviando os pontos
      - `destino_parceiro_id` (uuid) - Parceiro que está recebendo os pontos
      - `quantidade` (numeric) - Quantidade de pontos transferidos
      - `data_recebimento` (date) - Data de recebimento dos pontos
      - `bonus_percentual` (numeric) - Percentual de bônus
      - `quantidade_bonus` (numeric) - Quantidade de bônus
      - `data_recebimento_bonus` (date) - Data de recebimento do bônus
      - `custo_transferencia` (numeric) - Custo da transferência
      - `forma_pagamento` (text) - Forma de pagamento (credito, debito, pix, etc)
      - `conta_bancaria_id` (uuid) - Conta bancária usada
      - `cartao_id` (uuid) - Cartão de crédito usado
      - `parcelas` (integer) - Número de parcelas
      - `observacao` (text) - Observações
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid)

  2. Segurança
    - Habilitar RLS
    - Políticas para usuários autenticados

  3. Importantes
    - Trigger para atualizar estoque_pontos
    - Validação para não transferir para a mesma pessoa
    - Validação de saldo disponível
*/

-- Criar tabela transferencia_pessoas
CREATE TABLE IF NOT EXISTS transferencia_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_transferencia date NOT NULL,
  programa_id uuid NOT NULL REFERENCES programas_fidelidade(id),
  origem_parceiro_id uuid NOT NULL REFERENCES parceiros(id),
  destino_parceiro_id uuid NOT NULL REFERENCES parceiros(id),
  quantidade numeric(15,2) NOT NULL DEFAULT 0,
  data_recebimento date NOT NULL,
  bonus_percentual numeric(5,2) DEFAULT 0,
  quantidade_bonus numeric(15,2) DEFAULT 0,
  data_recebimento_bonus date,
  custo_transferencia numeric(10,2) DEFAULT 0,
  forma_pagamento text,
  conta_bancaria_id uuid REFERENCES contas_bancarias(id),
  cartao_id uuid REFERENCES cartoes_credito(id),
  parcelas integer DEFAULT 1,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES usuarios(id),
  CONSTRAINT check_origem_destino_diferente CHECK (origem_parceiro_id != destino_parceiro_id)
);

-- Habilitar RLS
ALTER TABLE transferencia_pessoas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem visualizar transferências entre pessoas"
  ON transferencia_pessoas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir transferências entre pessoas"
  ON transferencia_pessoas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar transferências entre pessoas"
  ON transferencia_pessoas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar transferências entre pessoas"
  ON transferencia_pessoas FOR DELETE
  TO authenticated
  USING (true);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_transferencia_pessoas_origem ON transferencia_pessoas(origem_parceiro_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_pessoas_destino ON transferencia_pessoas(destino_parceiro_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_pessoas_programa ON transferencia_pessoas(programa_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_pessoas_data ON transferencia_pessoas(data_transferencia);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_transferencia_pessoas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transferencia_pessoas_updated_at
  BEFORE UPDATE ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION update_transferencia_pessoas_updated_at();

-- Função para processar transferência entre pessoas (atualiza estoque)
CREATE OR REPLACE FUNCTION process_transferencia_pessoas()
RETURNS TRIGGER AS $$
DECLARE
  v_origem_estoque_id uuid;
  v_destino_estoque_id uuid;
  v_origem_saldo numeric;
  v_origem_custo_medio numeric;
  v_destino_saldo numeric;
  v_destino_custo_medio numeric;
  v_novo_saldo_destino numeric;
  v_novo_custo_medio numeric;
BEGIN
  -- Buscar estoque da origem
  SELECT id, saldo_atual, custo_medio INTO v_origem_estoque_id, v_origem_saldo, v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

  -- Validar se origem tem saldo suficiente
  IF v_origem_saldo < NEW.quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no estoque de origem';
  END IF;

  -- Buscar ou criar estoque do destino
  SELECT id, saldo_atual, custo_medio INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.destino_parceiro_id AND programa_id = NEW.programa_id;

  IF v_destino_estoque_id IS NULL THEN
    -- Criar estoque para o destino
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
    VALUES (NEW.destino_parceiro_id, NEW.programa_id, 0, 0)
    RETURNING id, saldo_atual, custo_medio INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio;
  END IF;

  -- Atualizar estoque de origem (diminuir)
  UPDATE estoque_pontos
  SET saldo_atual = saldo_atual - NEW.quantidade,
      updated_at = now()
  WHERE id = v_origem_estoque_id;

  -- Calcular novo custo médio do destino
  v_novo_saldo_destino := v_destino_saldo + NEW.quantidade;
  v_novo_custo_medio := ((v_destino_saldo * v_destino_custo_medio) + (NEW.quantidade * v_origem_custo_medio)) / v_novo_saldo_destino;

  -- Atualizar estoque de destino (aumentar)
  UPDATE estoque_pontos
  SET saldo_atual = v_novo_saldo_destino,
      custo_medio = v_novo_custo_medio,
      updated_at = now()
  WHERE id = v_destino_estoque_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar transferência entre pessoas
CREATE TRIGGER trigger_process_transferencia_pessoas
  AFTER INSERT ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION process_transferencia_pessoas();