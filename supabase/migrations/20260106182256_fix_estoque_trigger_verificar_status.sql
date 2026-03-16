/*
  # Corrigir trigger de estoque para verificar status das compras

  1. Problema
    - Trigger estava adicionando pontos ao estoque mesmo para compras com status Pendente
    - Pontos devem ser adicionados apenas quando status = 'Concluído'
    
  2. Correções
    - Atualizar trigger_atualizar_estoque_compras() para verificar status
    - Remover triggers incorretos que foram criados anteriormente
    - Usar função atualizar_estoque_pontos() existente
    
  3. Comportamento
    - INSERT com status Concluído: adiciona pontos imediatamente
    - INSERT com status Pendente: não adiciona pontos
    - UPDATE de Pendente para Concluído: adiciona pontos
*/

-- Remover triggers incorretos
DROP TRIGGER IF EXISTS trigger_compras_estoque ON compras;
DROP TRIGGER IF EXISTS trigger_compras_estoque_update ON compras;
DROP FUNCTION IF EXISTS adicionar_pontos_compra_ao_estoque();

-- Atualizar função para verificar status antes de processar
CREATE OR REPLACE FUNCTION trigger_atualizar_estoque_compras()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Para INSERT: só processa se status = Concluído
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Concluído' THEN
      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        NEW.tipo,
        COALESCE(NEW.valor_total, 0)
      );
    END IF;
    
  -- Para UPDATE: processa mudanças de status
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se mudou de Pendente para Concluído, adiciona pontos
    IF OLD.status = 'Pendente' AND NEW.status = 'Concluído' THEN
      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        NEW.tipo,
        COALESCE(NEW.valor_total, 0)
      );
    -- Se mudou de Concluído para Pendente (improvável), remove pontos
    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Pendente' THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        OLD.tipo,
        -COALESCE(OLD.valor_total, 0)
      );
    -- Se ambos Concluído, processa mudanças normais
    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Concluído' THEN
      -- Remove pontos antigos
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        OLD.tipo,
        -COALESCE(OLD.valor_total, 0)
      );
      -- Adiciona pontos novos
      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        NEW.tipo,
        COALESCE(NEW.valor_total, 0)
      );
    END IF;
    
  -- Para DELETE: só remove se status era Concluído
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'Concluído' THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        OLD.tipo,
        -COALESCE(OLD.valor_total, 0)
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar triggers com nomes corretos
DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compras_insert ON compras;
DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compras_update ON compras;
DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compras_delete ON compras;

CREATE TRIGGER trigger_atualizar_estoque_compras_insert
  AFTER INSERT ON compras
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compras();

CREATE TRIGGER trigger_atualizar_estoque_compras_update
  AFTER UPDATE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compras();

CREATE TRIGGER trigger_atualizar_estoque_compras_delete
  AFTER DELETE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compras();

COMMENT ON FUNCTION trigger_atualizar_estoque_compras() IS 
'Atualiza o estoque de pontos quando compras são inseridas, atualizadas ou deletadas. Processa apenas compras com status = Concluído.';
