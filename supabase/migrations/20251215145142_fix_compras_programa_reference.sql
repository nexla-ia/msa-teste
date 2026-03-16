/*
  # Fix Compras Table Program Reference

  1. Changes
    - Drop existing foreign key constraint for programa_id referencing programas table
    - Add new foreign key constraint for programa_id referencing programas_fidelidade table

  2. Notes
    - This fixes the reference to use the correct loyalty programs table
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'compras_programa_id_fkey'
    AND table_name = 'compras'
  ) THEN
    ALTER TABLE compras DROP CONSTRAINT compras_programa_id_fkey;
  END IF;

  ALTER TABLE compras 
    ADD CONSTRAINT compras_programa_id_fkey 
    FOREIGN KEY (programa_id) 
    REFERENCES programas_fidelidade(id) 
    ON DELETE CASCADE;
END $$;
