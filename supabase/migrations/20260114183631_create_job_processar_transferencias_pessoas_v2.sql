/*
  # Criar job para processar transferências entre pessoas pendentes

  1. Job agendado
    - Executa diariamente às 00:05 (5 minutos após meia-noite)
    - Verifica transferências com data_recebimento <= hoje
    - Atualiza status de Pendente para Concluído
    - Isso dispara o trigger que credita os pontos no destino
*/

-- Criar extensão pg_cron se não existir
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criar job para processar transferências entre pessoas
DO $$
BEGIN
  -- Tentar desagendar se existir
  PERFORM cron.unschedule('processar-transferencias-pessoas-diario');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignorar erro se não existir
END $$;

-- Criar novo job
SELECT cron.schedule(
  'processar-transferencias-pessoas-diario',
  '5 0 * * *', -- Executa todo dia às 00:05
  $$
  SELECT verificar_e_processar_transferencias_pessoas();
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Extensão para agendar jobs no PostgreSQL';
