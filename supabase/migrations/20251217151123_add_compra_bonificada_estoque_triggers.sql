/*
  # Add stock triggers for compra_bonificada table

  1. Triggers
    - Automatically update stock when compra_bonificada transactions occur
    - Treats compra_bonificada as "Entrada" type

  2. Notes
    - When a bonified purchase is created, it adds points to stock
    - When updated or deleted, it adjusts stock accordingly
*/

CREATE OR REPLACE FUNCTION trigger_atualizar_estoque_compra_bonificada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      COALESCE(NEW.quantidade_pontos, 0),
      'Entrada',
      COALESCE(NEW.custo_total, 0)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.programa_id,
      -COALESCE(OLD.quantidade_pontos, 0),
      'Entrada',
      -COALESCE(OLD.custo_total, 0)
    );
    
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      COALESCE(NEW.quantidade_pontos, 0),
      'Entrada',
      COALESCE(NEW.custo_total, 0)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.programa_id,
      -COALESCE(OLD.quantidade_pontos, 0),
      'Entrada',
      -COALESCE(OLD.custo_total, 0)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compra_bonificada_insert ON compra_bonificada;
CREATE TRIGGER trigger_atualizar_estoque_compra_bonificada_insert
  AFTER INSERT ON compra_bonificada
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compra_bonificada();

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compra_bonificada_update ON compra_bonificada;
CREATE TRIGGER trigger_atualizar_estoque_compra_bonificada_update
  AFTER UPDATE ON compra_bonificada
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compra_bonificada();

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compra_bonificada_delete ON compra_bonificada;
CREATE TRIGGER trigger_atualizar_estoque_compra_bonificada_delete
  AFTER DELETE ON compra_bonificada
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compra_bonificada();