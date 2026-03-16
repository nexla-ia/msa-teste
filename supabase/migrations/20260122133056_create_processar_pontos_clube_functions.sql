/*
  # Criar funções para processar pontos de clube manualmente
  
  1. Descrição
    Cria duas funções para permitir processamento manual de pontos de clube:
    - processar_pontos_retroativos: Adiciona pontos de todos os meses desde a assinatura
    - processar_pontos_mes_atual: Processa pontos do mês atual imediatamente
  
  2. Casos de Uso
    - Quando cadastrar clube com data antiga, perguntar se quer pontos retroativos
    - Quando dia de cobrança já passou no mês, permitir processar imediatamente
  
  3. Funções
    a) processar_pontos_retroativos(clube_id)
       - Calcula quantos meses desde a assinatura até mês passado
       - Adiciona pontos de cada mês no estoque
       - Cria atividades para registro
       - Retorna quantidade de meses e pontos totais creditados
    
    b) processar_pontos_mes_atual(clube_id)
       - Verifica se dia de cobrança já passou
       - Processa pontos do mês atual
       - Cria atividade
       - Retorna se foi processado com sucesso
  
  4. Segurança
    - Verificações para evitar processamento duplicado
    - RLS policies para acesso
    - Registra tudo no histórico
*/

-- =====================================================
-- Função: processar_pontos_retroativos
-- =====================================================
CREATE OR REPLACE FUNCTION processar_pontos_retroativos(
  p_clube_id uuid
)
RETURNS TABLE (
  meses_processados int,
  pontos_regulares_total numeric,
  pontos_bonus_total numeric,
  pontos_total numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clube RECORD;
  v_mes_inicio date;
  v_mes_atual date;
  v_data_credito date;
  v_meses_count int := 0;
  v_pontos_reg_total numeric := 0;
  v_pontos_bonus_total numeric := 0;
BEGIN
  -- Buscar informações do clube
  SELECT 
    pc.*,
    p.nome_parceiro,
    pf.nome as programa_nome,
    pr.nome as produto_nome
  INTO v_clube
  FROM programas_clubes pc
  INNER JOIN parceiros p ON p.id = pc.parceiro_id
  LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
  LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
  WHERE pc.id = p_clube_id
    AND pc.tem_clube = true
    AND pc.data_ultima_assinatura IS NOT NULL
    AND pc.dia_cobranca IS NOT NULL
    AND pc.quantidade_pontos > 0;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clube não encontrado ou não está configurado corretamente';
  END IF;
  
  -- Data de início: primeiro dia do mês seguinte à assinatura
  v_mes_inicio := DATE_TRUNC('month', v_clube.data_ultima_assinatura::date + INTERVAL '1 month')::date;
  
  -- Data atual: primeiro dia do mês passado (não processa o mês atual)
  v_mes_atual := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date;
  
  -- Se não há meses para processar
  IF v_mes_inicio > v_mes_atual THEN
    RETURN QUERY SELECT 0, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;
  
  -- Loop pelos meses
  WHILE v_mes_inicio <= v_mes_atual LOOP
    -- Calcular data do crédito (dia de cobrança do mês)
    v_data_credito := MAKE_DATE(
      EXTRACT(YEAR FROM v_mes_inicio)::int,
      EXTRACT(MONTH FROM v_mes_inicio)::int,
      LEAST(v_clube.dia_cobranca, EXTRACT(DAY FROM (v_mes_inicio + INTERVAL '1 month - 1 day'))::int)
    );
    
    -- Verificar se já foi creditado neste mês
    IF NOT EXISTS (
      SELECT 1 
      FROM atividades 
      WHERE parceiro_id = v_clube.parceiro_id
        AND programa_id = v_clube.programa_id
        AND tipo_atividade = 'clube_credito_mensal'
        AND EXTRACT(MONTH FROM data_prevista) = EXTRACT(MONTH FROM v_data_credito)
        AND EXTRACT(YEAR FROM data_prevista) = EXTRACT(YEAR FROM v_data_credito)
        AND status = 'processado'
    ) THEN
      -- Creditar pontos regulares
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        0,
        'clube_credito_retroativo',
        'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') || ' referente a ' || 
        TO_CHAR(v_data_credito, 'MM/YYYY') || ' - ' || v_clube.quantidade_pontos || ' pontos',
        v_clube.id,
        'programas_clubes'
      );
      
      -- Criar atividade
      INSERT INTO atividades (
        tipo_atividade,
        titulo,
        descricao,
        parceiro_id,
        parceiro_nome,
        programa_id,
        programa_nome,
        quantidade_pontos,
        data_prevista,
        referencia_id,
        referencia_tabela,
        prioridade,
        status
      ) VALUES (
        'clube_credito_mensal',
        'Crédito retroativo de clube',
        'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') || ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY'),
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_clube.quantidade_pontos,
        v_data_credito,
        v_clube.id,
        'programas_clubes',
        'alta',
        'processado'
      );
      
      v_pontos_reg_total := v_pontos_reg_total + v_clube.quantidade_pontos;
      
      -- Se tem bônus, creditar também
      IF v_clube.bonus_quantidade_pontos > 0 THEN
        PERFORM atualizar_estoque_pontos(
          v_clube.parceiro_id,
          v_clube.programa_id,
          v_clube.bonus_quantidade_pontos,
          'Entrada',
          0,
          'clube_credito_bonus_retroativo',
          'Bônus retroativo do clube ' || COALESCE(v_clube.produto_nome, '') || ' referente a ' || 
          TO_CHAR(v_data_credito, 'MM/YYYY') || ' - ' || v_clube.bonus_quantidade_pontos || ' pontos',
          v_clube.id,
          'programas_clubes'
        );
        
        v_pontos_bonus_total := v_pontos_bonus_total + v_clube.bonus_quantidade_pontos;
      END IF;
      
      v_meses_count := v_meses_count + 1;
    END IF;
    
    -- Avançar para o próximo mês
    v_mes_inicio := (v_mes_inicio + INTERVAL '1 month')::date;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_meses_count, 
    v_pontos_reg_total,
    v_pontos_bonus_total,
    v_pontos_reg_total + v_pontos_bonus_total;
END;
$$;

COMMENT ON FUNCTION processar_pontos_retroativos(uuid) IS 
'Processa pontos retroativos de clube desde a data de assinatura até o mês passado (não processa o mês atual). Evita duplicação verificando atividades existentes. Retorna quantidade de meses processados e total de pontos creditados.';

-- =====================================================
-- Função: processar_pontos_mes_atual
-- =====================================================
CREATE OR REPLACE FUNCTION processar_pontos_mes_atual(
  p_clube_id uuid
)
RETURNS TABLE (
  processado boolean,
  pontos_creditados numeric,
  mensagem text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clube RECORD;
  v_dia_atual int;
  v_pontos_total numeric := 0;
  v_data_referencia date;
BEGIN
  -- Buscar informações do clube
  SELECT 
    pc.*,
    p.nome_parceiro,
    pf.nome as programa_nome,
    pr.nome as produto_nome
  INTO v_clube
  FROM programas_clubes pc
  INNER JOIN parceiros p ON p.id = pc.parceiro_id
  LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
  LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
  WHERE pc.id = p_clube_id
    AND pc.tem_clube = true
    AND pc.dia_cobranca IS NOT NULL
    AND pc.quantidade_pontos > 0;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 'Clube não encontrado ou não está configurado corretamente'::text;
    RETURN;
  END IF;
  
  -- Verificar se dia de cobrança já passou
  v_dia_atual := EXTRACT(DAY FROM CURRENT_DATE)::int;
  
  IF v_dia_atual < v_clube.dia_cobranca THEN
    RETURN QUERY SELECT 
      false, 
      0::numeric, 
      'O dia de cobrança (' || v_clube.dia_cobranca || ') ainda não chegou neste mês. Dia atual: ' || v_dia_atual::text;
    RETURN;
  END IF;
  
  -- Verificar se já foi processado neste mês
  v_data_referencia := DATE_TRUNC('month', CURRENT_DATE)::date;
  
  IF EXISTS (
    SELECT 1 
    FROM atividades 
    WHERE parceiro_id = v_clube.parceiro_id
      AND programa_id = v_clube.programa_id
      AND tipo_atividade = 'clube_credito_mensal'
      AND data_prevista >= v_data_referencia
      AND EXTRACT(MONTH FROM data_prevista) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM data_prevista) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND status = 'processado'
  ) THEN
    RETURN QUERY SELECT false, 0::numeric, 'Os pontos deste mês já foram processados'::text;
    RETURN;
  END IF;
  
  -- Creditar pontos regulares
  PERFORM atualizar_estoque_pontos(
    v_clube.parceiro_id,
    v_clube.programa_id,
    v_clube.quantidade_pontos,
    'Entrada',
    0,
    'clube_credito_manual',
    'Crédito manual do mês atual - clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.quantidade_pontos || ' pontos',
    v_clube.id,
    'programas_clubes'
  );
  
  -- Criar atividade
  INSERT INTO atividades (
    tipo_atividade,
    titulo,
    descricao,
    parceiro_id,
    parceiro_nome,
    programa_id,
    programa_nome,
    quantidade_pontos,
    data_prevista,
    referencia_id,
    referencia_tabela,
    prioridade,
    status
  ) VALUES (
    'clube_credito_mensal',
    'Crédito manual do mês atual',
    'Crédito processado manualmente para o mês atual - clube ' || COALESCE(v_clube.produto_nome, ''),
    v_clube.parceiro_id,
    v_clube.nome_parceiro,
    v_clube.programa_id,
    v_clube.programa_nome,
    v_clube.quantidade_pontos,
    CURRENT_DATE,
    v_clube.id,
    'programas_clubes',
    'alta',
    'processado'
  );
  
  v_pontos_total := v_clube.quantidade_pontos;
  
  -- Se tem bônus, creditar também
  IF v_clube.bonus_quantidade_pontos > 0 THEN
    PERFORM atualizar_estoque_pontos(
      v_clube.parceiro_id,
      v_clube.programa_id,
      v_clube.bonus_quantidade_pontos,
      'Entrada',
      0,
      'clube_credito_bonus_manual',
      'Bônus manual do mês atual - clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.bonus_quantidade_pontos || ' pontos',
      v_clube.id,
      'programas_clubes'
    );
    
    v_pontos_total := v_pontos_total + v_clube.bonus_quantidade_pontos;
  END IF;
  
  RETURN QUERY SELECT 
    true, 
    v_pontos_total, 
    'Pontos creditados com sucesso! Total: ' || v_pontos_total::text || ' pontos'::text;
END;
$$;

COMMENT ON FUNCTION processar_pontos_mes_atual(uuid) IS 
'Processa manualmente os pontos de clube do mês atual. Verifica se o dia de cobrança já passou e se já foi processado. Credita pontos regulares e bônus se aplicável.';

-- =====================================================
-- RLS Policies para funções
-- =====================================================

-- Permitir que usuários anônimos (autenticados via custom auth) executem as funções
GRANT EXECUTE ON FUNCTION processar_pontos_retroativos(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION processar_pontos_mes_atual(uuid) TO anon, authenticated;