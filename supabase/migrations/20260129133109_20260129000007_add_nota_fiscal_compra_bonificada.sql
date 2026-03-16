/*
  # Adicionar nota fiscal em compra bonificada

  1. Descrição
    - Adiciona campo para número da nota fiscal
    - Adiciona campo para arquivo da nota fiscal (URL ou caminho)

  2. Mudanças
    - Adiciona coluna nota_fiscal_numero
    - Adiciona coluna nota_fiscal_arquivo
*/

-- Adicionar campos de nota fiscal
ALTER TABLE compra_bonificada
ADD COLUMN IF NOT EXISTS nota_fiscal_numero text,
ADD COLUMN IF NOT EXISTS nota_fiscal_arquivo text;

COMMENT ON COLUMN compra_bonificada.nota_fiscal_numero IS 'Número da nota fiscal';
COMMENT ON COLUMN compra_bonificada.nota_fiscal_arquivo IS 'URL ou caminho do arquivo da nota fiscal';
