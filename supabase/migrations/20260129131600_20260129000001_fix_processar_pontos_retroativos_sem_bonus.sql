/*
  # Corrigir processamento de pontos retroativos

  1. Descrição
    - Remove o crédito de bônus do processamento retroativo
    - Corrige data de início para começar no mês da assinatura (não no mês seguinte)

  2. Mudanças
    - Pontos retroativos devem trazer APENAS pontos regulares (sem bônus)
    - Pontos retroativos devem começar no mês da assinatura (mês 1)

  3. Função Modificada
    - processar_pontos_retroativos: Remove código que credita bônus
*/

-- =====================================================
-- Função: processar_pontos_retroativos (SEM BÔNUS)
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

  -- Data de início: primeiro dia do mês da assinatura (MÊS 1, não mês seguinte)
  v_mes_inicio := DATE_TRUNC('month', v_clube.data_ultima_assinatura::date)::date;

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
      -- Creditar APENAS pontos regulares (SEM BÔNUS)
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
      v_meses_count := v_meses_count + 1;
    END IF;

    -- Avançar para o próximo mês
    v_mes_inicio := (v_mes_inicio + INTERVAL '1 month')::date;
  END LOOP;

  RETURN QUERY SELECT
    v_meses_count,
    v_pontos_reg_total,
    0::numeric as pontos_bonus,
    v_pontos_reg_total as pontos_total;
END;
$$;

COMMENT ON FUNCTION processar_pontos_retroativos(uuid) IS
'Processa pontos retroativos de clube desde o mês da assinatura até o mês passado (não processa o mês atual). Credita APENAS pontos regulares, SEM bônus. Evita duplicação verificando atividades existentes. Retorna quantidade de meses processados e total de pontos creditados.';
