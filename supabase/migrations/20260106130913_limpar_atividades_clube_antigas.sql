/*
  # Limpar atividades de clube antigas

  ## Descrição
  Remove todas as atividades de clube existentes para que sejam recriadas
  com a data correta baseada no dia da assinatura, não no dia de cobrança.

  ## Mudanças
  - Remove atividades pendentes do tipo 'clube_credito_mensal'
  - Remove atividades pendentes do tipo 'clube_bonus'
  - O sistema irá recriar automaticamente com as datas corretas
*/

-- Remove atividades de clube pendentes com data errada
DELETE FROM atividades 
WHERE tipo_atividade IN ('clube_credito_mensal', 'clube_bonus')
  AND status = 'pendente';
