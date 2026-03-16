/*
  # Criar job para processar transferências pendentes diariamente

  1. Job Agendado
    - Executa função verificar_e_atualizar_status_transferencias() todos os dias às 00:01
    - Verifica datas e atualiza status de pendente para concluído
    - Os triggers processarão automaticamente os créditos quando o status mudar
    
  2. Nota
    - Similar ao job de compras
    - Processa pontos principais, bônus de destino e bônus bumerangue
*/

-- Usar pg_cron para agendar job (se disponível)
-- Caso contrário, pode ser executado manualmente ou via external scheduler

SELECT cron.schedule(
  'processar_transferencias_pendentes',
  '1 0 * * *', -- Todo dia às 00:01
  $$SELECT verificar_e_atualizar_status_transferencias()$$
);

COMMENT ON FUNCTION verificar_e_atualizar_status_transferencias() IS 
'Job diário (00:01) que verifica e atualiza status de transferências pendentes baseado nas datas de recebimento';
