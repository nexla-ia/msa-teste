/*
  # Add Expiration Fields to Cartoes Credito Table

  1. Changes
    - Add `mes_expiracao` (integer) - Expiration month (1-12)
    - Add `ano_expiracao` (integer) - Expiration year (e.g., 2025)

  2. Notes
    - Both fields are optional (nullable)
    - Values will be validated in the application to ensure valid months and years
    - Application will prevent usage of expired cards
*/

DO $$
BEGIN
  -- Add mes_expiracao column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoes_credito' AND column_name = 'mes_expiracao'
  ) THEN
    ALTER TABLE cartoes_credito ADD COLUMN mes_expiracao integer;
  END IF;

  -- Add ano_expiracao column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoes_credito' AND column_name = 'ano_expiracao'
  ) THEN
    ALTER TABLE cartoes_credito ADD COLUMN ano_expiracao integer;
  END IF;

  -- Add check constraint to ensure mes_expiracao is between 1 and 12
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'cartoes_credito' AND constraint_name = 'cartoes_credito_mes_expiracao_check'
  ) THEN
    ALTER TABLE cartoes_credito ADD CONSTRAINT cartoes_credito_mes_expiracao_check CHECK (mes_expiracao >= 1 AND mes_expiracao <= 12);
  END IF;

  -- Add check constraint to ensure ano_expiracao is reasonable (2000-2099)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'cartoes_credito' AND constraint_name = 'cartoes_credito_ano_expiracao_check'
  ) THEN
    ALTER TABLE cartoes_credito ADD CONSTRAINT cartoes_credito_ano_expiracao_check CHECK (ano_expiracao >= 2000 AND ano_expiracao <= 2099);
  END IF;
END $$;
