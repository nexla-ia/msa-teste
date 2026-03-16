/*
  # Adicionar campo destino_programa_id na tabela transferencia_pessoas

  1. Alterações
    - Adiciona coluna `destino_programa_id` para armazenar o programa do parceiro destino
    - Campo permite que origem e destino tenham programas diferentes

  2. Notas
    - Campo é opcional para manter compatibilidade com dados existentes
    - Permite transferências entre programas diferentes
*/

-- Adicionar campo destino_programa_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transferencia_pessoas' AND column_name = 'destino_programa_id'
  ) THEN
    ALTER TABLE transferencia_pessoas 
    ADD COLUMN destino_programa_id uuid REFERENCES programas_fidelidade(id);
  END IF;
END $$;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_transferencia_pessoas_destino_programa 
  ON transferencia_pessoas(destino_programa_id);