/*
  # Criar trigger e job para lembretes de downgrade/upgrade

  1. Alterações
    - Criar trigger que dispara quando downgrade_upgrade_data é inserido/atualizado
    - Criar job diário para verificar e criar lembretes
    - Executar função inicial para criar lembretes existentes

  2. Comportamento
    - Quando um registro de programas_clubes é criado/atualizado com downgrade_upgrade_data,
      verifica se deve criar lembrete (5 dias antes ou menos)
    - Job diário executa às 8h para verificar todos os registros e criar lembretes necessários
*/

-- Função auxiliar para criar lembrete individual
CREATE OR REPLACE FUNCTION criar_lembrete_downgrade_individual(p_clube_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clube RECORD;
  v_ultima_exclusao timestamptz;
BEGIN
  -- Buscar dados do clube
  SELECT 
    pc.id,
    pc.parceiro_id,
    pc.programa_id,
    pc.downgrade_upgrade_data,
    pa.nome_parceiro,
    pf.nome as programa_nome
  INTO v_clube
  FROM programas_clubes pc
  JOIN parceiros pa ON pa.id = pc.parceiro_id
  JOIN programas_fidelidade pf ON pf.id = pc.programa_id
  WHERE pc.id = p_clube_id
    AND pc.downgrade_upgrade_data IS NOT NULL
    AND pc.tem_clube = true;

  -- Se não encontrou ou não tem data, retornar
  IF NOT FOUND OR v_clube.downgrade_upgrade_data IS NULL THEN
    RETURN;
  END IF;

  -- Verificar se já existe atividade ativa (não excluída)
  IF EXISTS (
    SELECT 1 FROM atividades
    WHERE referencia_id = v_clube.id
      AND referencia_tabela = 'programas_clubes'
      AND tipo_atividade = 'lembrete_downgrade'
      AND data_prevista = v_clube.downgrade_upgrade_data
      AND status != 'cancelado'
  ) THEN
    RETURN;
  END IF;

  -- Verificar se deve criar lembrete (5 dias antes ou já passou, mas ainda dentro de 30 dias)
  IF v_clube.downgrade_upgrade_data >= CURRENT_DATE 
     AND v_clube.downgrade_upgrade_data <= CURRENT_DATE + INTERVAL '30 days'
     AND v_clube.downgrade_upgrade_data <= CURRENT_DATE + INTERVAL '5 days' THEN
    
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
END;
$$;

-- Trigger para criar lembrete quando downgrade_upgrade_data é inserido/atualizado
CREATE OR REPLACE FUNCTION trigger_criar_lembrete_downgrade()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processar se downgrade_upgrade_data foi definido/alterado
  IF NEW.downgrade_upgrade_data IS NOT NULL 
     AND (TG_OP = 'INSERT' OR OLD.downgrade_upgrade_data IS DISTINCT FROM NEW.downgrade_upgrade_data) THEN
    
    -- Cancelar lembretes antigos se a data mudou
    IF TG_OP = 'UPDATE' AND OLD.downgrade_upgrade_data IS DISTINCT FROM NEW.downgrade_upgrade_data THEN
      UPDATE atividades
      SET status = 'cancelado',
          updated_at = now()
      WHERE referencia_id = NEW.id
        AND referencia_tabela = 'programas_clubes'
        AND tipo_atividade = 'lembrete_downgrade'
        AND status = 'pendente';
    END IF;

    -- Criar novo lembrete se necessário
    PERFORM criar_lembrete_downgrade_individual(NEW.id);
  END IF;

  -- Se downgrade_upgrade_data foi removido, cancelar lembretes
  IF NEW.downgrade_upgrade_data IS NULL AND OLD.downgrade_upgrade_data IS NOT NULL THEN
    UPDATE atividades
    SET status = 'cancelado',
        updated_at = now()
    WHERE referencia_id = NEW.id
      AND referencia_tabela = 'programas_clubes'
      AND tipo_atividade = 'lembrete_downgrade'
      AND status = 'pendente';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_criar_lembrete_downgrade ON programas_clubes;
CREATE TRIGGER trigger_criar_lembrete_downgrade
  AFTER INSERT OR UPDATE OF downgrade_upgrade_data, tem_clube
  ON programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_criar_lembrete_downgrade();

-- Criar job para executar diariamente a função de criar lembretes às 8h
DO $$
BEGIN
  -- Tentar desabilitar job antigo se existir
  PERFORM cron.unschedule('criar_lembretes_downgrade_upgrade_diario');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- Criar job para verificar lembretes diariamente às 8h
  PERFORM cron.schedule(
    'criar_lembretes_downgrade_upgrade_diario',
    '0 8 * * *',
    'SELECT criar_atividade_downgrade_upgrade();'
  );
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- Executar função inicial para criar lembretes existentes
SELECT criar_atividade_downgrade_upgrade();