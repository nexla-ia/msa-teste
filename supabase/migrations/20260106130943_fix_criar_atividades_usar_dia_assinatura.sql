/*
  # Corrigir função criar_atividades_clube para usar dia da assinatura

  ## Descrição
  Modifica a função que cria atividades automaticamente quando um clube
  é cadastrado/atualizado para usar o dia da data de assinatura ao invés
  do dia de cobrança.

  ## Mudanças
  - Remove verificação de dia_cobranca
  - Usa EXTRACT(DAY FROM data_ultima_assinatura) para calcular a data prevista
  - Mantém a lógica de criar atividades de crédito mensal e bônus
*/

CREATE OR REPLACE FUNCTION criar_atividades_clube()
RETURNS TRIGGER AS $$
DECLARE
  v_proximo_credito date;
  v_dia_assinatura int;
  v_mes int;
  v_ano int;
  v_dias_no_mes int;
BEGIN
  IF NEW.tem_clube = true 
    AND NEW.data_ultima_assinatura IS NOT NULL 
    AND NEW.quantidade_pontos > 0 THEN
    
    v_dia_assinatura := EXTRACT(DAY FROM NEW.data_ultima_assinatura)::int;
    v_mes := EXTRACT(MONTH FROM CURRENT_DATE)::int;
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::int;
    
    -- Tenta criar a data no mês atual
    v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::int;
    
    IF v_dia_assinatura > v_dias_no_mes THEN
      v_proximo_credito := MAKE_DATE(v_ano, v_mes, v_dias_no_mes);
    ELSE
      v_proximo_credito := MAKE_DATE(v_ano, v_mes, v_dia_assinatura);
    END IF;
    
    -- Se a data já passou, avança para o próximo mês
    IF v_proximo_credito < CURRENT_DATE THEN
      IF v_mes = 12 THEN
        v_mes := 1;
        v_ano := v_ano + 1;
      ELSE
        v_mes := v_mes + 1;
      END IF;
      
      v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::int;
      
      IF v_dia_assinatura > v_dias_no_mes THEN
        v_proximo_credito := MAKE_DATE(v_ano, v_mes, v_dias_no_mes);
      ELSE
        v_proximo_credito := MAKE_DATE(v_ano, v_mes, v_dia_assinatura);
      END IF;
    END IF;
    
    -- Criar atividade de crédito mensal
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
      prioridade
    )
    SELECT
      'clube_credito_mensal',
      'Crédito mensal de clube',
      'Crédito mensal de ' || NEW.quantidade_pontos || ' pontos do clube ' || pr.nome,
      NEW.parceiro_id,
      p.nome_parceiro,
      NEW.programa_id,
      pf.nome,
      NEW.quantidade_pontos,
      v_proximo_credito,
      NEW.id,
      'programas_clubes',
      'alta'
    FROM parceiros p
    LEFT JOIN programas_fidelidade pf ON pf.id = NEW.programa_id
    LEFT JOIN produtos pr ON pr.id = NEW.clube_produto_id
    WHERE p.id = NEW.parceiro_id;
    
    -- Se tem bônus e é primeira assinatura (hoje), criar atividade de bônus
    IF NEW.bonus_quantidade_pontos > 0 AND NEW.data_ultima_assinatura = CURRENT_DATE THEN
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
        prioridade
      )
      SELECT
        'clube_credito_bonus',
        'Bônus de boas-vindas do clube',
        'Bônus de ' || NEW.bonus_quantidade_pontos || ' pontos do clube ' || pr.nome,
        NEW.parceiro_id,
        p.nome_parceiro,
        NEW.programa_id,
        pf.nome,
        NEW.bonus_quantidade_pontos,
        CURRENT_DATE,
        NEW.id,
        'programas_clubes',
        'alta'
      FROM parceiros p
      LEFT JOIN programas_fidelidade pf ON pf.id = NEW.programa_id
      LEFT JOIN produtos pr ON pr.id = NEW.clube_produto_id
      WHERE p.id = NEW.parceiro_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION criar_atividades_clube() IS 
'Cria atividades de crédito mensal e bônus baseadas no dia da data de assinatura. Ex: se assinou dia 5, cria atividades para todo dia 5.';
