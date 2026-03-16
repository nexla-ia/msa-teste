/*
  # Fix compra_bonificada foreign key constraint

  1. Changes
    - Drop the old constraint "compra_bonificada_cliente_id_fkey" that references clientes table
    - Add new constraint "compra_bonificada_parceiro_id_fkey" that references parceiros table
    - This fixes the issue where parceiro_id was incorrectly referencing clientes instead of parceiros

  2. Security
    - Maintains existing RLS policies
*/

ALTER TABLE compra_bonificada
DROP CONSTRAINT IF EXISTS compra_bonificada_cliente_id_fkey;

ALTER TABLE compra_bonificada
ADD CONSTRAINT compra_bonificada_parceiro_id_fkey
FOREIGN KEY (parceiro_id) REFERENCES parceiros(id) ON DELETE RESTRICT;