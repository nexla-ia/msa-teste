/*
  # Criar trigger para adicionar pontos de compras no estoque

  ## Descrição
  Quando uma compra é registrada na tabela `compras`, os pontos devem ser
  automaticamente adicionados ao estoque de pontos do parceiro no programa
  correspondente e aparecer no histórico.

  ## Mudanças
  1. Função `adicionar_pontos_compra_ao_estoque()`:
     - Triggered após INSERT em `compras`
     - Adiciona entrada no `estoque_pontos` com os pontos da compra
     - Define origem como 'compra' para rastreabilidade
     - Usa a data_entrada da compra
     - Inclui informações do tipo e observação da compra

  2. Trigger `trigger_compras_estoque`:
     - Executado AFTER INSERT em `compras`
     - Chama a função para adicionar pontos automaticamente

  ## Fluxo
  1. Usuário registra uma compra com 10.000 pontos
  2. Trigger adiciona automaticamente 10.000 pontos no estoque_pontos
  3. Pontos aparecem no histórico com origem "compra"

  ## Observações
  - Os pontos aparecem no histórico do estoque automaticamente
  - A origem 'compra' permite filtrar entradas vindas de compras
  - Usa SECURITY DEFINER para funcionar com RLS
*/

-- Função para adicionar pontos da compra ao estoque
CREATE OR REPLACE FUNCTION adicionar_pontos_compra_ao_estoque()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Adiciona os pontos da compra ao estoque
  INSERT INTO estoque_pontos (
    parceiro_id,
    programa_id,
    tipo,
    quantidade,
    origem,
    observacao,
    data
  ) VALUES (
    NEW.parceiro_id,
    NEW.programa_id,
    'entrada',
    NEW.pontos_milhas,
    'compra',
    'Compra: ' || NEW.tipo || 
    CASE 
      WHEN NEW.observacao IS NOT NULL AND NEW.observacao != '' 
      THEN ' - ' || NEW.observacao 
      ELSE '' 
    END,
    NEW.data_entrada
  );

  RETURN NEW;
END;
$$;

-- Criar trigger para adicionar pontos automaticamente após inserir compra
DROP TRIGGER IF EXISTS trigger_compras_estoque ON compras;

CREATE TRIGGER trigger_compras_estoque
  AFTER INSERT ON compras
  FOR EACH ROW
  EXECUTE FUNCTION adicionar_pontos_compra_ao_estoque();

COMMENT ON FUNCTION adicionar_pontos_compra_ao_estoque() IS 
'Adiciona automaticamente os pontos de uma compra ao estoque de pontos do parceiro. Executado após INSERT em compras.';

COMMENT ON TRIGGER trigger_compras_estoque ON compras IS 
'Trigger que adiciona pontos automaticamente ao estoque quando uma compra é registrada.';