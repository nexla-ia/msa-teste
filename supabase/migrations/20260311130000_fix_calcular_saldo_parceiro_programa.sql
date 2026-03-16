/*
  # Fix: calcular_saldo_parceiro_programa retornava sempre 0

  ## Problema
  - A função consultava a tabela `compras` filtrando por `tipo = 'Entrada'` e `tipo = 'Saída'`
  - Porém a tabela `compras` nunca usa esses valores — seu CHECK constraint só permite:
    'Compra de Pontos/Milhas', 'Recebimento de Bônus', 'Assinatura de Clube', etc.
  - Resultado: SUM(CASE WHEN tipo = 'Entrada' ...) sempre retornava 0 para todos os registros
  - A função sempre retornava {saldo: 0, custo_medio: 0} para qualquer parceiro/programa
  - O formulário de Compra Bonificada exibia saldo e custo médio incorretos (sempre zerados)

  ## Solução
  - Ler diretamente da tabela `estoque_pontos` que já mantém saldo_atual,
    valor_total e custo_medio corretamente via trigger atualizar_estoque_pontos
  - Simples, correto e sem risco de dessincronização
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
  SELECT
    ep.saldo_atual::numeric AS saldo,
    ep.custo_medio::numeric AS custo_medio
  FROM estoque_pontos ep
  WHERE ep.parceiro_id = p_parceiro_id
    AND ep.programa_id = p_programa_id;

  -- Se não encontrou registro, retorna zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric;
  END IF;
END;
$$;

COMMENT ON FUNCTION calcular_saldo_parceiro_programa IS
'Retorna saldo_atual e custo_medio de estoque_pontos para um parceiro/programa.
Lê diretamente de estoque_pontos que é mantido via trigger atualizar_estoque_pontos.
Usado na tela de Compra Bonificada para exibir o estado atual do estoque.';
