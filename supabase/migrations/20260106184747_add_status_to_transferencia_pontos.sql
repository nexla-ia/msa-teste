/*
  # Adicionar sistema de status e agendamento para transferências de pontos

  1. Alterações na tabela transferencia_pontos
    - Adicionar campo `status` (Pendente/Concluído) - controla quando os pontos de destino entram
    - Adicionar campo `status_bonus_destino` (Pendente/Concluído) - controla quando o bônus de destino entra
    - Adicionar campo `status_bonus_bumerangue` (Pendente/Concluído) - controla quando o bônus bumerangue entra
    
  2. Lógica de Status
    - Se `destino_data_recebimento` = hoje: status = Concluído (pontos entram imediatamente)
    - Se `destino_data_recebimento` > hoje: status = Pendente (pontos entram na data)
    - Se `destino_data_recebimento_bonus` = hoje: status_bonus_destino = Concluído
    - Se `destino_data_recebimento_bonus` > hoje: status_bonus_destino = Pendente
    - Se `bumerangue_data_recebimento` = hoje: status_bonus_bumerangue = Concluído
    - Se `bumerangue_data_recebimento` > hoje: status_bonus_bumerangue = Pendente
    
  3. Comportamento
    - A origem SEMPRE é debitada imediatamente (sem agendamento)
    - O destino segue a regra de agendamento baseada nas datas
    - Cada parte (pontos principais, bônus destino, bônus bumerangue) tem seu próprio status
*/

-- Adicionar campos de status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transferencia_pontos' AND column_name = 'status'
  ) THEN
    ALTER TABLE transferencia_pontos ADD COLUMN status text DEFAULT 'Pendente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transferencia_pontos' AND column_name = 'status_bonus_destino'
  ) THEN
    ALTER TABLE transferencia_pontos ADD COLUMN status_bonus_destino text DEFAULT 'Pendente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transferencia_pontos' AND column_name = 'status_bonus_bumerangue'
  ) THEN
    ALTER TABLE transferencia_pontos ADD COLUMN status_bonus_bumerangue text DEFAULT 'Pendente';
  END IF;
END $$;

-- Criar view para visualizar transferências pendentes
CREATE OR REPLACE VIEW transferencias_pendentes AS
SELECT 
  tp.id,
  p.nome_parceiro,
  pf_origem.nome as programa_origem,
  pf_destino.nome as programa_destino,
  tp.destino_quantidade,
  tp.destino_data_recebimento,
  tp.status,
  tp.destino_quantidade_bonus,
  tp.destino_data_recebimento_bonus,
  tp.status_bonus_destino,
  tp.bumerangue_quantidade_bonus,
  tp.bumerangue_data_recebimento,
  tp.status_bonus_bumerangue,
  tp.observacao,
  CASE
    WHEN tp.destino_data_recebimento = CURRENT_DATE THEN 'Hoje'
    WHEN tp.destino_data_recebimento = CURRENT_DATE + 1 THEN 'Amanhã'
    WHEN tp.destino_data_recebimento <= CURRENT_DATE + 7 THEN 'Esta semana'
    WHEN tp.destino_data_recebimento <= CURRENT_DATE + 30 THEN 'Este mês'
    ELSE 'Mais de 1 mês'
  END as periodo,
  tp.destino_data_recebimento - CURRENT_DATE as dias_restantes
FROM transferencia_pontos tp
JOIN parceiros p ON tp.parceiro_id = p.id
JOIN programas_fidelidade pf_origem ON tp.origem_programa_id = pf_origem.id
JOIN programas_fidelidade pf_destino ON tp.destino_programa_id = pf_destino.id
WHERE tp.status = 'Pendente'
   OR (tp.status_bonus_destino = 'Pendente' AND tp.destino_quantidade_bonus > 0)
   OR (tp.status_bonus_bumerangue = 'Pendente' AND tp.bumerangue_quantidade_bonus > 0)
ORDER BY tp.destino_data_recebimento ASC;

-- Permitir acesso à view
GRANT SELECT ON transferencias_pendentes TO authenticated;

COMMENT ON VIEW transferencias_pendentes IS 
'View que lista todas as transferências com status pendente (pontos principais, bônus destino ou bônus bumerangue)';
