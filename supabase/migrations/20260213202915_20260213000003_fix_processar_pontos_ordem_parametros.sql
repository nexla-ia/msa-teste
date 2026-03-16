/*
  # Fix: Corrigir Ordem dos Parâmetros na Chamada de atualizar_estoque_pontos

  ## Problema
  - As funções estavam chamando atualizar_estoque_pontos com parâmetros na ordem errada
  
  ## Assinatura Correta da Função
  atualizar_estoque_pontos(
    p_parceiro_id uuid,
    p_programa_id uuid,
    p_quantidade numeric,
    p_tipo text,
    p_valor_total numeric DEFAULT 0,
    p_origem text DEFAULT NULL,
    p_observacao text DEFAULT NULL,
    p_referencia_id uuid DEFAULT NULL,
    p_referencia_tabela text DEFAULT NULL
  )

  ## Solução
  - Recriar as funções com a ordem correta dos parâmetros nas chamadas
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS processar_pontos_mes_atual(UUID);
DROP FUNCTION IF EXISTS processar_pontos_retroativos(UUID);
DROP FUNCTION IF EXISTS processar_creditos_clubes();

-- =====================================================
-- 1. processar_pontos_mes_atual: Ordem de parâmetros correta
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
  -- Get clube data with correct column names
  SELECT 
    pc.*, 
    cf.parceiro_principal_id as parceiro_titular_id
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

  -- Calculate regular points value using correct column names
  v_pontos_regulares := COALESCE(v_clube.quantidade_pontos, 0);
  v_valor_credito := COALESCE(v_clube.valor, 0);

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

  -- Register entry in estoque for current month - CORRECT PARAMETER ORDER
  PERFORM atualizar_estoque_pontos(
    v_parceiro_titular_id,      -- p_parceiro_id
    v_clube.programa_id,         -- p_programa_id
    v_pontos_regulares,          -- p_quantidade
    'entrada',                   -- p_tipo
    v_valor_credito,             -- p_valor_total
    'clube_credito',             -- p_origem
    'Crédito clube - mês atual', -- p_observacao
    v_atividade_id,              -- p_referencia_id
    'atividades'                 -- p_referencia_tabela
  );
END;
$$;

-- =====================================================
-- 2. processar_pontos_retroativos: Ordem de parâmetros correta
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
  -- Get clube data with correct column names
  SELECT 
    pc.*, 
    cf.parceiro_principal_id as parceiro_titular_id
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

  -- Calculate regular points value using correct column names
  v_pontos_regulares := COALESCE(v_clube.quantidade_pontos, 0);
  v_valor_credito := COALESCE(v_clube.valor, 0);

  -- Process retroactive months (NO BONUS)
  -- Use data_ultima_assinatura as start date
  v_mes_retroativo := COALESCE(v_clube.data_ultima_assinatura, CURRENT_DATE);
  
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

    -- Register entry in estoque - CORRECT PARAMETER ORDER
    PERFORM atualizar_estoque_pontos(
      v_parceiro_titular_id,                                              -- p_parceiro_id
      v_clube.programa_id,                                                -- p_programa_id
      v_pontos_regulares,                                                 -- p_quantidade
      'entrada',                                                          -- p_tipo
      v_valor_credito,                                                    -- p_valor_total
      'clube_credito',                                                    -- p_origem
      'Crédito clube - retroativo ' || TO_CHAR(v_mes_retroativo, 'MM/YYYY'),  -- p_observacao
      v_atividade_id,                                                     -- p_referencia_id
      'atividades'                                                        -- p_referencia_tabela
    );

    -- Next month
    v_mes_retroativo := v_mes_retroativo + INTERVAL '1 month';
  END LOOP;
END;
$$;

-- =====================================================
-- 3. processar_creditos_clubes: Ordem de parâmetros correta
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
    SELECT 
      pc.*, 
      cf.parceiro_principal_id as parceiro_titular_id
    FROM programas_clubes pc
    JOIN conta_familia cf ON cf.id = pc.conta_familia_id
    WHERE pc.tem_clube = true
      AND pc.dia_cobranca IS NOT NULL
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

    -- Calculate months since subscription using correct column name
    v_meses_desde_assinatura := EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(v_clube.data_ultima_assinatura, CURRENT_DATE))) * 12 
                               + EXTRACT(MONTH FROM AGE(CURRENT_DATE, COALESCE(v_clube.data_ultima_assinatura, CURRENT_DATE)));

    -- Calculate regular points value using correct column names
    v_pontos_regulares := COALESCE(v_clube.quantidade_pontos, 0);
    v_valor_credito := COALESCE(v_clube.valor, 0);

    -- Initialize bonus
    v_bonus_pontos := 0;
    v_deve_ter_bonus := false;

    -- Calculate bonus based on frequency
    -- Use bonus_porcentagem as frequency (1, 3, 6, 12)
    IF v_clube.bonus_quantidade_pontos IS NOT NULL AND v_clube.bonus_quantidade_pontos > 0 
       AND v_clube.bonus_porcentagem IS NOT NULL AND v_clube.bonus_porcentagem > 0 THEN
      
      v_bonus_frequencia := v_clube.bonus_porcentagem::INTEGER;
      
      -- Check if this month should receive bonus
      -- Only if months_elapsed is >= 1 AND is a multiple of frequency
      IF v_meses_desde_assinatura > 0 
         AND v_meses_desde_assinatura % v_bonus_frequencia = 0 THEN
        v_bonus_pontos := v_clube.bonus_quantidade_pontos;
        v_deve_ter_bonus := true;
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
      v_valor_credito,
      v_parceiro_titular_id,
      v_clube.programa_id,
      'pendente',
      v_clube.id,
      'programas_clubes'
    )
    RETURNING id INTO v_atividade_id;

    -- Register regular points in estoque - CORRECT PARAMETER ORDER
    PERFORM atualizar_estoque_pontos(
      v_parceiro_titular_id,                                          -- p_parceiro_id
      v_clube.programa_id,                                            -- p_programa_id
      v_pontos_regulares,                                             -- p_quantidade
      'entrada',                                                      -- p_tipo
      v_valor_credito,                                                -- p_valor_total
      'clube_credito',                                                -- p_origem
      'Crédito clube - recorrente ' || TO_CHAR(CURRENT_DATE, 'MM/YYYY'),  -- p_observacao
      v_atividade_id,                                                 -- p_referencia_id
      'atividades'                                                    -- p_referencia_tabela
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
        0,  -- Bonus doesn't add extra cost
        v_parceiro_titular_id,
        v_clube.programa_id,
        'pendente',
        v_clube.id,
        'programas_clubes'
      )
      RETURNING id INTO v_atividade_id;

      -- Register bonus points in estoque - CORRECT PARAMETER ORDER
      PERFORM atualizar_estoque_pontos(
        v_parceiro_titular_id,  -- p_parceiro_id
        v_clube.programa_id,    -- p_programa_id
        v_bonus_pontos,         -- p_quantidade
        'entrada',              -- p_tipo
        0,                      -- p_valor_total (bonus doesn't add extra cost)
        'clube_credito',        -- p_origem
        'Bônus clube - ' ||     -- p_observacao
        CASE v_bonus_frequencia
          WHEN 1 THEN 'mensal'
          WHEN 3 THEN 'trimestral'
          WHEN 6 THEN 'semestral'
          WHEN 12 THEN 'anual'
          ELSE v_bonus_frequencia::TEXT || ' meses'
        END,
        v_atividade_id,         -- p_referencia_id
        'atividades'            -- p_referencia_tabela
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION processar_creditos_clubes() IS 
'Processes monthly recurring clube credits with bonus based on frequency. 
Uses correct column names and parameter order for atualizar_estoque_pontos.';
