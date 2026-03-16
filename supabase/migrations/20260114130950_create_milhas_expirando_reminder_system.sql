/*
  # Criar sistema de lembretes para milhas expirando

  1. Alterações
    - Adicionar campo milhas_expirando_data (date) na tabela programas_clubes
    - Criar função para criar lembretes de milhas expirando
    - Criar trigger para gerar lembretes automaticamente
    - Criar job diário para verificar e criar lembretes

  2. Comportamento
    - Quando milhas_expirando_data é definido, cria lembrete automaticamente (5 dias antes)
    - Job diário executa às 8h para verificar todos os registros
    - Lembretes aparecem na tela de Atividades automaticamente
*/

-- Adicionar campo milhas_expirando_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programas_clubes' AND column_name = 'milhas_expirando_data'
  ) THEN
    ALTER TABLE programas_clubes ADD COLUMN milhas_expirando_data date;
  END IF;
END $$;

-- Função para criar lembrete individual de milhas expirando
CREATE OR REPLACE FUNCTION criar_lembrete_milhas_expirando_individual(p_clube_id uuid)
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
    pc.milhas_expirando_data,
    pa.nome_parceiro,
    pf.nome as programa_nome
  INTO v_clube
  FROM programas_clubes pc
  JOIN parceiros pa ON pa.id = pc.parceiro_id
  JOIN programas_fidelidade pf ON pf.id = pc.programa_id
  WHERE pc.id = p_clube_id
    AND pc.milhas_expirando_data IS NOT NULL;

  -- Se não encontrou ou não tem data, retornar
  IF NOT FOUND OR v_clube.milhas_expirando_data IS NULL THEN
    RETURN;
  END IF;

  -- Verificar se já existe atividade ativa (não excluída)
  IF EXISTS (
    SELECT 1 FROM atividades
    WHERE referencia_id = v_clube.id
      AND referencia_tabela = 'programas_clubes'
      AND tipo_atividade = 'lembrete_milhas_expirando'
      AND data_prevista = v_clube.milhas_expirando_data
      AND status != 'cancelado'
  ) THEN
    RETURN;
  END IF;

  -- Verificar se deve criar lembrete (5 dias antes ou já passou, mas ainda dentro de 30 dias)
  IF v_clube.milhas_expirando_data >= CURRENT_DATE 
     AND v_clube.milhas_expirando_data <= CURRENT_DATE + INTERVAL '30 days'
     AND v_clube.milhas_expirando_data <= CURRENT_DATE + INTERVAL '5 days' THEN
    
    -- Buscar última vez que foi excluído
    SELECT MAX(updated_at) INTO v_ultima_exclusao
    FROM atividades
    WHERE referencia_id = v_clube.id
      AND referencia_tabela = 'programas_clubes'
      AND tipo_atividade = 'lembrete_milhas_expirando'
      AND data_prevista = v_clube.milhas_expirando_data
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
        'lembrete_milhas_expirando',
        'Lembrete: Milhas Expirando',
        'Atenção! Milhas expirando para ' || v_clube.nome_parceiro || ' - ' || v_clube.programa_nome,
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_clube.milhas_expirando_data,
        v_clube.id,
        'programas_clubes',
        'pendente',
        'alta',
        'Milhas com vencimento em ' || TO_CHAR(v_clube.milhas_expirando_data, 'DD/MM/YYYY'),
        now()
      );
    END IF;
  END IF;
END;
$$;

-- Função para criar todos os lembretes de milhas expirando
CREATE OR REPLACE FUNCTION criar_atividade_milhas_expirando()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clube RECORD;
BEGIN
  -- Buscar todos os clubes com milhas_expirando_data definido
  FOR v_clube IN
    SELECT id
    FROM programas_clubes
    WHERE milhas_expirando_data IS NOT NULL
      AND milhas_expirando_data >= CURRENT_DATE
      AND milhas_expirando_data <= CURRENT_DATE + INTERVAL '30 days'
  LOOP
    -- Criar lembrete individual
    PERFORM criar_lembrete_milhas_expirando_individual(v_clube.id);
  END LOOP;
END;
$$;

-- Trigger para criar lembrete quando milhas_expirando_data é inserido/atualizado
CREATE OR REPLACE FUNCTION trigger_criar_lembrete_milhas_expirando()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processar se milhas_expirando_data foi definido/alterado
  IF NEW.milhas_expirando_data IS NOT NULL 
     AND (TG_OP = 'INSERT' OR OLD.milhas_expirando_data IS DISTINCT FROM NEW.milhas_expirando_data) THEN
    
    -- Cancelar lembretes antigos se a data mudou
    IF TG_OP = 'UPDATE' AND OLD.milhas_expirando_data IS DISTINCT FROM NEW.milhas_expirando_data THEN
      UPDATE atividades
      SET status = 'cancelado',
          updated_at = now()
      WHERE referencia_id = NEW.id
        AND referencia_tabela = 'programas_clubes'
        AND tipo_atividade = 'lembrete_milhas_expirando'
        AND status = 'pendente';
    END IF;

    -- Criar novo lembrete se necessário
    PERFORM criar_lembrete_milhas_expirando_individual(NEW.id);
  END IF;

  -- Se milhas_expirando_data foi removido, cancelar lembretes
  IF NEW.milhas_expirando_data IS NULL AND OLD.milhas_expirando_data IS NOT NULL THEN
    UPDATE atividades
    SET status = 'cancelado',
        updated_at = now()
    WHERE referencia_id = NEW.id
      AND referencia_tabela = 'programas_clubes'
      AND tipo_atividade = 'lembrete_milhas_expirando'
      AND status = 'pendente';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_criar_lembrete_milhas_expirando ON programas_clubes;
CREATE TRIGGER trigger_criar_lembrete_milhas_expirando
  AFTER INSERT OR UPDATE OF milhas_expirando_data
  ON programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_criar_lembrete_milhas_expirando();

-- Criar job para executar diariamente a função de criar lembretes às 8h
DO $$
BEGIN
  -- Tentar desabilitar job antigo se existir
  PERFORM cron.unschedule('criar_lembretes_milhas_expirando_diario');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- Criar job para verificar lembretes diariamente às 8h
  PERFORM cron.schedule(
    'criar_lembretes_milhas_expirando_diario',
    '0 8 * * *',
    'SELECT criar_atividade_milhas_expirando();'
  );
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- Executar função inicial para criar lembretes existentes (se houver)
SELECT criar_atividade_milhas_expirando();