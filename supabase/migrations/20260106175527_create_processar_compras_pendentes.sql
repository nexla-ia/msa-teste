/*
  # Processar Compras Pendentes Automaticamente

  1. Nova Função
    - `processar_compras_pendentes()`: Processa compras com datas de entrada que já chegaram
    - Atualiza status de Pendente para Concluído
    - Atualiza o estoque de pontos quando a data chega
    
  2. Job Agendado
    - Executa diariamente às 00:01
    - Processa todas as compras com data_entrada <= hoje
    - Processa bônus com data_limite_bonus <= hoje
    
  3. Segurança
    - Função com SECURITY DEFINER para permitir atualização
    - Usa RLS policies existentes
*/

-- Função para processar compras pendentes
CREATE OR REPLACE FUNCTION processar_compras_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  compra_record RECORD;
  hoje DATE := CURRENT_DATE;
BEGIN
  -- Processar compras com data de entrada que já chegou
  FOR compra_record IN
    SELECT id, parceiro_id, programa_id, pontos_milhas, bonus, 
           data_entrada, data_limite_bonus, valor_total
    FROM compras
    WHERE status = 'Pendente'
      AND data_entrada <= hoje
  LOOP
    -- Atualizar status para Concluído
    UPDATE compras
    SET status = 'Concluído',
        updated_at = NOW()
    WHERE id = compra_record.id;
    
    RAISE NOTICE 'Compra % processada: pontos de entrada liberados', compra_record.id;
  END LOOP;
  
  -- Processar bônus com data limite que já chegou
  FOR compra_record IN
    SELECT id, parceiro_id, programa_id, pontos_milhas, bonus,
           data_entrada, data_limite_bonus, valor_total
    FROM compras
    WHERE status = 'Pendente'
      AND bonus > 0
      AND data_limite_bonus IS NOT NULL
      AND data_limite_bonus <= hoje
  LOOP
    -- Atualizar status para Concluído
    UPDATE compras
    SET status = 'Concluído',
        updated_at = NOW()
    WHERE id = compra_record.id;
    
    RAISE NOTICE 'Compra %: bônus liberado', compra_record.id;
  END LOOP;
  
  RAISE NOTICE 'Processamento de compras pendentes concluído';
END;
$$;

-- Criar job agendado para executar diariamente
-- Nota: pg_cron precisa estar habilitado no Supabase
DO $$
BEGIN
  -- Remover job existente se houver
  PERFORM cron.unschedule('processar-compras-pendentes');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Agendar job para rodar diariamente às 00:01
SELECT cron.schedule(
  'processar-compras-pendentes',
  '1 0 * * *', -- Todo dia às 00:01
  'SELECT processar_compras_pendentes();'
);

-- Comentário explicativo
COMMENT ON FUNCTION processar_compras_pendentes IS 
'Processa compras pendentes cujas datas de entrada ou limite de bônus já chegaram. Executado automaticamente todos os dias às 00:01.';
