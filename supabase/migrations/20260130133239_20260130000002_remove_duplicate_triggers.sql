/*
  # Remove Triggers Duplicados

  1. Problemas Identificados
    - Triggers duplicados em transferencia_pessoas causando processamento múltiplo
    - Triggers duplicados em vendas para prevenção de modificação
    - Risco de processar mesma operação mais de uma vez

  2. Correções
    - Remove triggers antigos duplicados em transferencia_pessoas
    - Remove triggers duplicados em vendas
    - Mantém apenas os triggers consolidados e corretos
*/

-- ============================================
-- 1. CORRIGIR TRIGGERS DE TRANSFERENCIA_PESSOAS
-- ============================================

-- Remover triggers duplicados que causam processamento múltiplo
DROP TRIGGER IF EXISTS trigger_transferencia_pessoas_creditar_destino_insert ON transferencia_pessoas;
DROP TRIGGER IF EXISTS trigger_transferencia_pessoas_creditar_destino_update ON transferencia_pessoas;

-- O trigger correto é este (que já existe):
-- trigger_processar_transferencia_pessoas_destino
-- Ele executa APENAS quando status = 'concluído'

-- ============================================
-- 2. CORRIGIR TRIGGERS DE VENDAS
-- ============================================

-- Remover triggers duplicados de prevenção
-- O trigger consolidado 'prevent_vendas_modification' já cobre DELETE e UPDATE
DROP TRIGGER IF EXISTS block_vendas_delete ON vendas;
DROP TRIGGER IF EXISTS block_vendas_update ON vendas;

-- ============================================
-- 3. VERIFICAR CONSISTÊNCIA
-- ============================================

-- Garantir que o trigger de transferencia_pessoas_destino só executa quando status = 'concluído'
DROP TRIGGER IF EXISTS trigger_processar_transferencia_pessoas_destino ON transferencia_pessoas;

CREATE TRIGGER trigger_processar_transferencia_pessoas_destino
  AFTER INSERT OR UPDATE OF status ON transferencia_pessoas
  FOR EACH ROW
  WHEN (NEW.status = 'concluído')
  EXECUTE FUNCTION processar_transferencia_pessoas_destino();

COMMENT ON TRIGGER trigger_processar_transferencia_pessoas_destino ON transferencia_pessoas IS 
'Processa o crédito no destino APENAS quando a transferência está concluída. Evita processamento duplicado.';
