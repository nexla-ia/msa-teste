/*
  # Create function to calculate partner program balance

  1. Function
    - `calcular_saldo_parceiro_programa` - Calculates balance and average cost for a partner in a specific program
    
  2. Notes
    - Returns saldo (balance) and custo_medio (average cost)
    - Considers all transactions involving the partner and program
*/

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
  WITH movimentacoes AS (
    SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'Entrada' THEN pontos_milhas ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tipo = 'Saída' THEN pontos_milhas ELSE 0 END), 0) as total_pontos,
      COALESCE(SUM(CASE WHEN tipo = 'Entrada' THEN valor_total ELSE 0 END), 0) as custo_total_entrada
    FROM compras
    WHERE parceiro_id = p_parceiro_id
      AND programa_id = p_programa_id
  )
  SELECT 
    movimentacoes.total_pontos::numeric as saldo,
    CASE 
      WHEN movimentacoes.total_pontos > 0 
      THEN (movimentacoes.custo_total_entrada / movimentacoes.total_pontos * 1000)::numeric
      ELSE 0::numeric
    END as custo_medio
  FROM movimentacoes;
END;
$$;