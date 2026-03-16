/*
  # Add Bank Account Fields to Clientes Table

  1. Changes
    - Add `banco` (text) - Bank name
    - Add `agencia` (text) - Branch number
    - Add `tipo_conta` (text) - Account type (Corrente/Poupança)
    - Add `numero_conta` (text) - Account number
    - Add `pix` (text) - PIX key

  2. Notes
    - All fields are optional (nullable)
    - Fields will store formatted data (with masks)
*/

DO $$
BEGIN
  -- Add banco column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'banco'
  ) THEN
    ALTER TABLE clientes ADD COLUMN banco text;
  END IF;

  -- Add agencia column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'agencia'
  ) THEN
    ALTER TABLE clientes ADD COLUMN agencia text;
  END IF;

  -- Add tipo_conta column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'tipo_conta'
  ) THEN
    ALTER TABLE clientes ADD COLUMN tipo_conta text;
  END IF;

  -- Add numero_conta column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'numero_conta'
  ) THEN
    ALTER TABLE clientes ADD COLUMN numero_conta text;
  END IF;

  -- Add pix column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'pix'
  ) THEN
    ALTER TABLE clientes ADD COLUMN pix text;
  END IF;
END $$;
