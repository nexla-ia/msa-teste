/*
  # Corrigir constraint de ID_Parceiro

  Ajusta a constraint de unicidade do campo id_parceiro para permitir valores NULL,
  já que o campo é opcional (definido pelo usuário).

  ## Mudanças
  
  - Remove constraint de unicidade simples
  - Adiciona constraint de unicidade parcial (apenas quando não é NULL)
*/

-- Remover constraint antiga se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'parceiros_chave_referencia_key'
  ) THEN
    ALTER TABLE parceiros DROP CONSTRAINT parceiros_chave_referencia_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'parceiros_id_parceiro_key'
  ) THEN
    ALTER TABLE parceiros DROP CONSTRAINT parceiros_id_parceiro_key;
  END IF;
END $$;

-- Criar constraint de unicidade parcial (apenas valores não-nulos)
DROP INDEX IF EXISTS idx_parceiros_id_parceiro;
CREATE UNIQUE INDEX IF NOT EXISTS idx_parceiros_id_parceiro_unique 
  ON parceiros(id_parceiro) 
  WHERE id_parceiro IS NOT NULL AND id_parceiro != '';
