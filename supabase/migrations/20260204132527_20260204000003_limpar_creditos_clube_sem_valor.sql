/*
  # Limpar créditos de clube processados sem valor

  ## Problema
  Registros de clube foram processados antes da correção que adiciona o valor
  da mensalidade no cálculo do custo médio e antes da correção da lógica de bônus.

  ## Solução
  - Remove atividades de clube sem valor (processadas recentemente)
  - Remove movimentações de clube sem valor
  - Zera estoques que ficaram sem movimentações
  
  ## Nota
  Após esta migration, o usuário deve reprocessar os pontos manualmente
  usando o botão de raio (⚡) na página Programas/Clubes.
*/

-- 1. Remover atividades de clube processadas sem valor (criadas hoje)
DELETE FROM atividades
WHERE tipo_atividade = 'clube_credito_mensal'
  AND (valor IS NULL OR valor = 0)
  AND DATE(created_at) >= '2026-02-03'::date
  AND status = 'concluido';

-- 2. Remover movimentações de clube sem valor (criadas hoje)
DELETE FROM estoque_movimentacoes
WHERE origem IN ('clube_credito_manual', 'clube_credito_mensal', 
                 'clube_credito_bonus_manual', 'clube_credito_bonus',
                 'clube_credito_retroativo')
  AND (valor_total IS NULL OR valor_total = 0)
  AND DATE(created_at) >= '2026-02-03'::date;

-- 3. Zerar estoques que não têm mais movimentações
UPDATE estoque_pontos ep
SET 
  saldo_atual = 0,
  custo_medio = 0,
  updated_at = now()
WHERE NOT EXISTS (
  SELECT 1 
  FROM estoque_movimentacoes em
  WHERE em.parceiro_id = ep.parceiro_id
    AND em.programa_id = ep.programa_id
);

COMMENT ON SCHEMA public IS 
'Limpeza de créditos de clube sem valor concluída. Use o botão ⚡ na tabela Programas/Clubes para reprocessar corretamente.';