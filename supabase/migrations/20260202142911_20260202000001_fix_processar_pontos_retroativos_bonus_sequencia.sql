/*
  # Fix processar_pontos_clube_retroativos - Bônus seguindo sequência

  1. Changes
    - Atualiza função processar_pontos_clube_retroativos para processar bônus seguindo a sequência:
      - Mensal: bônus junto com os pontos normais a cada mês
      - Trimestral: bônus a cada 3 meses da data inicial
      - Anual: bônus a cada 12 meses da data inicial
    
  2. Logic
    - Para cada período (mês), verifica se deve aplicar bônus baseado na sequência
    - Mensal: aplica todo mês
    - Trimestral: aplica quando (meses_desde_inicio) % 3 = 0
    - Anual: aplica quando (meses_desde_inicio) % 12 = 0
*/

CREATE OR REPLACE FUNCTION processar_pontos_clube_retroativos(
  p_clube_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE(
  mes date,
  pontos_credito numeric,
  bonus_credito numeric,
  atividade_id uuid
) AS $$
DECLARE
  v_clube record;
  v_data_corrente date;
  v_pontos_mes numeric;
  v_bonus_mes numeric;
  v_atividade_id uuid;
  v_meses_desde_inicio integer;
  v_deve_aplicar_bonus boolean;
BEGIN
  -- Buscar informações do clube
  SELECT 
    pc.parceiro_id,
    pc.programa_id,
    pc.pontos_mensais,
    pc.bonus_pontos,
    pc.sequencia_bonus
  INTO v_clube
  FROM programas_clubes pc
  WHERE pc.id = p_clube_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clube não encontrado: %', p_clube_id;
  END IF;

  -- Processar mês a mês
  v_data_corrente := date_trunc('month', p_data_inicio)::date;
  
  WHILE v_data_corrente <= p_data_fim LOOP
    -- Calcular quantos meses se passaram desde o início
    v_meses_desde_inicio := EXTRACT(YEAR FROM age(v_data_corrente, p_data_inicio)) * 12 
                          + EXTRACT(MONTH FROM age(v_data_corrente, p_data_inicio));
    
    -- Determinar se deve aplicar bônus baseado na sequência
    v_deve_aplicar_bonus := false;
    
    IF v_clube.sequencia_bonus = 'mensal' THEN
      v_deve_aplicar_bonus := true;
    ELSIF v_clube.sequencia_bonus = 'trimestral' THEN
      v_deve_aplicar_bonus := (v_meses_desde_inicio > 0 AND v_meses_desde_inicio % 3 = 0);
    ELSIF v_clube.sequencia_bonus = 'anual' THEN
      v_deve_aplicar_bonus := (v_meses_desde_inicio > 0 AND v_meses_desde_inicio % 12 = 0);
    END IF;

    -- Pontos base do mês
    v_pontos_mes := COALESCE(v_clube.pontos_mensais, 0);
    
    -- Bônus do mês (se aplicável)
    IF v_deve_aplicar_bonus THEN
      v_bonus_mes := COALESCE(v_clube.bonus_pontos, 0);
    ELSE
      v_bonus_mes := 0;
    END IF;

    -- Criar atividade
    INSERT INTO atividades (
      parceiro_id,
      programa_id,
      tipo,
      quantidade,
      data_atividade,
      clube_id,
      origem,
      observacoes
    ) VALUES (
      v_clube.parceiro_id,
      v_clube.programa_id,
      'credito',
      v_pontos_mes + v_bonus_mes,
      v_data_corrente,
      p_clube_id,
      'clube',
      CASE 
        WHEN v_bonus_mes > 0 THEN 
          format('Crédito retroativo: %s pontos base + %s bônus (%s)', 
                 v_pontos_mes, v_bonus_mes, v_clube.sequencia_bonus)
        ELSE 
          format('Crédito retroativo: %s pontos', v_pontos_mes)
      END
    )
    RETURNING id INTO v_atividade_id;

    -- Registrar no estoque
    INSERT INTO estoque_pontos (
      parceiro_id,
      programa_id,
      quantidade,
      tipo_movimentacao,
      referencia_id,
      custo_unitario
    ) VALUES (
      v_clube.parceiro_id,
      v_clube.programa_id,
      v_pontos_mes + v_bonus_mes,
      'clube',
      v_atividade_id,
      0
    );

    -- Retornar linha
    RETURN QUERY SELECT 
      v_data_corrente,
      v_pontos_mes,
      v_bonus_mes,
      v_atividade_id;

    -- Próximo mês
    v_data_corrente := (v_data_corrente + interval '1 month')::date;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;