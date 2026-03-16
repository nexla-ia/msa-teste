/*
  # Redirecionar pontos de clube para titular da conta família

  1. Descrição
    Quando um parceiro é cadastrado em um programa/clube e está em uma conta família:
    - Se for convidado: pontos vão para o titular da conta família
    - Se for titular: recebe os pontos normalmente
    - Se não está em conta família: recebe os pontos normalmente

  2. Mudanças
    - Cria função auxiliar para buscar titular da conta família
    - Modifica função de processar créditos automáticos
    - Modifica funções de processamento manual (retroativo e mês atual)

  3. Segurança
    - Mantém RLS policies
    - Registra histórico completo
*/

-- =====================================================
-- Função auxiliar: obter_titular_conta_familia
-- =====================================================
CREATE OR REPLACE FUNCTION obter_titular_conta_familia(
  p_parceiro_id uuid,
  p_programa_id uuid
)
RETURNS TABLE (
  titular_id uuid,
  titular_nome text,
  conta_familia_id uuid,
  conta_familia_nome text,
  eh_titular boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_conta_titular RECORD;
  v_conta_membro RECORD;
BEGIN
  -- Verificar se é titular de conta família ativa no programa
  SELECT 
    cf.id as conta_id,
    cf.nome_conta,
    cf.parceiro_principal_id,
    p.nome_parceiro as titular_nome
  INTO v_conta_titular
  FROM conta_familia cf
  INNER JOIN parceiros p ON p.id = cf.parceiro_principal_id
  WHERE cf.parceiro_principal_id = p_parceiro_id
    AND cf.programa_id = p_programa_id
    AND cf.status = 'Ativa'
  LIMIT 1;

  -- Se é titular, retorna ele mesmo
  IF FOUND THEN
    RETURN QUERY SELECT
      p_parceiro_id,
      v_conta_titular.titular_nome,
      v_conta_titular.conta_id,
      v_conta_titular.nome_conta,
      true;
    RETURN;
  END IF;

  -- Verificar se é membro (convidado) de conta família ativa
  SELECT
    cfm.conta_familia_id,
    cf.nome_conta,
    cf.parceiro_principal_id,
    p.nome_parceiro as titular_nome
  INTO v_conta_membro
  FROM conta_familia_membros cfm
  INNER JOIN conta_familia cf ON cf.id = cfm.conta_familia_id
  INNER JOIN parceiros p ON p.id = cf.parceiro_principal_id
  WHERE cfm.parceiro_id = p_parceiro_id
    AND cf.programa_id = p_programa_id
    AND cfm.status = 'Ativo'
    AND cf.status = 'Ativa'
  LIMIT 1;

  -- Se é convidado, retorna o titular
  IF FOUND THEN
    RETURN QUERY SELECT
      v_conta_membro.parceiro_principal_id,
      v_conta_membro.titular_nome,
      v_conta_membro.conta_familia_id,
      v_conta_membro.nome_conta,
      false;
    RETURN;
  END IF;

  -- Se não está em conta família, retorna o próprio parceiro
  SELECT nome_parceiro INTO v_conta_titular.titular_nome
  FROM parceiros
  WHERE id = p_parceiro_id;

  RETURN QUERY SELECT
    p_parceiro_id,
    v_conta_titular.titular_nome,
    NULL::uuid,
    NULL::text,
    false;
END;
$$;

COMMENT ON FUNCTION obter_titular_conta_familia(uuid, uuid) IS
'Retorna o titular da conta família para crédito de pontos. Se o parceiro for convidado, retorna o titular. Se for titular ou não tiver conta, retorna ele mesmo.';

-- =====================================================
-- Atualizar função: processar_pontos_retroativos
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
  v_titular RECORD;
  v_mes_inicio date;
  v_mes_atual date;
  v_data_credito date;
  v_meses_count int := 0;
  v_pontos_reg_total numeric := 0;
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

  -- Obter titular para crédito (se estiver em conta família)
  SELECT * INTO v_titular
  FROM obter_titular_conta_familia(v_clube.parceiro_id, v_clube.programa_id);

  -- Data de início: primeiro dia do mês da assinatura
  v_mes_inicio := DATE_TRUNC('month', v_clube.data_ultima_assinatura::date)::date;

  -- Data atual: primeiro dia do mês passado
  v_mes_atual := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date;

  IF v_mes_inicio > v_mes_atual THEN
    RETURN QUERY SELECT 0, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Loop pelos meses
  WHILE v_mes_inicio <= v_mes_atual LOOP
    v_data_credito := MAKE_DATE(
      EXTRACT(YEAR FROM v_mes_inicio)::int,
      EXTRACT(MONTH FROM v_mes_inicio)::int,
      LEAST(v_clube.dia_cobranca, EXTRACT(DAY FROM (v_mes_inicio + INTERVAL '1 month - 1 day'))::int)
    );

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
      -- Creditar pontos para o titular (ou próprio parceiro se não tiver conta família)
      PERFORM atualizar_estoque_pontos(
        v_titular.titular_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        0,
        'clube_credito_retroativo',
        CASE 
          WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
            'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') || 
            ' de ' || v_clube.nome_parceiro || ' (convidado) para titular ' || v_titular.titular_nome ||
            ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY')
          ELSE
            'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') || 
            ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY')
        END,
        v_clube.id,
        'programas_clubes'
      );

      -- Criar atividade no nome do parceiro original (não do titular)
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
        CASE 
          WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
            'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') || 
            ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY') || 
            '. Pontos creditados para titular ' || v_titular.titular_nome
          ELSE
            'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') || 
            ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY')
        END,
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
      v_meses_count := v_meses_count + 1;
    END IF;

    v_mes_inicio := (v_mes_inicio + INTERVAL '1 month')::date;
  END LOOP;

  RETURN QUERY SELECT
    v_meses_count,
    v_pontos_reg_total,
    0::numeric,
    v_pontos_reg_total;
END;
$$;

-- =====================================================
-- Atualizar função: processar_pontos_mes_atual
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
  v_titular RECORD;
  v_dia_atual int;
  v_pontos_total numeric := 0;
  v_data_referencia date;
BEGIN
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

  -- Obter titular para crédito
  SELECT * INTO v_titular
  FROM obter_titular_conta_familia(v_clube.parceiro_id, v_clube.programa_id);

  v_dia_atual := EXTRACT(DAY FROM CURRENT_DATE)::int;

  IF v_dia_atual < v_clube.dia_cobranca THEN
    RETURN QUERY SELECT
      false,
      0::numeric,
      'O dia de cobrança (' || v_clube.dia_cobranca || ') ainda não chegou neste mês. Dia atual: ' || v_dia_atual::text;
    RETURN;
  END IF;

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

  -- Creditar para titular
  PERFORM atualizar_estoque_pontos(
    v_titular.titular_id,
    v_clube.programa_id,
    v_clube.quantidade_pontos,
    'Entrada',
    0,
    'clube_credito_manual',
    CASE 
      WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
        'Crédito manual do mês atual - clube ' || COALESCE(v_clube.produto_nome, '') || 
        ' de ' || v_clube.nome_parceiro || ' para titular ' || v_titular.titular_nome
      ELSE
        'Crédito manual do mês atual - clube ' || COALESCE(v_clube.produto_nome, '')
    END,
    v_clube.id,
    'programas_clubes'
  );

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
    CASE 
      WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
        'Crédito processado manualmente para o mês atual - clube ' || COALESCE(v_clube.produto_nome, '') ||
        '. Pontos creditados para titular ' || v_titular.titular_nome
      ELSE
        'Crédito processado manualmente para o mês atual - clube ' || COALESCE(v_clube.produto_nome, '')
    END,
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

  RETURN QUERY SELECT
    true,
    v_pontos_total,
    'Pontos creditados com sucesso! Total: ' || v_pontos_total::text || ' pontos' ||
    CASE 
      WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
        ' (creditados para titular ' || v_titular.titular_nome || ')'
      ELSE ''
    END;
END;
$$;

-- =====================================================
-- RLS Policies
-- =====================================================
GRANT EXECUTE ON FUNCTION obter_titular_conta_familia(uuid, uuid) TO anon, authenticated;
