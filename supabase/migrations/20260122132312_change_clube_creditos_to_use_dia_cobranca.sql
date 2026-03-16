/*
  # Mudar créditos de clube para usar dia de cobrança
  
  1. Problema
    - Atualmente os créditos de clube entram no dia da data_ultima_assinatura
    - Ex: se assinou dia 5, os pontos caem todo dia 5
    - Isso não é flexível
  
  2. Nova Regra
    - Os créditos devem entrar no DIA DA COBRANÇA (campo dia_cobranca)
    - Mais flexível - pode definir qualquer dia independente da assinatura
    - Ex: assinou dia 3, mas configurou cobrança dia 10, então pontos caem dia 10
  
  3. Mudanças
    - Modificar função processar_creditos_clubes() para usar dia_cobranca
    - Modificar função criar_atividades_clube() para usar dia_cobranca
    - Atualizar comentários e documentação
  
  4. Compatibilidade
    - Mantém data_ultima_assinatura para controle histórico
    - dia_cobranca passa a ser obrigatório quando tem_clube = true
*/

-- =====================================================
-- Função: processar_creditos_clubes
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
    -- Verifica se já foi creditado neste mês verificando nas atividades
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
      v_pontos_total := v_clube.quantidade_pontos;
      v_tem_bonus := false;
      
      -- Creditar pontos regulares usando a função correta COM origem e observação
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        0,  -- custo zero porque é crédito de clube
        'clube_credito_mensal',  -- origem
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.quantidade_pontos || ' pontos',  -- observação
        v_clube.id,  -- referencia_id
        'programas_clubes'  -- referencia_tabela
      );
      
      -- Criar atividade para registrar o crédito
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
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, ''),
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
      
      -- Se tem bônus, creditar também
      IF v_clube.bonus_quantidade_pontos > 0 THEN
        PERFORM atualizar_estoque_pontos(
          v_clube.parceiro_id,
          v_clube.programa_id,
          v_clube.bonus_quantidade_pontos,
          'Entrada',
          0,
          'clube_credito_bonus',  -- origem
          'Bônus mensal do clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.bonus_quantidade_pontos || ' pontos',  -- observação
          v_clube.id,  -- referencia_id
          'programas_clubes'  -- referencia_tabela
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

COMMENT ON FUNCTION processar_creditos_clubes() IS 
'Processa créditos mensais de pontos para parceiros com clubes ativos. Os pontos são creditados no DIA DE COBRANÇA configurado (ex: se dia_cobranca = 10, créditos caem todo dia 10). Registra TODAS as movimentações no histórico com origem e observação detalhadas. Usa atualizar_estoque_pontos() para manter consistência. Retorna uma linha por parceiro com o total de pontos (regulares + bônus quando aplicável).';

-- =====================================================
-- Função: criar_atividades_clube
-- =====================================================
CREATE OR REPLACE FUNCTION criar_atividades_clube()
RETURNS TRIGGER AS $$
DECLARE
  v_proximo_credito date;
  v_mes int;
  v_ano int;
  v_dias_no_mes int;
BEGIN
  IF NEW.tem_clube = true 
    AND NEW.dia_cobranca IS NOT NULL 
    AND NEW.quantidade_pontos > 0 THEN
    
    v_mes := EXTRACT(MONTH FROM CURRENT_DATE)::int;
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::int;
    
    -- Tenta criar a data no mês atual
    v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::int;
    
    IF NEW.dia_cobranca > v_dias_no_mes THEN
      v_proximo_credito := MAKE_DATE(v_ano, v_mes, v_dias_no_mes);
    ELSE
      v_proximo_credito := MAKE_DATE(v_ano, v_mes, NEW.dia_cobranca);
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
      
      IF NEW.dia_cobranca > v_dias_no_mes THEN
        v_proximo_credito := MAKE_DATE(v_ano, v_mes, v_dias_no_mes);
      ELSE
        v_proximo_credito := MAKE_DATE(v_ano, v_mes, NEW.dia_cobranca);
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
'Cria atividades de crédito mensal e bônus baseadas no DIA DE COBRANÇA configurado. Ex: se dia_cobranca = 10, cria atividades para todo dia 10 de cada mês.';