/*
  # Adicionar campos de comissão à tabela programas_clubes

  1. Alterações
    - Adicionar coluna `tem_comissao` (boolean) - indica se há comissão
    - Adicionar coluna `comissao_tipo` (text) - tipo de comissão: 'porcentagem' ou 'real'
    - Adicionar coluna `comissao_valor` (numeric) - valor da comissão (porcentagem ou valor em reais)

  2. Valores Padrão
    - `tem_comissao` tem valor padrão false
    - Comissão só é aplicável quando tem_comissao = true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programas_clubes' AND column_name = 'tem_comissao'
  ) THEN
    ALTER TABLE programas_clubes ADD COLUMN tem_comissao boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programas_clubes' AND column_name = 'comissao_tipo'
  ) THEN
    ALTER TABLE programas_clubes ADD COLUMN comissao_tipo text CHECK (comissao_tipo IN ('porcentagem', 'real'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programas_clubes' AND column_name = 'comissao_valor'
  ) THEN
    ALTER TABLE programas_clubes ADD COLUMN comissao_valor numeric(10, 2);
  END IF;
END $$;
