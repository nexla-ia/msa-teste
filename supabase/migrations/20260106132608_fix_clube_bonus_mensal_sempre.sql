/*
  # Corrigir bônus de clube para creditar mensalmente

  ## Descrição
  Modifica a função processar_creditos_clubes para que o bônus seja creditado
  SEMPRE junto com os pontos regulares, não apenas no primeiro mês.
  
  ## Mudanças
  - Remove condição que verificava se era o dia da primeira assinatura
  - Agora se bonus_quantidade_pontos > 0, o bônus é creditado todo mês
  - Altera descrição de "Bônus de boas-vindas" para "Bônus mensal"
  
  ## Exemplo
  Se um parceiro tem 20.000 pontos regulares e 8.000 de bônus configurados:
  - Todo dia da assinatura recebe: 20.000 + 8.000 = 28.000 pontos
*/

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
      AND pc.data_ultima_assinatura IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = EXTRACT(DAY FROM pc.data_ultima_assinatura)::int
  LOOP
    SELECT EXISTS(
      SELECT 1 
      FROM estoque_pontos 
      WHERE parceiro_id = v_clube.parceiro_id
        AND programa_id = v_clube.programa_id
        AND origem = 'clube_credito_mensal'
        AND data >= v_data_referencia
        AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
    ) INTO v_ja_creditado;
    
    IF NOT v_ja_creditado THEN
      v_pontos_total := v_clube.quantidade_pontos;
      v_tem_bonus := false;
      
      INSERT INTO estoque_pontos (
        parceiro_id,
        programa_id,
        tipo,
        quantidade,
        origem,
        observacao,
        data
      ) VALUES (
        v_clube.parceiro_id,
        v_clube.programa_id,
        'entrada',
        v_clube.quantidade_pontos,
        'clube_credito_mensal',
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, ''),
        CURRENT_DATE
      );
      
      IF v_clube.bonus_quantidade_pontos > 0 THEN

        INSERT INTO estoque_pontos (
          parceiro_id,
          programa_id,
          tipo,
          quantidade,
          origem,
          observacao,
          data
        ) VALUES (
          v_clube.parceiro_id,
          v_clube.programa_id,
          'entrada',
          v_clube.bonus_quantidade_pontos,
          'clube_credito_bonus',
          'Bônus mensal do clube ' || COALESCE(v_clube.produto_nome, ''),
          CURRENT_DATE
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
'Processa créditos mensais de pontos para parceiros com clubes ativos. Os pontos são creditados no dia correspondente à data de assinatura (ex: se assinou dia 5, créditos caem todo dia 5). Se houver bônus configurado, ele é creditado mensalmente junto com os pontos regulares.';