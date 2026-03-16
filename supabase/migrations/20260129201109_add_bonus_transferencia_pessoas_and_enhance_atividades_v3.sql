/*
  # Adicionar bônus em transferência de pessoas e melhorar atividades

  1. Alterações em transferencia_pessoas
    - Adiciona campo `bonus` para enviar pontos bônus além dos pontos normais
    - Adiciona campo `bonus_destino` para rastrear bônus recebido no destino

  2. Melhorias na tabela atividades
    - Adiciona campo `tipo_lembrete` para categorizar melhor os lembretes
    - Adiciona campo `descricao_completa` para mais detalhes
    - Adiciona campo `pode_excluir` para controlar exclusão
    - Adiciona campo `data_conclusao` para rastrear quando foi concluído
    - Adiciona campo `concluido_por` para saber quem concluiu
    - Ajusta constraint de prioridade para incluir 'baixa', 'média', 'alta'
    - Ajusta constraint de status: migra 'processado' para 'concluído'

  3. Notas Importantes
    - Sistema focado em lembretes que precisam ser concluídos
    - Usuário pode marcar como concluído ou cancelar
*/

-- 1. Adicionar campos de bônus em transferencia_pessoas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transferencia_pessoas' AND column_name = 'bonus'
  ) THEN
    ALTER TABLE transferencia_pessoas
    ADD COLUMN bonus integer DEFAULT 0 CHECK (bonus >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transferencia_pessoas' AND column_name = 'bonus_destino'
  ) THEN
    ALTER TABLE transferencia_pessoas
    ADD COLUMN bonus_destino integer DEFAULT 0 CHECK (bonus_destino >= 0);
  END IF;
END $$;

-- 2. Remover constraints antigas PRIMEIRO
ALTER TABLE atividades DROP CONSTRAINT IF EXISTS atividades_prioridade_check;
ALTER TABLE atividades DROP CONSTRAINT IF EXISTS atividades_status_check;

-- 3. Adicionar novos campos em atividades
DO $$
BEGIN
  -- Adicionar tipo_lembrete se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atividades' AND column_name = 'tipo_lembrete'
  ) THEN
    ALTER TABLE atividades ADD COLUMN tipo_lembrete text;
  END IF;

  -- Adicionar descricao_completa se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atividades' AND column_name = 'descricao_completa'
  ) THEN
    ALTER TABLE atividades ADD COLUMN descricao_completa text;
  END IF;

  -- Adicionar campo para marcar se pode ser excluída
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atividades' AND column_name = 'pode_excluir'
  ) THEN
    ALTER TABLE atividades ADD COLUMN pode_excluir boolean DEFAULT true;
  END IF;

  -- Adicionar data_conclusao se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atividades' AND column_name = 'data_conclusao'
  ) THEN
    ALTER TABLE atividades ADD COLUMN data_conclusao timestamp with time zone;
  END IF;

  -- Adicionar concluido_por se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atividades' AND column_name = 'concluido_por'
  ) THEN
    ALTER TABLE atividades ADD COLUMN concluido_por uuid REFERENCES usuarios(id);
  END IF;

  -- Adicionar usuario_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atividades' AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE atividades ADD COLUMN usuario_id uuid REFERENCES usuarios(id);
  END IF;
END $$;

-- 4. Migrar dados existentes
-- Migrar status 'processado' para 'concluído' e preencher data_conclusao
UPDATE atividades 
SET status = 'concluído',
    data_conclusao = processado_em,
    concluido_por = processado_por
WHERE status = 'processado';

-- Migrar prioridade 'normal' para 'média'
UPDATE atividades SET prioridade = 'média' WHERE prioridade = 'normal';

-- Mapear tipo_atividade para tipo_lembrete nas atividades existentes
UPDATE atividades
SET tipo_lembrete = CASE
  WHEN tipo_atividade = 'lembrete_downgrade' THEN 'downgrade_verificar'
  WHEN tipo_atividade = 'credito_clube' THEN 'credito_pontos_conferir'
  WHEN tipo_atividade = 'clube_credito_mensal' THEN 'credito_pontos_conferir'
  WHEN tipo_atividade = 'lembrete_milhas_expirando' THEN 'milhas_expirando'
  WHEN tipo_atividade LIKE '%vencimento%' THEN 'vencimento_clube'
  WHEN tipo_atividade LIKE '%pagamento%' THEN 'pagamento_pendente'
  WHEN tipo_atividade LIKE '%transferencia%' THEN 'transferencia_conferir'
  ELSE 'outro'
END
WHERE tipo_lembrete IS NULL;

-- Preencher descricao_completa com descricao existente se vazia
UPDATE atividades
SET descricao_completa = descricao
WHERE descricao_completa IS NULL AND descricao IS NOT NULL;

-- 5. Adicionar novas constraints DEPOIS de migrar os dados
ALTER TABLE atividades ADD CONSTRAINT atividades_prioridade_check 
  CHECK (prioridade IN ('baixa', 'média', 'alta', 'normal'));

ALTER TABLE atividades ADD CONSTRAINT atividades_status_check 
  CHECK (status IN ('pendente', 'concluído', 'cancelado'));

ALTER TABLE atividades ADD CONSTRAINT atividades_tipo_lembrete_check
  CHECK (tipo_lembrete IN (
    'downgrade_verificar',
    'credito_pontos_conferir',
    'milhas_expirando',
    'vencimento_clube',
    'pagamento_pendente',
    'transferencia_conferir',
    'outro'
  ));

-- 6. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_atividades_status ON atividades(status);
CREATE INDEX IF NOT EXISTS idx_atividades_tipo_lembrete ON atividades(tipo_lembrete);
CREATE INDEX IF NOT EXISTS idx_atividades_data_prevista ON atividades(data_prevista);
CREATE INDEX IF NOT EXISTS idx_atividades_usuario_status ON atividades(usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_atividades_prioridade ON atividades(prioridade);

-- 7. Atualizar comentários
COMMENT ON TABLE atividades IS 'Sistema de lembretes e notificações para tarefas a serem realizadas pelo usuário';
COMMENT ON COLUMN atividades.status IS 'Status do lembrete: pendente (ainda não feito), concluído (já realizado), cancelado (não é mais necessário)';
COMMENT ON COLUMN atividades.tipo_lembrete IS 'Categoria do lembrete para melhor organização';
COMMENT ON COLUMN atividades.data_prevista IS 'Data em que o usuário deve ser lembrado desta tarefa';
COMMENT ON COLUMN atividades.prioridade IS 'Nível de prioridade do lembrete: baixa, média, alta';
COMMENT ON COLUMN atividades.descricao_completa IS 'Descrição detalhada do que precisa ser feito';
COMMENT ON COLUMN atividades.pode_excluir IS 'Define se o usuário pode excluir este lembrete';
COMMENT ON COLUMN atividades.data_conclusao IS 'Data e hora em que o lembrete foi concluído';
COMMENT ON COLUMN atividades.concluido_por IS 'Usuário que marcou o lembrete como concluído';

-- Comentários para transferencia_pessoas
COMMENT ON COLUMN transferencia_pessoas.bonus IS 'Quantidade de pontos bônus sendo transferidos além dos pontos normais';
COMMENT ON COLUMN transferencia_pessoas.bonus_destino IS 'Quantidade de pontos bônus que o destinatário receberá';
