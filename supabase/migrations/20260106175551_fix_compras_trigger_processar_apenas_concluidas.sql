/*
  # Atualizar trigger de compras para processar apenas quando status = Concluído

  1. Alterações
    - Trigger só adiciona pontos ao estoque quando status = 'Concluído'
    - Adiciona trigger para UPDATE para processar quando status muda de Pendente para Concluído
    - Não processa compras com status Pendente (data futura)
    
  2. Comportamento
    - INSERT com status Concluído: adiciona pontos imediatamente
    - INSERT com status Pendente: não adiciona pontos (aguarda data)
    - UPDATE de Pendente para Concluído: adiciona pontos quando processado
*/

-- Atualizar função para verificar status
CREATE OR REPLACE FUNCTION adicionar_pontos_compra_ao_estoque()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só processa se o status for Concluído
  IF NEW.status = 'Concluído' THEN
    -- Para UPDATE, verificar se não era Concluído antes
    IF (TG_OP = 'UPDATE' AND OLD.status = 'Concluído') THEN
      -- Já foi processado, não fazer nada
      RETURN NEW;
    END IF;

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
      NEW.total_pontos, -- Usa total_pontos que já inclui bônus
      'compra',
      'Compra: ' || NEW.tipo || 
      CASE 
        WHEN NEW.observacao IS NOT NULL AND NEW.observacao != '' 
        THEN ' - ' || NEW.observacao 
        ELSE '' 
      END,
      NEW.data_entrada
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar trigger para INSERT
DROP TRIGGER IF EXISTS trigger_compras_estoque ON compras;

CREATE TRIGGER trigger_compras_estoque
  AFTER INSERT ON compras
  FOR EACH ROW
  EXECUTE FUNCTION adicionar_pontos_compra_ao_estoque();

-- Criar trigger para UPDATE
DROP TRIGGER IF EXISTS trigger_compras_estoque_update ON compras;

CREATE TRIGGER trigger_compras_estoque_update
  AFTER UPDATE ON compras
  FOR EACH ROW
  WHEN (NEW.status = 'Concluído' AND OLD.status = 'Pendente')
  EXECUTE FUNCTION adicionar_pontos_compra_ao_estoque();

COMMENT ON FUNCTION adicionar_pontos_compra_ao_estoque() IS 
'Adiciona automaticamente os pontos de uma compra ao estoque apenas quando status = Concluído. Executado após INSERT ou UPDATE em compras.';

COMMENT ON TRIGGER trigger_compras_estoque_update ON compras IS 
'Trigger que adiciona pontos ao estoque quando uma compra pendente é concluída.';
