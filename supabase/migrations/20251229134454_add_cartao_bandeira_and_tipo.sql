/*
  # Melhorias em Cartões de Crédito

  ## 1. Novo Campo: bandeira
  Adiciona campo para identificar a bandeira do cartão:
  - Visa
  - Mastercard
  - Amex
  - Elo
  - Hipercard
  - Diners Club
  - Outros

  ## 2. Novo Campo: tipo_cartao
  Identifica se o cartão é:
  - principal: Cartão principal da conta
  - adicional: Cartão adicional vinculado ao principal
  - virtual: Cartão virtual

  ## 3. Novo Campo: cartao_principal_id
  Para cartões adicionais/virtuais, referência ao cartão principal

  ## 4. Segurança
  - Mantém RLS existente
*/

-- Adicionar campo bandeira
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoes_credito' AND column_name = 'bandeira'
  ) THEN
    ALTER TABLE cartoes_credito 
    ADD COLUMN bandeira text CHECK (bandeira IN (
      'Visa',
      'Mastercard',
      'Amex',
      'Elo',
      'Hipercard',
      'Diners Club',
      'Outros'
    ));
  END IF;
END $$;

-- Adicionar campo tipo_cartao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoes_credito' AND column_name = 'tipo_cartao'
  ) THEN
    ALTER TABLE cartoes_credito 
    ADD COLUMN tipo_cartao text DEFAULT 'principal' CHECK (tipo_cartao IN (
      'principal',
      'adicional',
      'virtual'
    ));
  END IF;
END $$;

-- Adicionar campo cartao_principal_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoes_credito' AND column_name = 'cartao_principal_id'
  ) THEN
    ALTER TABLE cartoes_credito 
    ADD COLUMN cartao_principal_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_cartoes_credito_principal ON cartoes_credito(cartao_principal_id);

-- Atualizar cartões existentes para tipo principal se não especificado
UPDATE cartoes_credito
SET tipo_cartao = 'principal'
WHERE tipo_cartao IS NULL;
