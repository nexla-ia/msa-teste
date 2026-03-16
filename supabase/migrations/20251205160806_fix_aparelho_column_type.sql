/*
  # Fix aparelho column type in programas_clubes table

  1. Changes
    - Change `aparelho` column from integer to text to store device names
  
  2. Notes
    - This fixes the error when trying to save device names like "iphone, android"
    - The column should store text values, not integers
*/

DO $$
BEGIN
  -- Change aparelho column type from integer to text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programas_clubes' 
    AND column_name = 'aparelho'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE programas_clubes 
    ALTER COLUMN aparelho TYPE text USING aparelho::text;
  END IF;
END $$;
