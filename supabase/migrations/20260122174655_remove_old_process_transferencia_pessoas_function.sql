/*
  # Remover função antiga de transferência entre pessoas
  
  1. Descrição
    - Remove função `process_transferencia_pessoas()` que não é mais usada
    - Sistema atual usa funções separadas:
      - `processar_transferencia_pessoas_origem()` para débito
      - `processar_transferencia_pessoas_destino()` para crédito
  
  2. Motivo
    - A função antiga estava duplicada e causando confusão
    - As funções separadas permitem melhor controle de status (Pendente/Concluído)
*/

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_process_transferencia_pessoas ON transferencia_pessoas;

-- Remover função antiga
DROP FUNCTION IF EXISTS process_transferencia_pessoas();

COMMENT ON TABLE transferencia_pessoas IS 
'Transferências de pontos entre pessoas. Usa funções separadas para origem (débito) e destino (crédito com custo zero).';