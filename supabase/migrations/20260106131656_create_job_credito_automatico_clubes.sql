/*
  # Criar job automático para crédito de clubes

  ## Descrição
  Configura um job que roda automaticamente todos os dias às 00:01
  para creditar pontos de clubes no estoque dos parceiros.
  
  O sistema verifica:
  - Se o parceiro tem clube ativo (tem_clube = true)
  - Se o dia atual corresponde ao dia da assinatura
  - Adiciona os pontos regulares + bônus (se aplicável) no estoque

  ## Mudanças
  - Habilita extensão pg_cron para jobs agendados
  - Cria job diário que executa processar_creditos_clubes()
  - Sistema funciona 100% automático, sem precisar clicar em nada
*/

-- Habilitar extensão pg_cron para jobs agendados
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover job existente se houver
SELECT cron.unschedule('credito-automatico-clubes') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'credito-automatico-clubes'
);

-- Criar job que roda todos os dias às 00:01 (1 minuto após meia-noite)
SELECT cron.schedule(
  'credito-automatico-clubes',
  '1 0 * * *', -- todo dia às 00:01
  $$
    SELECT processar_creditos_clubes();
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Extensão para agendar jobs SQL automaticamente';
