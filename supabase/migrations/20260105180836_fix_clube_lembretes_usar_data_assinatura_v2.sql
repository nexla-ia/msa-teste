/*
  # Corrigir lembretes de clubes para usar data de assinatura

  ## Descrição
  Modifica a função gerar_lembretes_clubes para criar lembretes baseados
  no dia da data de assinatura, não no dia de cobrança.

  ## Mudanças
  - Remove função antiga
  - Recria função usando EXTRACT(DAY FROM data_ultima_assinatura) para determinar o dia do lembrete
*/

DROP FUNCTION IF EXISTS gerar_lembretes_clubes();

CREATE OR REPLACE FUNCTION gerar_lembretes_clubes()
RETURNS TABLE (
  atividade_id uuid,
  parceiro_nome text,
  programa_nome text,
  data_prevista date
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clube RECORD;
  v_dia_credito int;
  v_data_prevista date;
  v_atividade_id uuid;
  v_ja_existe boolean;
  v_mes_atual int;
  v_ano_atual int;
  v_dias_no_mes int;
BEGIN
  v_mes_atual := EXTRACT(MONTH FROM CURRENT_DATE)::int;
  v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  
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
  LOOP
    v_dia_credito := EXTRACT(DAY FROM v_clube.data_ultima_assinatura)::int;
    
    v_data_prevista := MAKE_DATE(v_ano_atual, v_mes_atual, v_dia_credito);
    
    IF v_data_prevista < CURRENT_DATE THEN
      IF v_mes_atual = 12 THEN
        v_mes_atual := 1;
        v_ano_atual := v_ano_atual + 1;
      ELSE
        v_mes_atual := v_mes_atual + 1;
      END IF;
      
      v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_ano_atual, v_mes_atual, 1)) + INTERVAL '1 month - 1 day'))::int;
      
      IF v_dia_credito > v_dias_no_mes THEN
        v_data_prevista := MAKE_DATE(v_ano_atual, v_mes_atual, v_dias_no_mes);
      ELSE
        v_data_prevista := MAKE_DATE(v_ano_atual, v_mes_atual, v_dia_credito);
      END IF;
    END IF;
    
    IF v_data_prevista <= (CURRENT_DATE + INTERVAL '7 days')::date THEN
      SELECT EXISTS(
        SELECT 1 
        FROM atividades 
        WHERE parceiro_id = v_clube.parceiro_id
          AND programa_id = v_clube.programa_id
          AND tipo_atividade = 'clube_credito_mensal'
          AND data_prevista = v_data_prevista
      ) INTO v_ja_existe;
      
      IF NOT v_ja_existe THEN
        INSERT INTO atividades (
          tipo_atividade,
          descricao,
          parceiro_id,
          programa_id,
          data_prevista,
          status,
          prioridade
        ) VALUES (
          'clube_credito_mensal',
          'Crédito mensal de ' || v_clube.quantidade_pontos || ' pontos do clube ' || COALESCE(v_clube.produto_nome, ''),
          v_clube.parceiro_id,
          v_clube.programa_id,
          v_data_prevista,
          'pendente',
          'alta'
        )
        RETURNING id INTO v_atividade_id;
        
        RETURN QUERY SELECT 
          v_atividade_id,
          v_clube.nome_parceiro,
          v_clube.programa_nome,
          v_data_prevista;
      END IF;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION gerar_lembretes_clubes() IS 
'Gera lembretes para créditos mensais de clubes nos próximos 7 dias. Os lembretes são baseados no dia da data de assinatura.';
