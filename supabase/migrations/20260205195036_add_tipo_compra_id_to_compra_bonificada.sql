/*
  # Adicionar campo tipo_compra_id à tabela compra_bonificada
  
  ## Alterações
  1. Adicionar coluna tipo_compra_id
     - Referência para tipos_compra
     - Nullable (opcional)
     - Permite categorizar compras bonificadas
  
  ## Segurança
  - Mantém RLS existente
  - Foreign key com ON DELETE SET NULL para não bloquear exclusão de tipos
*/

-- Adicionar coluna tipo_compra_id
ALTER TABLE compra_bonificada 
ADD COLUMN IF NOT EXISTS tipo_compra_id uuid;

-- Adicionar foreign key
ALTER TABLE compra_bonificada
ADD CONSTRAINT compra_bonificada_tipo_compra_id_fkey 
FOREIGN KEY (tipo_compra_id) 
REFERENCES tipos_compra(id) 
ON DELETE SET NULL;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_compra_bonificada_tipo_compra_id 
ON compra_bonificada(tipo_compra_id);

COMMENT ON COLUMN compra_bonificada.tipo_compra_id IS 
'Tipo/categoria da compra bonificada (referência para tipos_compra)';
