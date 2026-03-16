/*
  # Função para buscar parceiros com movimentação recente

  1. Problema
    - Com muitos parceiros cadastrados, fica difícil encontrar os ativos
    - Necessário filtrar apenas parceiros com movimentações recentes
    - Facilitar busca em formulários com autocomplete

  2. Solução
    - Criar função que retorna parceiros com movimentações nos últimos 90 dias
    - Incluir data da última movimentação
    - Ordenar por movimentação mais recente primeiro

  3. Mudanças
    - Nova função: get_parceiros_ativos()
    - Busca em: compras, compra_bonificada, vendas, transferencia_pontos, transferencia_pessoas
*/

CREATE OR REPLACE FUNCTION get_parceiros_ativos(dias_limite integer DEFAULT 90)
RETURNS TABLE (
  id uuid,
  nome_parceiro text,
  cpf text,
  ultima_movimentacao timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH movimentacoes AS (
    SELECT 
      parceiro_id,
      MAX(created_at) as ultima_data
    FROM (
      SELECT parceiro_id, created_at FROM compras WHERE parceiro_id IS NOT NULL
      UNION ALL
      SELECT parceiro_id, created_at FROM compra_bonificada WHERE parceiro_id IS NOT NULL
      UNION ALL
      SELECT parceiro_id, created_at FROM vendas WHERE parceiro_id IS NOT NULL
      UNION ALL
      SELECT parceiro_origem_id as parceiro_id, created_at FROM transferencia_pontos WHERE parceiro_origem_id IS NOT NULL
      UNION ALL
      SELECT parceiro_destino_id as parceiro_id, created_at FROM transferencia_pontos WHERE parceiro_destino_id IS NOT NULL
      UNION ALL
      SELECT parceiro_origem_id as parceiro_id, created_at FROM transferencia_pessoas WHERE parceiro_origem_id IS NOT NULL
      UNION ALL
      SELECT parceiro_destino_id as parceiro_id, created_at FROM transferencia_pessoas WHERE parceiro_destino_id IS NOT NULL
    ) todas_movimentacoes
    WHERE created_at >= NOW() - INTERVAL '1 day' * dias_limite
    GROUP BY parceiro_id
  )
  SELECT 
    p.id,
    p.nome_parceiro,
    p.cpf,
    m.ultima_data
  FROM parceiros p
  INNER JOIN movimentacoes m ON p.id = m.parceiro_id
  ORDER BY m.ultima_data DESC, p.nome_parceiro;
END;
$$;

COMMENT ON FUNCTION get_parceiros_ativos IS 
'Retorna parceiros que tiveram movimentações nos últimos N dias (padrão: 90 dias), ordenados por movimentação mais recente';
