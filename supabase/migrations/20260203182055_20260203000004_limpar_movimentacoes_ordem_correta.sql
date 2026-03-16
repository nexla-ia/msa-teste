/*
  # Limpar Todas as Movimentações na Ordem Correta

  1. Objetivo
    - Limpar completamente todas as movimentações do sistema
    - Respeitar ordem de dependências para evitar erros
    - Preparar ambiente limpo para testes

  2. Estratégia
    - Limpar primeiro o estoque (já limpo anteriormente)
    - Limpar tabelas dependentes antes das principais
    - Usar CASCADE onde apropriado

  3. Ordem de Limpeza
    1. Contas a receber (depende de vendas)
    2. Vendas
    3. Atividades
    4. Conta família histórico
    5. Transferências entre pessoas
    6. Transferências de pontos
    7. Compras bonificadas
    8. Compras

  4. Observações
    - Esta operação não pode ser desfeita
    - Mantém cadastros (parceiros, programas, cartões, etc.)
    - Remove apenas transações e movimentações
*/

-- Limpar na ordem inversa de dependência

-- 1. Contas a receber (criadas por vendas)
TRUNCATE TABLE contas_receber CASCADE;

-- 2. Vendas
TRUNCATE TABLE vendas CASCADE;

-- 3. Atividades
TRUNCATE TABLE atividades CASCADE;

-- 4. Histórico conta família
TRUNCATE TABLE conta_familia_historico CASCADE;

-- 5. Transferências entre pessoas
TRUNCATE TABLE transferencia_pessoas CASCADE;

-- 6. Transferências de pontos
TRUNCATE TABLE transferencia_pontos CASCADE;

-- 7. Compras bonificadas
TRUNCATE TABLE compra_bonificada CASCADE;

-- 8. Compras
TRUNCATE TABLE compras CASCADE;

-- Confirmar limpeza
DO $$
DECLARE
  v_total integer := 0;
BEGIN
  SELECT 
    (SELECT COUNT(*) FROM compras) +
    (SELECT COUNT(*) FROM compra_bonificada) +
    (SELECT COUNT(*) FROM transferencia_pontos) +
    (SELECT COUNT(*) FROM transferencia_pessoas) +
    (SELECT COUNT(*) FROM vendas) +
    (SELECT COUNT(*) FROM contas_receber) +
    (SELECT COUNT(*) FROM atividades) +
    (SELECT COUNT(*) FROM conta_familia_historico) +
    (SELECT COUNT(*) FROM estoque_pontos) +
    (SELECT COUNT(*) FROM estoque_movimentacoes)
  INTO v_total;
  
  IF v_total > 0 THEN
    RAISE EXCEPTION 'Falha na limpeza. Ainda existem % registros.', v_total;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AMBIENTE COMPLETAMENTE LIMPO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Todas as movimentações foram removidas:';
  RAISE NOTICE '  ✓ Compras';
  RAISE NOTICE '  ✓ Compras Bonificadas';
  RAISE NOTICE '  ✓ Transferências de Pontos';
  RAISE NOTICE '  ✓ Transferências entre Pessoas';
  RAISE NOTICE '  ✓ Vendas';
  RAISE NOTICE '  ✓ Contas a Receber';
  RAISE NOTICE '  ✓ Atividades';
  RAISE NOTICE '  ✓ Histórico Conta Família';
  RAISE NOTICE '  ✓ Estoque de Pontos';
  RAISE NOTICE '  ✓ Movimentações de Estoque';
  RAISE NOTICE '';
  RAISE NOTICE 'Cadastros preservados:';
  RAISE NOTICE '  ✓ Usuários';
  RAISE NOTICE '  ✓ Parceiros';
  RAISE NOTICE '  ✓ Programas';
  RAISE NOTICE '  ✓ Cartões';
  RAISE NOTICE '  ✓ Contas Bancárias';
  RAISE NOTICE '  ✓ Classificações';
  RAISE NOTICE '  ✓ Formas de Pagamento';
  RAISE NOTICE '  ✓ Produtos';
  RAISE NOTICE '  ✓ Clientes';
  RAISE NOTICE '  ✓ Programas Clubes';
  RAISE NOTICE '';
  RAISE NOTICE 'Sistema pronto para testes!';
  RAISE NOTICE '========================================';
END $$;
