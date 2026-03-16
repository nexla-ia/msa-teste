/*
  # Create Latam Program

  1. New Records
    - Insert 'Latam' program into programas_fidelidade table
  
  2. Notes
    - This migration adds the Latam loyalty program
    - The programa_id will be used to link members to this program
    - Uses the same programas_membros table as Smiles
*/

-- Insert Latam program
INSERT INTO programas_fidelidade (programa, nome)
VALUES ('Latam', 'Latam Pass')
ON CONFLICT DO NOTHING;
