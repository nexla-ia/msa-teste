/*
  # Adicionar tipos de atividade manual à constraint
  
  ## Problema
  A função processar_pontos_mes_atual tenta criar atividades com tipos
  'clube_credito_manual' e 'clube_credito_bonus_manual', mas esses tipos
  não estão na constraint check da tabela atividades.
  
  ## Solução
  Adicionar os tipos manuais à lista de tipos permitidos:
  - clube_credito_manual
  - clube_credito_bonus_manual
  
  ## Impacto
  - Permite o processamento manual de pontos de clube
  - Mantém a consistência com os tipos automáticos
*/

-- Remover constraint antiga
ALTER TABLE atividades 
DROP CONSTRAINT IF EXISTS atividades_tipo_atividade_check;

-- Criar nova constraint com os tipos adicionais
ALTER TABLE atividades 
ADD CONSTRAINT atividades_tipo_atividade_check 
CHECK (tipo_atividade = ANY (ARRAY[
  'transferencia_entrada'::text,
  'transferencia_bonus'::text,
  'bumerangue_retorno'::text,
  'clube_credito_mensal'::text,
  'clube_credito_bonus'::text,
  'clube_credito_manual'::text,
  'clube_credito_bonus_manual'::text,
  'lembrete_downgrade'::text,
  'outro'::text
]));

COMMENT ON CONSTRAINT atividades_tipo_atividade_check ON atividades IS 
'Tipos permitidos de atividade, incluindo processamentos manuais de clube';
