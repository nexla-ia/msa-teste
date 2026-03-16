/*
  # Corrigir lógica de bônus trimestral e anual

  ## Problema
  1. Bônus trimestral/anual está sendo creditado mesmo sem ter passado o período necessário
  2. A lógica deve verificar se passaram 3 meses (trimestral) ou 12 meses (anual) desde a data de assinatura

  ## Solução
  - Mensal: sempre credita bônus
  - Trimestral: só credita se passaram pelo menos 3 meses desde a data de assinatura
  - Anual: só credita se passou pelo menos 1 ano desde a data de assinatura

  ## Impacto
  - processar_pontos_mes_atual: adiciona verificação de período
  - processar_creditos_clubes: adiciona verificação de período
*/

-- =====================================================
-- Função: processar_pontos_mes_atual com verificação de período para bônus
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
  v_valor_clube numeric;
  v_meses_desde_assinatura int;
  v_deve_creditar_bonus boolean := false;
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
  
  -- Usa o valor do clube se disponível, senão usa 0
  v_valor_clube := COALESCE(v_clube.valor, 0);
  
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
      AND status = 'concluido'
  ) THEN
    RETURN QUERY SELECT false, 0::numeric, 'Os pontos deste mês já foram processados'::text;
    RETURN;
  END IF;
  
  -- Creditar pontos regulares COM VALOR
  PERFORM atualizar_estoque_pontos(
    v_clube.parceiro_id,
    v_clube.programa_id,
    v_clube.quantidade_pontos,
    'Entrada',
    v_valor_clube,
    'clube_credito_manual',
    'Crédito manual do mês atual - clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.quantidade_pontos || ' pontos' ||
    CASE WHEN v_valor_clube > 0 THEN ' - ' || TO_CHAR(v_valor_clube, 'FM999G999G990D00') ELSE '' END,
    v_clube.id,
    'programas_clubes'
  );
  
  -- Criar atividade COM VALOR
  INSERT INTO atividades (
    tipo_atividade,
    titulo,
    descricao,
    parceiro_id,
    parceiro_nome,
    programa_id,
    programa_nome,
    quantidade_pontos,
    valor,
    data_prevista,
    referencia_id,
    referencia_tabela,
    prioridade,
    status,
    data_conclusao
  ) VALUES (
    'clube_credito_mensal',
    'Crédito manual do mês atual',
    'Crédito processado manualmente para o mês atual - clube ' || COALESCE(v_clube.produto_nome, ''),
    v_clube.parceiro_id,
    v_clube.nome_parceiro,
    v_clube.programa_id,
    v_clube.programa_nome,
    v_clube.quantidade_pontos,
    v_valor_clube,
    CURRENT_DATE,
    v_clube.id,
    'programas_clubes',
    'alta',
    'concluido',
    NOW()
  );
  
  v_pontos_total := v_clube.quantidade_pontos;
  
  -- Verificar se deve creditar bônus baseado na sequência e tempo desde assinatura
  IF v_clube.bonus_quantidade_pontos > 0 AND v_clube.data_ultima_assinatura IS NOT NULL THEN
    -- Calcular quantos meses se passaram desde a assinatura
    v_meses_desde_assinatura := EXTRACT(YEAR FROM age(CURRENT_DATE, v_clube.data_ultima_assinatura::date)) * 12 
                              + EXTRACT(MONTH FROM age(CURRENT_DATE, v_clube.data_ultima_assinatura::date));
    
    -- Determinar se deve creditar bônus
    IF v_clube.sequencia = 'mensal' THEN
      v_deve_creditar_bonus := true;
    ELSIF v_clube.sequencia = 'trimestral' THEN
      -- Só credita se passaram pelo menos 3 meses
      v_deve_creditar_bonus := (v_meses_desde_assinatura >= 3);
    ELSIF v_clube.sequencia = 'anual' THEN
      -- Só credita se passou pelo menos 1 ano (12 meses)
      v_deve_creditar_bonus := (v_meses_desde_assinatura >= 12);
    END IF;
    
    -- Creditar bônus se aplicável (bônus não tem custo)
    IF v_deve_creditar_bonus THEN
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.bonus_quantidade_pontos,
        'Entrada',
        0,
        'clube_credito_bonus_manual',
        'Bônus manual do mês atual - clube ' || COALESCE(v_clube.produto_nome, '') || ' (' || v_clube.sequencia || ') - ' || v_clube.bonus_quantidade_pontos || ' pontos',
        v_clube.id,
        'programas_clubes'
      );
      
      v_pontos_total := v_pontos_total + v_clube.bonus_quantidade_pontos;
    END IF;
  END IF;
  
  RETURN QUERY SELECT 
    true, 
    v_pontos_total, 
    'Pontos creditados com sucesso! Total: ' || v_pontos_total::text || ' pontos'::text;
END;
$$;

COMMENT ON FUNCTION processar_pontos_mes_atual(uuid) IS 
'Processa manualmente os pontos de clube do mês atual. O VALOR DA MENSALIDADE DO CLUBE é incluído no cálculo do custo médio. Bônus só é creditado se o período necessário (trimestral=3 meses, anual=12 meses) já passou desde a data de assinatura. Usa status concluido.';

-- =====================================================
-- Função: processar_creditos_clubes com verificação de período para bônus
-- =====================================================
CREATE OR REPLACE FUNCTION processar_creditos_clubes()
RETURNS TABLE (
  parceiro_id uuid,
  parceiro_nome text,
  programa_id uuid,
  programa_nome text,
  pontos_creditados numeric,
  tipo_credito text,
  processado_em timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clube RECORD;
  v_ja_creditado boolean;
  v_data_referencia date;
  v_pontos_total numeric;
  v_tem_bonus boolean;
  v_valor_clube numeric;
  v_meses_desde_assinatura int;
  v_deve_creditar_bonus boolean;
BEGIN
  v_data_referencia := DATE_TRUNC('month', CURRENT_DATE)::date;
  
  FOR v_clube IN
    SELECT 
      pc.*,
      p.nome_parceiro,
      pf.nome as programa_nome,
      pr.nome as produto_nome
    FROM programas_clubes pc
    INNER JOIN parceiros p ON p.id = pc.parceiro_id
    LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
    WHERE pc.tem_clube = true
      AND pc.data_ultima_assinatura IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND pc.dia_cobranca IS NOT NULL
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = pc.dia_cobranca
  LOOP
    -- Verifica se já foi creditado neste mês
    SELECT EXISTS(
      SELECT 1 
      FROM atividades 
      WHERE atividades.parceiro_id = v_clube.parceiro_id
        AND atividades.programa_id = v_clube.programa_id
        AND tipo_atividade = 'clube_credito_mensal'
        AND data_prevista >= v_data_referencia
        AND EXTRACT(MONTH FROM data_prevista) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data_prevista) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND status = 'concluido'
    ) INTO v_ja_creditado;
    
    IF NOT v_ja_creditado THEN
      v_pontos_total := v_clube.quantidade_pontos;
      v_tem_bonus := false;
      v_deve_creditar_bonus := false;
      
      -- Usa o valor do clube se disponível, senão usa 0
      v_valor_clube := COALESCE(v_clube.valor, 0);
      
      -- Creditar pontos regulares COM origem, observação E VALOR
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        v_valor_clube,
        'clube_credito_mensal',
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.quantidade_pontos || ' pontos' || 
        CASE WHEN v_valor_clube > 0 THEN ' - ' || TO_CHAR(v_valor_clube, 'FM999G999G990D00') ELSE '' END,
        v_clube.id,
        'programas_clubes'
      );
      
      -- Buscar parceiro titular da conta família (se existir)
      DECLARE
        v_titular_id uuid;
      BEGIN
        IF v_clube.conta_familia_id IS NOT NULL THEN
          SELECT cf.parceiro_principal_id INTO v_titular_id
          FROM conta_familia cf
          WHERE cf.id = v_clube.conta_familia_id;
          
          -- Se for convidado, transfere automaticamente para titular
          IF v_titular_id IS NOT NULL AND v_titular_id != v_clube.parceiro_id THEN
            PERFORM transferir_pontos_automatico(
              v_clube.parceiro_id,
              v_titular_id,
              v_clube.programa_id,
              v_clube.quantidade_pontos,
              'Transferência automática de convidado para titular - Crédito de clube'
            );
          END IF;
        END IF;
      END;
      
      -- Criar atividade COM VALOR
      INSERT INTO atividades (
        tipo_atividade,
        titulo,
        descricao,
        parceiro_id,
        parceiro_nome,
        programa_id,
        programa_nome,
        quantidade_pontos,
        valor,
        data_prevista,
        referencia_id,
        referencia_tabela,
        prioridade,
        status
      ) VALUES (
        'clube_credito_mensal',
        'Crédito mensal de clube',
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, ''),
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_clube.quantidade_pontos,
        v_valor_clube,
        CURRENT_DATE,
        v_clube.id,
        'programas_clubes',
        'alta',
        'concluido'
      );
      
      -- Verificar se deve creditar bônus
      IF v_clube.bonus_quantidade_pontos > 0 AND v_clube.data_ultima_assinatura IS NOT NULL THEN
        -- Calcular quantos meses se passaram desde a assinatura
        v_meses_desde_assinatura := EXTRACT(YEAR FROM age(CURRENT_DATE, v_clube.data_ultima_assinatura::date)) * 12 
                                  + EXTRACT(MONTH FROM age(CURRENT_DATE, v_clube.data_ultima_assinatura::date));
        
        -- Determinar se deve creditar bônus
        IF v_clube.sequencia = 'mensal' THEN
          v_deve_creditar_bonus := true;
        ELSIF v_clube.sequencia = 'trimestral' THEN
          -- Só credita se passaram pelo menos 3 meses E é múltiplo de 3
          v_deve_creditar_bonus := (v_meses_desde_assinatura >= 3 AND v_meses_desde_assinatura % 3 = 0);
        ELSIF v_clube.sequencia = 'anual' THEN
          -- Só credita se passou pelo menos 1 ano E é múltiplo de 12
          v_deve_creditar_bonus := (v_meses_desde_assinatura >= 12 AND v_meses_desde_assinatura % 12 = 0);
        END IF;
        
        -- Creditar bônus se aplicável
        IF v_deve_creditar_bonus THEN
          PERFORM atualizar_estoque_pontos(
            v_clube.parceiro_id,
            v_clube.programa_id,
            v_clube.bonus_quantidade_pontos,
            'Entrada',
            0,
            'clube_credito_bonus',
            'Bônus mensal do clube ' || COALESCE(v_clube.produto_nome, '') || ' (' || v_clube.sequencia || ') - ' || v_clube.bonus_quantidade_pontos || ' pontos',
            v_clube.id,
            'programas_clubes'
          );

          v_pontos_total := v_pontos_total + v_clube.bonus_quantidade_pontos;
          v_tem_bonus := true;
        END IF;
      END IF;
      
      RETURN QUERY SELECT 
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_pontos_total,
        CASE WHEN v_tem_bonus THEN 'credito_com_bonus' ELSE 'credito_mensal' END::text,
        CURRENT_TIMESTAMP;
      
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION processar_creditos_clubes() IS 
'Processa créditos mensais de pontos para parceiros com clubes ativos. Os pontos são creditados no dia correspondente à data de cobrança (dia_cobranca). O VALOR DA MENSALIDADE DO CLUBE é incluído no cálculo do custo médio. Bônus só é creditado se o período necessário já passou (trimestral=3 meses e múltiplo de 3, anual=12 meses e múltiplo de 12). Registra TODAS as movimentações no histórico com origem, observação, valor e detalhes completos.';