/*
  # Adicionar coluna valor à tabela atividades

  ## Problema
  As funções de clube tentam gravar o valor da mensalidade na tabela atividades,
  mas a coluna não existe.

  ## Solução
  Adiciona a coluna valor (decimal) na tabela atividades para armazenar o valor
  associado à atividade (ex: valor da mensalidade do clube).
*/

-- Adicionar coluna valor se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'atividades' 
    AND column_name = 'valor'
  ) THEN
    ALTER TABLE atividades ADD COLUMN valor decimal(15, 2);
  END IF;
END $$;

COMMENT ON COLUMN atividades.valor IS 
'Valor monetário associado à atividade (ex: mensalidade do clube, valor de compra, etc.)';