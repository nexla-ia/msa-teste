/*
  # Limpar Estoque para Testes

  1. Objetivo
    - Limpar completamente os dados de estoque
    - Remover todas as movimentações de estoque
    - Garantir que não fiquem vestígios para testes limpos

  2. Tabelas Afetadas
    - estoque_pontos: todos os registros serão removidos
    - estoque_movimentacoes: todos os registros serão removidos

  3. Observações
    - Esta operação não pode ser desfeita
    - Os triggers permanecerão ativos para registrar novas movimentações
    - As funções de cálculo de custo médio permanecerão funcionais
*/

-- Limpar movimentações de estoque
DELETE FROM estoque_movimentacoes;

-- Limpar estoque de pontos
DELETE FROM estoque_pontos;

-- Resetar sequências (se houver)
-- Como usamos UUID, não há sequências para resetar

-- Confirmar limpeza
DO $$
DECLARE
  v_count_estoque integer;
  v_count_movimentacoes integer;
BEGIN
  SELECT COUNT(*) INTO v_count_estoque FROM estoque_pontos;
  SELECT COUNT(*) INTO v_count_movimentacoes FROM estoque_movimentacoes;
  
  IF v_count_estoque > 0 OR v_count_movimentacoes > 0 THEN
    RAISE EXCEPTION 'Falha ao limpar estoque. Restam registros: estoque_pontos=%, estoque_movimentacoes=%', 
      v_count_estoque, v_count_movimentacoes;
  END IF;
  
  RAISE NOTICE 'Estoque limpo com sucesso. Todas as tabelas estão vazias.';
END $$;
