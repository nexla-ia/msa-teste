/*
  Script de Limpeza TOTAL: Compras, Transferências de Pontos/Milhas e Estoque

  ATENÇÃO: IRREVERSÍVEL. Execute no SQL Editor do Supabase (tem permissão de superuser).

  O que é limpo:
    ✓ compras                  (todas as entradas de pontos/milhas)
    ✓ transferencia_pontos     (todas as transferências entre programas)
    ✓ estoque_movimentacoes    (todo o histórico de movimentações)
    ✓ estoque_pontos           (todos os saldos zerados)
    ✓ compra_bonificada        (todas as compras bonificadas)

  O que NÃO é afetado:
    ✗ vendas
    ✗ transferencia_pessoas
    ✗ parceiros, programas, programas_clubes (cadastros)
    ✗ atividades
*/

BEGIN;

-- Desabilitar triggers para evitar erros de validação de saldo durante limpeza
SET session_replication_role = 'replica';

-- 1. Limpar TODO o histórico de movimentações
DELETE FROM estoque_movimentacoes;

-- 2. Zerar todos os saldos de estoque
UPDATE estoque_pontos
SET
  saldo_atual   = 0,
  valor_total   = 0,
  custo_medio   = 0,
  updated_at    = now();

-- 3. Limpar todas as compras (entradas)
DELETE FROM compras;

-- 4. Limpar todas as transferências de pontos/milhas
DELETE FROM transferencia_pontos;

-- 5. Limpar todas as compras bonificadas
DELETE FROM compra_bonificada;

-- Restaurar comportamento normal dos triggers
SET session_replication_role = 'origin';

-- Verificação: todos devem mostrar 0
SELECT 'compras'               AS tabela, COUNT(*) AS registros FROM compras
UNION ALL
SELECT 'transferencia_pontos',            COUNT(*)              FROM transferencia_pontos
UNION ALL
SELECT 'compra_bonificada',               COUNT(*)              FROM compra_bonificada
UNION ALL
SELECT 'estoque_movimentacoes',           COUNT(*)              FROM estoque_movimentacoes
UNION ALL
SELECT 'estoque_pontos (saldo > 0)',      COUNT(*)              FROM estoque_pontos WHERE saldo_atual > 0;

COMMIT;
