/*
  # Limpar Todas as Operações do Sistema

  1. Objetivo
    - Limpar completamente todas as operações de transferências, compras e estoque
    - Não deixar resíduos em tabelas relacionadas (contas a pagar, contas a receber, atividades)

  2. Operações Limpas
    - Transferência de Pontos/Milhas
    - Transferência entre Pessoas
    - Compra Bonificada
    - Compras
    - Estoque de Pontos e Movimentações
    - Contas a Pagar relacionadas
    - Contas a Receber relacionadas
    - Atividades relacionadas

  3. Ordem de Limpeza
    - Usar TRUNCATE CASCADE para limpar completamente sem disparar triggers
    - Tabelas dependentes primeiro
    - Tabelas principais depois

  4. Importante
    - Mantém os cadastros (parceiros, programas, clientes, etc)
    - Mantém configurações (clubes, tipos de compra, formas de pagamento)
    - Remove apenas as movimentações e operações financeiras
*/

-- 1. Limpar Contas a Pagar geradas pelas operações
DELETE FROM contas_a_pagar 
WHERE origem_tipo IN ('compra', 'compra_bonificada', 'transferencia_pontos', 'transferencia_pessoas');

-- 2. Limpar Contas a Receber geradas pelas operações
DELETE FROM contas_receber 
WHERE origem_tipo IN ('transferencia_pontos', 'transferencia_pessoas');

-- 3. Limpar Atividades relacionadas às operações (compras, transferências, vendas)
-- Mantém apenas atividades de clubes (credito_clube, lembrete_downgrade, milhas_expirando)
DELETE FROM atividades 
WHERE tipo_atividade NOT IN ('credito_clube', 'lembrete_downgrade', 'milhas_expirando', 'clube_manual');

-- 4. Limpar Movimentações de Estoque (não tem foreign keys, pode limpar diretamente)
TRUNCATE TABLE estoque_movimentacoes CASCADE;

-- 5. Limpar Estoque de Pontos (não tem foreign keys, pode limpar diretamente)
TRUNCATE TABLE estoque_pontos CASCADE;

-- 6. Limpar Transferências entre Pessoas (não tem foreign keys de outras tabelas)
TRUNCATE TABLE transferencia_pessoas CASCADE;

-- 7. Limpar Transferências de Pontos/Milhas (não tem foreign keys de outras tabelas)
TRUNCATE TABLE transferencia_pontos CASCADE;

-- 8. Limpar Compras Bonificadas (não tem foreign keys de outras tabelas)
TRUNCATE TABLE compra_bonificada CASCADE;

-- 9. Limpar Compras (não tem foreign keys de outras tabelas)
TRUNCATE TABLE compras CASCADE;
