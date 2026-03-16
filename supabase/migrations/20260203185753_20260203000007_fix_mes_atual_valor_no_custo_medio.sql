/*
  # Corrigir valor do clube no processamento manual do mês atual

  ## Problema
  A função processar_pontos_mes_atual também está passando valor 0 para 
  atualizar_estoque_pontos, mas deveria passar o valor da mensalidade.

  ## Solução
  Modificar a função para passar pc.valor quando disponível.

  ## Impacto
  - Pontos processados manualmente passam a considerar o valor do clube no custo médio
  - Mantém consistência com as outras funções de clube
*/

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
    v_valor_clube,  -- VALOR DO CLUBE (mensalidade)
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
    valor,  -- ADICIONAR VALOR
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
    v_valor_clube,  -- VALOR DO CLUBE
    CURRENT_DATE,
    v_clube.id,
    'programas_clubes',
    'alta',
    'concluido',
    NOW()
  );
  
  v_pontos_total := v_clube.quantidade_pontos;
  
  -- Se tem bônus, creditar também (bônus não tem custo)
  IF v_clube.bonus_quantidade_pontos > 0 THEN
    PERFORM atualizar_estoque_pontos(
      v_clube.parceiro_id,
      v_clube.programa_id,
      v_clube.bonus_quantidade_pontos,
      'Entrada',
      0,  -- Bônus não tem custo
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
'Processa manualmente os pontos de clube do mês atual. O VALOR DA MENSALIDADE DO CLUBE é incluído no cálculo do custo médio. Usa status concluido.';