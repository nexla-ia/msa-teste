/*
  # Create inventory/stock system for points tracking

  1. New Tables
    - `estoque_pontos`
      - `id` (uuid, primary key)
      - `parceiro_id` (uuid, foreign key to parceiros)
      - `programa_id` (uuid, foreign key to programas_fidelidade)
      - `saldo_atual` (decimal) - Current balance
      - `custo_medio` (decimal) - Average cost per 1000 points
      - `updated_at` (timestamptz)
      - Unique constraint on (parceiro_id, programa_id)

  2. Functions
    - `atualizar_estoque_pontos` - Updates inventory based on transactions
    - `calcular_saldo_parceiro_programa_v2` - New version that reads from stock table

  3. Triggers
    - Automatically update stock when transactions occur

  4. Security
    - Enable RLS on estoque_pontos table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS estoque_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid REFERENCES parceiros(id) ON DELETE CASCADE NOT NULL,
  programa_id uuid REFERENCES programas_fidelidade(id) ON DELETE CASCADE NOT NULL,
  saldo_atual decimal(15, 2) DEFAULT 0 NOT NULL,
  custo_medio decimal(10, 4) DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(parceiro_id, programa_id)
);

ALTER TABLE estoque_pontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all estoque_pontos"
  ON estoque_pontos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert estoque_pontos"
  ON estoque_pontos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update estoque_pontos"
  ON estoque_pontos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_estoque_pontos_parceiro_programa ON estoque_pontos(parceiro_id, programa_id);

CREATE OR REPLACE FUNCTION atualizar_estoque_pontos(
  p_parceiro_id uuid,
  p_programa_id uuid,
  p_quantidade decimal,
  p_tipo text,
  p_valor_total decimal DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_atual decimal;
  v_custo_medio decimal;
  v_custo_total_acumulado decimal;
BEGIN
  INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
  VALUES (p_parceiro_id, p_programa_id, 0, 0)
  ON CONFLICT (parceiro_id, programa_id) DO NOTHING;

  SELECT saldo_atual, custo_medio INTO v_saldo_atual, v_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  IF p_tipo = 'Entrada' OR p_tipo = 'Compra de Pontos/Milhas' THEN
    v_custo_total_acumulado := (v_saldo_atual * v_custo_medio / 1000) + p_valor_total;
    v_saldo_atual := v_saldo_atual + p_quantidade;
    
    IF v_saldo_atual > 0 THEN
      v_custo_medio := (v_custo_total_acumulado / v_saldo_atual) * 1000;
    ELSE
      v_custo_medio := 0;
    END IF;
  ELSIF p_tipo = 'Saída' THEN
    v_saldo_atual := v_saldo_atual - p_quantidade;
    
    IF v_saldo_atual < 0 THEN
      v_saldo_atual := 0;
    END IF;
    
    IF v_saldo_atual = 0 THEN
      v_custo_medio := 0;
    END IF;
  END IF;

  UPDATE estoque_pontos
  SET 
    saldo_atual = v_saldo_atual,
    custo_medio = v_custo_medio,
    updated_at = now()
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;
END;
$$;

CREATE OR REPLACE FUNCTION calcular_saldo_parceiro_programa(
  p_parceiro_id uuid,
  p_programa_id uuid
)
RETURNS TABLE (
  saldo numeric,
  custo_medio numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(e.saldo_atual, 0)::numeric as saldo,
    COALESCE(e.custo_medio, 0)::numeric as custo_medio
  FROM estoque_pontos e
  WHERE e.parceiro_id = p_parceiro_id
    AND e.programa_id = p_programa_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_atualizar_estoque_compras()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
      NEW.tipo,
      COALESCE(NEW.valor_total, 0)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.programa_id,
      -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
      OLD.tipo,
      -COALESCE(OLD.valor_total, 0)
    );
    
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
      NEW.tipo,
      COALESCE(NEW.valor_total, 0)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.programa_id,
      -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
      OLD.tipo,
      -COALESCE(OLD.valor_total, 0)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compras_insert ON compras;
CREATE TRIGGER trigger_atualizar_estoque_compras_insert
  AFTER INSERT ON compras
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compras();

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compras_update ON compras;
CREATE TRIGGER trigger_atualizar_estoque_compras_update
  AFTER UPDATE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compras();

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compras_delete ON compras;
CREATE TRIGGER trigger_atualizar_estoque_compras_delete
  AFTER DELETE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compras();