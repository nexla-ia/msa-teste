/*
  # Adicionar campo origem_bonus à tabela compras

  1. Alterações
    - Adicionar coluna `origem_bonus` (text) à tabela `compras`
    - Campo permite registrar informações sobre a origem do bônus recebido
    - Campo é opcional (nullable)

  2. Notas
    - Campo de texto livre para descrever a origem do bônus
    - Útil para rastreabilidade e auditoria
*/

-- Adicionar coluna origem_bonus
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name = 'origem_bonus'
  ) THEN
    ALTER TABLE compras ADD COLUMN origem_bonus text;
  END IF;
END $$;