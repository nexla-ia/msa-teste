/*
  # Adicionar tipo lembrete_downgrade às atividades e ajustar lógica

  1. Alterações
    - Adicionar tipo 'lembrete_downgrade' ao constraint de tipo_atividade
    - Ajustar função criar_atividade_downgrade_upgrade para:
      * Criar lembretes 5 dias antes da data
      * Verificar se lembrete foi excluído
      * Permitir recriação se foi excluído
    - Adicionar função para excluir lembrete

  2. Comportamento
    - Lembretes aparecem 5 dias antes da data de downgrade/upgrade
    - Podem ser excluídos pelo usuário
    - Sistema recria automaticamente se excluído e ainda estiver a 5 dias da data
*/

-- Atualizar constraint para incluir tipo lembrete_downgrade
ALTER TABLE atividades DROP CONSTRAINT IF EXISTS atividades_tipo_atividade_check;

ALTER TABLE atividades ADD CONSTRAINT atividades_tipo_atividade_check
  CHECK (tipo_atividade IN (
    'transferencia_entrada',
    'transferencia_bonus',
    'bumerangue_retorno',
    'clube_credito_mensal',
    'clube_credito_bonus',
    'lembrete_downgrade',
    'outro'
  ));

-- Atualizar função para criar atividades de lembrete de downgrade/upgrade
CREATE OR REPLACE FUNCTION criar_atividade_downgrade_upgrade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clube RECORD;
  v_data_inicio date;
  v_data_fim date;
  v_ultima_exclusao timestamptz;
BEGIN
  -- Definir período (5 dias antes até 30 dias depois)
  v_data_inicio := CURRENT_DATE;
  v_data_fim := CURRENT_DATE + INTERVAL '30 days';

  -- Buscar clubes com data de downgrade/upgrade próxima
  FOR v_clube IN
    SELECT 
      pc.id,
      pc.parceiro_id,
      pc.programa_id,
      pc.downgrade_upgrade_data,
      pa.nome_parceiro,
      pf.nome as programa_nome
    FROM programas_clubes pc
    JOIN parceiros pa ON pa.id = pc.parceiro_id
    JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    WHERE pc.downgrade_upgrade_data IS NOT NULL
      AND pc.downgrade_upgrade_data >= v_data_inicio
      AND pc.downgrade_upgrade_data <= v_data_fim
      AND pc.tem_clube = true
  LOOP
    -- Verificar se já existe atividade ativa (não excluída)
    IF NOT EXISTS (
      SELECT 1 FROM atividades
      WHERE referencia_id = v_clube.id
        AND referencia_tabela = 'programas_clubes'
        AND tipo_atividade = 'lembrete_downgrade'
        AND data_prevista = v_clube.downgrade_upgrade_data
        AND status != 'cancelado'
    ) THEN
      -- Verificar se deve criar lembrete (5 dias antes ou já passou)
      IF v_clube.downgrade_upgrade_data <= CURRENT_DATE + INTERVAL '5 days' THEN
        -- Buscar última vez que foi excluído
        SELECT MAX(updated_at) INTO v_ultima_exclusao
        FROM atividades
        WHERE referencia_id = v_clube.id
          AND referencia_tabela = 'programas_clubes'
          AND tipo_atividade = 'lembrete_downgrade'
          AND data_prevista = v_clube.downgrade_upgrade_data
          AND status = 'cancelado';

        -- Só criar se nunca foi excluído OU se foi excluído há mais de 1 dia
        IF v_ultima_exclusao IS NULL OR v_ultima_exclusao < CURRENT_DATE - INTERVAL '1 day' THEN
          -- Criar atividade de lembrete
          INSERT INTO atividades (
            tipo_atividade,
            titulo,
            descricao,
            parceiro_id,
            parceiro_nome,
            programa_id,
            programa_nome,
            data_prevista,
            referencia_id,
            referencia_tabela,
            status,
            prioridade,
            observacoes,
            created_at
          ) VALUES (
            'lembrete_downgrade',
            'Lembrete: Downgrade/Upgrade',
            'Verificar necessidade de Downgrade/Upgrade para ' || v_clube.nome_parceiro || ' - ' || v_clube.programa_nome,
            v_clube.parceiro_id,
            v_clube.nome_parceiro,
            v_clube.programa_id,
            v_clube.programa_nome,
            v_clube.downgrade_upgrade_data,
            v_clube.id,
            'programas_clubes',
            'pendente',
            'normal',
            'Verificar Downgrade/Upgrade agendado para ' || TO_CHAR(v_clube.downgrade_upgrade_data, 'DD/MM/YYYY'),
            now()
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Adicionar aos tipos de atividades conhecidos
COMMENT ON COLUMN atividades.tipo_atividade IS 
'Tipos de atividades:
- transferencia_entrada: Entrada de transferência
- transferencia_bonus: Bônus de transferência
- bumerangue_retorno: Retorno de bumerangue
- clube_credito_mensal: Crédito mensal de clube
- clube_credito_bonus: Bônus de clube
- lembrete_downgrade: Lembrete de downgrade/upgrade
- outro: Outras atividades';
