/*
  # Alterar campo downgrade/upgrade para data e adicionar lógica de lembretes

  1. Alterações
    - Renomear coluna downgrade_upgrade para downgrade_upgrade_data
    - Alterar tipo para date
    - Criar função para verificar e criar atividades de lembrete
    - Criar função para ajustar lógica de créditos recorrentes baseada na data de assinatura

  2. Comportamento
    - Campo downgrade_upgrade_data armazena a data planejada para fazer downgrade/upgrade
    - Sistema cria atividade de lembrete quando estiver na semana da data escolhida
    - Créditos recorrentes baseados na data de assinatura:
      * Mensal: a cada 30 dias da data de assinatura
      * Trimestral: a cada 3 meses da data de assinatura
      * Anual: a cada 1 ano da data de assinatura
*/

-- Renomear e alterar tipo da coluna downgrade_upgrade
DO $$
BEGIN
  -- Verificar se a coluna antiga existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programas_clubes' AND column_name = 'downgrade_upgrade'
  ) THEN
    -- Adicionar nova coluna
    ALTER TABLE programas_clubes ADD COLUMN IF NOT EXISTS downgrade_upgrade_data date;
    
    -- Tentar converter dados existentes (se possível)
    UPDATE programas_clubes
    SET downgrade_upgrade_data = CASE
      WHEN downgrade_upgrade ~ '^\d{4}-\d{2}-\d{2}$' THEN downgrade_upgrade::date
      ELSE NULL
    END
    WHERE downgrade_upgrade IS NOT NULL;
    
    -- Remover coluna antiga
    ALTER TABLE programas_clubes DROP COLUMN downgrade_upgrade;
  ELSE
    -- Se já foi migrado, apenas garantir que a nova coluna existe
    ALTER TABLE programas_clubes ADD COLUMN IF NOT EXISTS downgrade_upgrade_data date;
  END IF;
END $$;

-- Função para criar atividades de lembrete de downgrade/upgrade
CREATE OR REPLACE FUNCTION criar_atividade_downgrade_upgrade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clube RECORD;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Definir período da semana (hoje até 7 dias a frente)
  v_data_inicio := CURRENT_DATE;
  v_data_fim := CURRENT_DATE + INTERVAL '7 days';

  -- Buscar clubes com data de downgrade/upgrade na próxima semana
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
    WHERE pc.downgrade_upgrade_data >= v_data_inicio
      AND pc.downgrade_upgrade_data <= v_data_fim
      AND pc.tem_clube = true
  LOOP
    -- Verificar se já existe atividade para este clube e data
    IF NOT EXISTS (
      SELECT 1 FROM atividades
      WHERE programa_clube_id = v_clube.id
        AND tipo = 'Lembrete'
        AND observacao LIKE '%Downgrade/Upgrade%'
        AND data_atividade = v_clube.downgrade_upgrade_data
    ) THEN
      -- Criar atividade de lembrete
      INSERT INTO atividades (
        parceiro_id,
        programa_id,
        programa_clube_id,
        tipo,
        data_atividade,
        observacao,
        status,
        created_at
      ) VALUES (
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.id,
        'Lembrete',
        v_clube.downgrade_upgrade_data,
        'Lembrete: Verificar Downgrade/Upgrade para ' || v_clube.nome_parceiro || ' - ' || v_clube.programa_nome,
        'Pendente',
        now()
      );
    END IF;
  END LOOP;
END;
$$;

-- Função para processar créditos recorrentes baseados na data de assinatura
CREATE OR REPLACE FUNCTION processar_creditos_clubes_recorrentes()
RETURNS TABLE(
  parceiro_nome text,
  programa_nome text,
  quantidade_creditada numeric,
  data_credito date,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clube RECORD;
  v_dias_desde_assinatura integer;
  v_deve_creditar boolean;
  v_ultima_data_credito date;
  v_proxima_data_credito date;
BEGIN
  -- Buscar clubes com bônus recorrente ativo
  FOR v_clube IN
    SELECT 
      pc.id,
      pc.parceiro_id,
      pc.programa_id,
      pc.data_ultima_assinatura,
      pc.bonus_quantidade_pontos,
      pc.sequencia,
      pa.nome_parceiro,
      pf.nome as programa_nome
    FROM programas_clubes pc
    JOIN parceiros pa ON pa.id = pc.parceiro_id
    JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    WHERE pc.tem_clube = true
      AND pc.bonus_quantidade_pontos > 0
      AND pc.sequencia IS NOT NULL
      AND pc.data_ultima_assinatura IS NOT NULL
  LOOP
    v_deve_creditar := false;
    
    -- Buscar última data de crédito nas atividades
    SELECT MAX(data_atividade) INTO v_ultima_data_credito
    FROM atividades
    WHERE programa_clube_id = v_clube.id
      AND tipo = 'Crédito Clube'
      AND observacao LIKE '%Bônus Recorrente%';

    -- Se nunca foi creditado, usar data de assinatura como base
    IF v_ultima_data_credito IS NULL THEN
      v_ultima_data_credito := v_clube.data_ultima_assinatura;
    END IF;

    -- Calcular tempo desde último crédito
    v_dias_desde_assinatura := CURRENT_DATE - v_ultima_data_credito;
    
    -- Verificar se deve creditar baseado na frequência
    IF v_clube.sequencia = 'mensal' AND v_dias_desde_assinatura >= 30 THEN
      v_deve_creditar := true;
      v_proxima_data_credito := v_ultima_data_credito + INTERVAL '30 days';
    ELSIF v_clube.sequencia = 'trimestral' AND v_dias_desde_assinatura >= 90 THEN
      v_deve_creditar := true;
      v_proxima_data_credito := v_ultima_data_credito + INTERVAL '3 months';
    ELSIF v_clube.sequencia = 'anual' AND v_dias_desde_assinatura >= 365 THEN
      v_deve_creditar := true;
      v_proxima_data_credito := v_ultima_data_credito + INTERVAL '1 year';
    END IF;

    -- Se deve creditar, processar
    IF v_deve_creditar THEN
      -- Atualizar estoque
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.bonus_quantidade_pontos,
        'Entrada',
        0
      );

      -- Criar atividade
      PERFORM criar_atividade_clube(
        v_clube.id,
        v_clube.parceiro_id,
        v_clube.programa_id,
        'Crédito Clube',
        v_proxima_data_credito::date,
        v_clube.bonus_quantidade_pontos,
        'Bônus Recorrente ' || INITCAP(v_clube.sequencia) || ' - ' || v_clube.bonus_quantidade_pontos || ' pontos'
      );

      -- Retornar resultado
      RETURN QUERY SELECT 
        v_clube.nome_parceiro,
        v_clube.programa_nome,
        v_clube.bonus_quantidade_pontos,
        v_proxima_data_credito::date,
        'Creditado'::text;
    END IF;
  END LOOP;
END;
$$;