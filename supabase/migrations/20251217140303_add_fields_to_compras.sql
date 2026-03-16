/*
  # Add new fields to compras table

  1. Changes
    - Add data_limite_bonus field
    - Add bonus field (if not exists)
    - Add status field with constraint (Pendente/Concluído)
    - Add forma_pagamento field with constraint (Cartão/Pix)
    - Add quantidade_parcelas field
    - Add classificacao_contabil_id with foreign key
    - Update tipo field to include new options
    - Add total_pontos calculated field

  2. Security
    - Maintains existing RLS policies
*/

-- Add new columns to compras table
DO $$
BEGIN
  -- Add data_limite_bonus
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'data_limite_bonus'
  ) THEN
    ALTER TABLE compras ADD COLUMN data_limite_bonus date;
  END IF;

  -- Add bonus (if doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'bonus'
  ) THEN
    ALTER TABLE compras ADD COLUMN bonus decimal(15,2) DEFAULT 0;
  END IF;

  -- Add status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'status'
  ) THEN
    ALTER TABLE compras ADD COLUMN status text DEFAULT 'Pendente' NOT NULL;
  END IF;

  -- Add forma_pagamento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE compras ADD COLUMN forma_pagamento text;
  END IF;

  -- Add quantidade_parcelas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'quantidade_parcelas'
  ) THEN
    ALTER TABLE compras ADD COLUMN quantidade_parcelas integer DEFAULT 1;
  END IF;

  -- Add classificacao_contabil_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'classificacao_contabil_id'
  ) THEN
    ALTER TABLE compras ADD COLUMN classificacao_contabil_id uuid;
  END IF;

  -- Add total_pontos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'total_pontos'
  ) THEN
    ALTER TABLE compras ADD COLUMN total_pontos decimal(15,2) DEFAULT 0;
  END IF;
END $$;

-- Drop existing constraints if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'compras_status_check'
  ) THEN
    ALTER TABLE compras DROP CONSTRAINT compras_status_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'compras_forma_pagamento_check'
  ) THEN
    ALTER TABLE compras DROP CONSTRAINT compras_forma_pagamento_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'compras_tipo_check'
  ) THEN
    ALTER TABLE compras DROP CONSTRAINT compras_tipo_check;
  END IF;
END $$;

-- Add check constraints
ALTER TABLE compras ADD CONSTRAINT compras_status_check 
  CHECK (status IN ('Pendente', 'Concluído'));

ALTER TABLE compras ADD CONSTRAINT compras_forma_pagamento_check 
  CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('Cartão', 'Pix'));

ALTER TABLE compras ADD CONSTRAINT compras_tipo_check 
  CHECK (tipo IN (
    'Compra de Pontos/Milhas',
    'Compra Bonificada',
    'Transferência entre Contas',
    'Assinatura de Clube',
    'Intermediação',
    'Bônus Cartão',
    'Ajuste de Saldo'
  ));

-- Add foreign key to classificacao_contabil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'compras_classificacao_contabil_id_fkey'
  ) THEN
    ALTER TABLE compras ADD CONSTRAINT compras_classificacao_contabil_id_fkey
      FOREIGN KEY (classificacao_contabil_id) REFERENCES classificacao_contabil(id);
  END IF;
END $$;

-- Create or replace function to calculate total_pontos
CREATE OR REPLACE FUNCTION calculate_total_pontos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_pontos := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_calculate_total_pontos ON compras;
CREATE TRIGGER trigger_calculate_total_pontos
  BEFORE INSERT OR UPDATE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_pontos();
