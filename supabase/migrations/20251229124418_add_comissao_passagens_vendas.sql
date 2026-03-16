/*
  # Adicionar campos de comissão e controle de passagens

  1. Alterações na tabela vendas
    - Adiciona campos para controle de comissão:
      - `gerar_comissao` (boolean) - Se deve gerar comissão
      - `tipo_comissao` (text) - Tipo: não possui, sobre valor bruto, sobre lucro, fixo anual
      - `comissao_percentual` (numeric) - Percentual da comissão
      - `comissao_valor_fixo` (numeric) - Valor fixo da comissão
      - `comissao_valor_calculado` (numeric) - Valor calculado da comissão
      - `comissao_forma_pagamento` (text) - Forma de pagamento da comissão
      - `comissao_conta_bancaria_id` (uuid) - Conta bancária para pagamento
      - `localizador_pdf_url` (text) - URL do PDF do localizador
      - `cliente_id` (uuid) - Cliente relacionado à venda

  2. Nova tabela: passagens_emitidas
    - Controle de CPFs e passagens emitidas
    - Relacionada com vendas
    - Campos: data_emissao, cpfs, milhas, localizador, passageiro, cpf

  3. Segurança
    - RLS habilitado em passagens_emitidas
    - Políticas para authenticated users
*/

-- Adicionar campos de comissão e controle na tabela vendas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'gerar_comissao'
  ) THEN
    ALTER TABLE vendas ADD COLUMN gerar_comissao boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'tipo_comissao'
  ) THEN
    ALTER TABLE vendas ADD COLUMN tipo_comissao text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'comissao_percentual'
  ) THEN
    ALTER TABLE vendas ADD COLUMN comissao_percentual numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'comissao_valor_fixo'
  ) THEN
    ALTER TABLE vendas ADD COLUMN comissao_valor_fixo numeric(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'comissao_valor_calculado'
  ) THEN
    ALTER TABLE vendas ADD COLUMN comissao_valor_calculado numeric(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'comissao_forma_pagamento'
  ) THEN
    ALTER TABLE vendas ADD COLUMN comissao_forma_pagamento text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'comissao_conta_bancaria_id'
  ) THEN
    ALTER TABLE vendas ADD COLUMN comissao_conta_bancaria_id uuid REFERENCES contas_bancarias(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'localizador_pdf_url'
  ) THEN
    ALTER TABLE vendas ADD COLUMN localizador_pdf_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE vendas ADD COLUMN cliente_id uuid REFERENCES clientes(id);
  END IF;
END $$;

-- Criar tabela passagens_emitidas
CREATE TABLE IF NOT EXISTS passagens_emitidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  data_emissao date NOT NULL,
  cpfs integer NOT NULL DEFAULT 1,
  milhas numeric(15,2),
  localizador text,
  passageiro text,
  cpf text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE passagens_emitidas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para passagens_emitidas
CREATE POLICY "Users can view all passagens_emitidas"
  ON passagens_emitidas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert passagens_emitidas"
  ON passagens_emitidas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update passagens_emitidas"
  ON passagens_emitidas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete passagens_emitidas"
  ON passagens_emitidas FOR DELETE
  TO authenticated
  USING (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_passagens_emitidas_venda_id ON passagens_emitidas(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_comissao_conta ON vendas(comissao_conta_bancaria_id);