/*
  # Corrigir constraint de tipo em compras

  1. Descrição
    - Remove constraint que restringe valores específicos no campo tipo
    - Permite valores dinâmicos vindos da tabela tipos_compra

  2. Mudanças
    - Remove compras_tipo_check se existir
    - Garante que tipo não pode ser vazio ou nulo
*/

-- Remover constraint antiga se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'CHECK' 
    AND table_name = 'compras'
    AND constraint_name = 'compras_tipo_check'
  ) THEN
    ALTER TABLE compras DROP CONSTRAINT compras_tipo_check;
  END IF;
END $$;

-- Garantir que tipo não é vazio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'CHECK' 
    AND table_name = 'compras'
    AND constraint_name = 'compras_tipo_not_empty'
  ) THEN
    ALTER TABLE compras ADD CONSTRAINT compras_tipo_not_empty 
    CHECK (tipo IS NOT NULL AND TRIM(tipo) <> '');
  END IF;
END $$;
