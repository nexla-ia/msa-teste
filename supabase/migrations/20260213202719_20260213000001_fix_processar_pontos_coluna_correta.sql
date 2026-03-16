/*
  # Fix: Corrigir Nome da Coluna nas Funções de Processar Pontos

  ## Problema
  - As funções `processar_pontos_mes_atual`, `processar_pontos_retroativos` e `processar_creditos_clubes`
    estavam usando a coluna `cf.parceiro_titular_id` que não existe
  - A coluna correta na tabela `conta_familia` é `parceiro_principal_id`

  ## Solução
  - Recriar as três funções com o nome correto da coluna
  - Todas as referências a `parceiro_titular_id` são substituídas por `parceiro_principal_id`

  ## Funções Corrigidas
  1. processar_pontos_mes_atual
  2. processar_pontos_retroativos
  3. processar_creditos_clubes
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS processar_pontos_mes_atual(UUID);
DROP FUNCTION IF EXISTS processar_pontos_retroativos(UUID);
DROP FUNCTION IF EXISTS processar_creditos_clubes();

-- =====================================================
-- 1. Fix processar_pontos_mes_atual: Usar parceiro_principal_id
-- =====================================================
CREATE OR REPLACE FUNCTION processar_pontos_mes_atual(p_clube_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clube RECORD;
  v_parceiro_titular_id UUID;
  v_valor_credito NUMERIC;
  v_pontos_regulares INTEGER;
  v_atividade_id UUID;
BEGIN
  -- Get clube data with correct column name
  SELECT pc.*, cf.parceiro_principal_id as parceiro_titular_id
  INTO v_clube
  FROM programas_clubes pc
  JOIN conta_familia cf ON cf.id = pc.conta_familia_id
  WHERE pc.id = p_clube_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clube não encontrado';
  END IF;

  -- Validate that titular exists
  v_parceiro_titular_id := v_clube.parceiro_titular_id;
  IF v_parceiro_titular_id IS NULL THEN
    RAISE EXCEPTION 'Titular da conta família não encontrado';
  END IF;

  -- Calculate regular points value
  v_pontos_regulares := v_clube.pontos_acumulo;
  v_valor_credito := v_clube.valor_mensalidade;

  -- Create activity for current month (regular points ONLY, NO BONUS)
  INSERT INTO atividades (
    tipo_atividade,
    titulo,
    descricao,
    quantidade_pontos,
    valor,
    parceiro_id,
    programa_id,
    status,
    referencia_id,
    referencia_tabela
  ) VALUES (
    'credito_clube',
    'Crédito clube - mês atual',
    'Crédito clube - mês atual (assinatura)',
    v_pontos_regulares,
    v_valor_credito,
    v_parceiro_titular_id,
    v_clube.programa_id,
    'pendente',
    p_clube_id,
    'programas_clubes'
  )
  RETURNING id INTO v_atividade_id;

  -- Register entry in estoque for current month
  PERFORM atualizar_estoque_pontos(
    v_parceiro_titular_id,
    v_clube.programa_id,
    v_pontos_regulares,
    'entrada',
    v_valor_credito,
    'clube_credito',
    v_atividade_id,
    'atividades',
    'Crédito clube - mês atual'
  );
END;
$$;

-- =====================================================
-- 2. Fix processar_pontos_retroativos: Usar parceiro_principal_id
-- =====================================================
CREATE OR REPLACE FUNCTION processar_pontos_retroativos(p_clube_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clube RECORD;
  v_parceiro_titular_id UUID;
  v_valor_credito NUMERIC;
  v_pontos_regulares INTEGER;
  v_mes_retroativo DATE;
  v_atividade_id UUID;
BEGIN
  -- Get clube data with correct column name
  SELECT pc.*, cf.parceiro_principal_id as parceiro_titular_id
  INTO v_clube
  FROM programas_clubes pc
  JOIN conta_familia cf ON cf.id = pc.conta_familia_id
  WHERE pc.id = p_clube_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clube não encontrado';
  END IF;

  -- Validate that titular exists
  v_parceiro_titular_id := v_clube.parceiro_titular_id;
  IF v_parceiro_titular_id IS NULL THEN
    RAISE EXCEPTION 'Titular da conta família não encontrado';
  END IF;

  -- Calculate regular points value
  v_pontos_regulares := v_clube.pontos_acumulo;
  v_valor_credito := v_clube.valor_mensalidade;

  -- Process retroactive months (NO BONUS)
  v_mes_retroativo := v_clube.data_assinatura;
  
  WHILE v_mes_retroativo < DATE_TRUNC('month', CURRENT_DATE) LOOP
    -- Create activity for retroactive month (regular points ONLY)
    INSERT INTO atividades (
      tipo_atividade,
      titulo,
      descricao,
      quantidade_pontos,
      valor,
      parceiro_id,
      programa_id,
      status,
      referencia_id,
      referencia_tabela
    ) VALUES (
      'credito_clube',
      'Crédito clube - retroativo',
      'Crédito clube - retroativo ' || TO_CHAR(v_mes_retroativo, 'MM/YYYY'),
      v_pontos_regulares,
      v_valor_credito,
      v_parceiro_titular_id,
      v_clube.programa_id,
      'pendente',
      p_clube_id,
      'programas_clubes'
    )
    RETURNING id INTO v_atividade_id;

    -- Register entry in estoque
    PERFORM atualizar_estoque_pontos(
      v_parceiro_titular_id,
      v_clube.programa_id,
      v_pontos_regulares,
      'entrada',
      v_valor_credito,
      'clube_credito',
      v_atividade_id,
      'atividades',
      'Crédito clube - retroativo ' || TO_CHAR(v_mes_retroativo, 'MM/YYYY')
    );

    -- Next month
    v_mes_retroativo := v_mes_retroativo + INTERVAL '1 month';
  END LOOP;
END;
$$;

-- =====================================================
-- 3. Fix processar_creditos_clubes: Usar parceiro_principal_id
-- =====================================================
CREATE OR REPLACE FUNCTION processar_creditos_clubes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clube RECORD;
  v_parceiro_titular_id UUID;
  v_dia_cobranca INTEGER;
  v_valor_credito NUMERIC;
  v_pontos_regulares INTEGER;
  v_bonus_pontos INTEGER;
  v_bonus_frequencia INTEGER;
  v_meses_desde_assinatura INTEGER;
  v_deve_ter_bonus BOOLEAN;
  v_atividade_id UUID;
BEGIN
  -- Process all active clubes on their billing day
  FOR v_clube IN 
    SELECT pc.*, cf.parceiro_principal_id as parceiro_titular_id
    FROM programas_clubes pc
    JOIN conta_familia cf ON cf.id = pc.conta_familia_id
    WHERE pc.ativo = true
      AND pc.dia_cobranca = EXTRACT(DAY FROM CURRENT_DATE)
      AND NOT EXISTS (
        SELECT 1 FROM atividades a
        WHERE a.referencia_id = pc.id
          AND a.referencia_tabela = 'programas_clubes'
          AND a.tipo_atividade = 'credito_clube'
          AND DATE_TRUNC('month', a.created_at) = DATE_TRUNC('month', CURRENT_DATE)
      )
  LOOP
    -- Get titular
    v_parceiro_titular_id := v_clube.parceiro_titular_id;
    IF v_parceiro_titular_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Calculate months since subscription
    v_meses_desde_assinatura := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_clube.data_assinatura)) * 12 
                               + EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_clube.data_assinatura));

    -- Calculate regular points value
    v_pontos_regulares := v_clube.pontos_acumulo;
    v_valor_credito := v_clube.valor_mensalidade;

    -- Initialize bonus
    v_bonus_pontos := 0;
    v_deve_ter_bonus := false;

    -- Calculate bonus based on frequency
    IF v_clube.bonus_pontos IS NOT NULL AND v_clube.bonus_pontos > 0 
       AND v_clube.bonus_frequencia IS NOT NULL AND v_clube.bonus_frequencia > 0 THEN
      
      v_bonus_frequencia := v_clube.bonus_frequencia;
      
      -- Check if this month should receive bonus
      -- Only if months_elapsed is >= 1 AND is a multiple of frequency
      IF v_meses_desde_assinatura > 0 
         AND v_meses_desde_assinatura % v_bonus_frequencia = 0 THEN
        v_bonus_pontos := v_clube.bonus_pontos;
        v_deve_ter_bonus := true;
        
        -- Add bonus value to total credit value
        IF v_clube.bonus_valor IS NOT NULL THEN
          v_valor_credito := v_valor_credito + v_clube.bonus_valor;
        END IF;
      END IF;
    END IF;

    -- Create activity for regular points
    INSERT INTO atividades (
      tipo_atividade,
      titulo,
      descricao,
      quantidade_pontos,
      valor,
      parceiro_id,
      programa_id,
      status,
      referencia_id,
      referencia_tabela
    ) VALUES (
      'credito_clube',
      'Crédito clube - recorrente',
      'Crédito clube - recorrente ' || TO_CHAR(CURRENT_DATE, 'MM/YYYY'),
      v_pontos_regulares,
      v_clube.valor_mensalidade,
      v_parceiro_titular_id,
      v_clube.programa_id,
      'pendente',
      v_clube.id,
      'programas_clubes'
    )
    RETURNING id INTO v_atividade_id;

    -- Register regular points in estoque
    PERFORM atualizar_estoque_pontos(
      v_parceiro_titular_id,
      v_clube.programa_id,
      v_pontos_regulares,
      'entrada',
      v_clube.valor_mensalidade,
      'clube_credito',
      v_atividade_id,
      'atividades',
      'Crédito clube - recorrente ' || TO_CHAR(CURRENT_DATE, 'MM/YYYY')
    );

    -- If bonus is due, create separate activity and estoque entry
    IF v_deve_ter_bonus THEN
      INSERT INTO atividades (
        tipo_atividade,
        titulo,
        descricao,
        quantidade_pontos,
        valor,
        parceiro_id,
        programa_id,
        status,
        referencia_id,
        referencia_tabela
      ) VALUES (
        'credito_clube',
        'Bônus clube',
        'Bônus clube - ' || 
        CASE v_bonus_frequencia
          WHEN 1 THEN 'mensal'
          WHEN 3 THEN 'trimestral'
          WHEN 6 THEN 'semestral'
          WHEN 12 THEN 'anual'
          ELSE v_bonus_frequencia::TEXT || ' meses'
        END || ' - ' || TO_CHAR(CURRENT_DATE, 'MM/YYYY'),
        v_bonus_pontos,
        COALESCE(v_clube.bonus_valor, 0),
        v_parceiro_titular_id,
        v_clube.programa_id,
        'pendente',
        v_clube.id,
        'programas_clubes'
      )
      RETURNING id INTO v_atividade_id;

      -- Register bonus points in estoque
      PERFORM atualizar_estoque_pontos(
        v_parceiro_titular_id,
        v_clube.programa_id,
        v_bonus_pontos,
        'entrada',
        COALESCE(v_clube.bonus_valor, 0),
        'clube_credito',
        v_atividade_id,
        'atividades',
        'Bônus clube - ' || 
        CASE v_bonus_frequencia
          WHEN 1 THEN 'mensal'
          WHEN 3 THEN 'trimestral'
          WHEN 6 THEN 'semestral'
          WHEN 12 THEN 'anual'
          ELSE v_bonus_frequencia::TEXT || ' meses'
        END
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION processar_creditos_clubes() IS 
'Processes monthly recurring clube credits with bonus based on frequency. 
Signup month = regular points only. 
Recurring months = regular points + bonus (if frequency cycle completed).';
