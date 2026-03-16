/*
  # Adicionar Tipo de Cliente e Campos para Ordem de Compra

  1. Alterações na tabela vendas
    - `tipo_cliente` (text) - Tipo: 'cliente_final', 'agencia_convencional', 'agencia_grande'
    - `ordem_compra` (text) - Código da Ordem de Compra (para agências grandes)
    - `estoque_reservado` (boolean) - Se o estoque está apenas reservado (não baixado)
    - `quantidade_reservada` (numeric) - Quantidade de milhas reservadas

  2. Alterações na tabela localizadores
    - `valor_total` (numeric) - Valor total do localizador
    - `forma_pagamento` (text) - Forma de pagamento do localizador
    - `parcelas` (integer) - Número de parcelas
    - `valor_pago` (numeric) - Valor já pago deste localizador
    - `saldo_restante` (numeric) - Saldo restante a pagar

  3. Notas
    - tipo_cliente define como o estoque será tratado
    - ordem_compra é usada para agências grandes
    - localizadores agora podem ter valores independentes
*/

-- Adicionar campos na tabela vendas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'tipo_cliente'
  ) THEN
    ALTER TABLE vendas ADD COLUMN tipo_cliente text DEFAULT 'cliente_final' 
      CHECK (tipo_cliente IN ('cliente_final', 'agencia_convencional', 'agencia_grande'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'ordem_compra'
  ) THEN
    ALTER TABLE vendas ADD COLUMN ordem_compra text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'estoque_reservado'
  ) THEN
    ALTER TABLE vendas ADD COLUMN estoque_reservado boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'quantidade_reservada'
  ) THEN
    ALTER TABLE vendas ADD COLUMN quantidade_reservada numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar campos na tabela localizadores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'localizadores' AND column_name = 'valor_total'
  ) THEN
    ALTER TABLE localizadores ADD COLUMN valor_total numeric(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'localizadores' AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE localizadores ADD COLUMN forma_pagamento text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'localizadores' AND column_name = 'parcelas'
  ) THEN
    ALTER TABLE localizadores ADD COLUMN parcelas integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'localizadores' AND column_name = 'valor_pago'
  ) THEN
    ALTER TABLE localizadores ADD COLUMN valor_pago numeric(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'localizadores' AND column_name = 'saldo_restante'
  ) THEN
    ALTER TABLE localizadores ADD COLUMN saldo_restante numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_vendas_tipo_cliente ON vendas(tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_vendas_ordem_compra ON vendas(ordem_compra);
CREATE INDEX IF NOT EXISTS idx_localizadores_status ON localizadores(status);
