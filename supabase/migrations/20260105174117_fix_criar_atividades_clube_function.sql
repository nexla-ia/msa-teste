/*
  # Corrigir função criar_atividades_clube

  ## Descrição
  Corrige a referência incorreta à coluna nome da tabela parceiros.
  A coluna correta é nome_parceiro, não nome.

  ## Mudanças
  - Altera p.nome para p.nome_parceiro em ambas as queries da função
*/

CREATE OR REPLACE FUNCTION criar_atividades_clube()
RETURNS TRIGGER AS $$
DECLARE
  v_proximo_credito date;
BEGIN
  IF NEW.tem_clube = true 
    AND NEW.data_ultima_assinatura IS NOT NULL 
    AND NEW.dia_cobranca IS NOT NULL 
    AND NEW.quantidade_pontos > 0 THEN
    
    v_proximo_credito := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    v_proximo_credito := MAKE_DATE(
      EXTRACT(YEAR FROM v_proximo_credito)::int,
      EXTRACT(MONTH FROM v_proximo_credito)::int,
      LEAST(NEW.dia_cobranca, EXTRACT(DAY FROM v_proximo_credito)::int)
    );
    
    IF v_proximo_credito < CURRENT_DATE THEN
      v_proximo_credito := MAKE_DATE(
        EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        LEAST(NEW.dia_cobranca, EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 month') - INTERVAL '1 day'))::int)
      );
    END IF;
    
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
    
    -- Se tem bônus e é primeira assinatura, criar atividade de bônus
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
        v_proximo_credito,
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
