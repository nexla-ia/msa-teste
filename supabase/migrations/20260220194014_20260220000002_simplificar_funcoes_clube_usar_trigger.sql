/*
  # Simplificar funções de clube para usar trigger automático

  1. Descrição
    Remove a lógica manual de transferência para titular das funções de clube,
    pois agora o trigger na tabela estoque_movimentacoes faz isso automaticamente.

  2. Mudanças
    - processar_pontos_retroativos: remove transferência manual
    - processar_pontos_mes_atual: remove transferência manual
    - processar_creditos_clubes: remove transferência manual

  3. Vantagens
    - Código mais simples e limpo
    - Lógica centralizada no trigger
    - Mais fácil de manter
*/

-- ==================================================================
-- Atualizar: processar_pontos_retroativos
-- ==================================================================
DROP FUNCTION IF EXISTS processar_pontos_retroativos(uuid);

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

  -- Obter informações de conta família para mensagens
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
      -- Creditar pontos no parceiro (o trigger fará a transferência se for convidado)
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        0,
        'clube_credito_retroativo',
        'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') || 
        ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY'),
        v_clube.id,
        'programas_clubes'
      );

      -- Criar atividade no nome do parceiro original
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
            '. Pontos transferidos automaticamente para titular ' || v_titular.titular_nome
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

-- ==================================================================
-- Atualizar: processar_pontos_mes_atual
-- ==================================================================
DROP FUNCTION IF EXISTS processar_pontos_mes_atual(uuid);

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

  -- Obter informações de conta família
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

  -- Creditar no parceiro (trigger fará transferência se for convidado)
  PERFORM atualizar_estoque_pontos(
    v_clube.parceiro_id,
    v_clube.programa_id,
    v_clube.quantidade_pontos,
    'Entrada',
    0,
    'clube_credito_manual',
    'Crédito manual do mês atual - clube ' || COALESCE(v_clube.produto_nome, ''),
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
        '. Pontos transferidos automaticamente para titular ' || v_titular.titular_nome
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
        ' (transferidos automaticamente para titular ' || v_titular.titular_nome || ')'
      ELSE ''
    END;
END;
$$;

-- ==================================================================
-- Atualizar: processar_creditos_clubes
-- ==================================================================
DROP FUNCTION IF EXISTS processar_creditos_clubes();

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
  v_titular RECORD;
  v_ja_creditado boolean;
  v_data_referencia date;
  v_pontos_total numeric;
  v_tem_bonus boolean;
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
      AND pc.dia_cobranca IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = pc.dia_cobranca
  LOOP
    SELECT EXISTS(
      SELECT 1
      FROM atividades a
      WHERE a.parceiro_id = v_clube.parceiro_id
        AND a.programa_id = v_clube.programa_id
        AND a.tipo_atividade = 'clube_credito_mensal'
        AND a.data_prevista >= v_data_referencia
        AND EXTRACT(MONTH FROM a.data_prevista) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM a.data_prevista) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND a.status = 'processado'
    ) INTO v_ja_creditado;

    IF NOT v_ja_creditado THEN
      SELECT * INTO v_titular
      FROM obter_titular_conta_familia(v_clube.parceiro_id, v_clube.programa_id);

      v_pontos_total := v_clube.quantidade_pontos;
      v_tem_bonus := false;

      -- Creditar no parceiro (trigger fará transferência se for convidado)
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        0,
        'clube_credito_mensal',
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, ''),
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
        'Crédito mensal de clube',
        CASE
          WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
            'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '') ||
            '. Pontos transferidos automaticamente para titular ' || v_titular.titular_nome
          ELSE
            'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '')
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

      IF v_clube.bonus_quantidade_pontos > 0 THEN
        -- Creditar bônus no parceiro (trigger fará transferência se for convidado)
        PERFORM atualizar_estoque_pontos(
          v_clube.parceiro_id,
          v_clube.programa_id,
          v_clube.bonus_quantidade_pontos,
          'Entrada',
          0,
          'clube_credito_bonus',
          'Bônus mensal do clube ' || COALESCE(v_clube.produto_nome, ''),
          v_clube.id,
          'programas_clubes'
        );

        v_pontos_total := v_pontos_total + v_clube.bonus_quantidade_pontos;
        v_tem_bonus := true;
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
