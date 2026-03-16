/*
  # Limpar atividades de clube órfãs

  ## Problema
  Existem atividades de clube que foram criadas mas não têm valor e as movimentações
  correspondentes foram removidas. Essas atividades órfãs estão bloqueando o 
  reprocessamento dos pontos.

  ## Solução
  Remove todas as atividades de clube criadas em fevereiro de 2026 que:
  - Não têm valor (valor IS NULL ou valor = 0)
  - Foram criadas nos últimos dias
  
  Isso permitirá reprocessar os pontos corretamente com a lógica atualizada.
*/

-- Remover atividades de clube órfãs (sem valor ou com valor zero)
DELETE FROM atividades
WHERE tipo_atividade IN ('clube_credito_mensal', 'clube_credito_bonus')
  AND (valor IS NULL OR valor = 0)
  AND DATE(created_at) >= '2026-02-03'::date;

COMMENT ON SCHEMA public IS 
'Atividades órfãs de clube removidas. Agora você pode reprocessar os pontos usando o botão ⚡';