/*
  # Atualizar função processar_creditos_clubes para somar pontos e bônus

  ## Descrição
  Modifica a função para retornar apenas uma linha por parceiro/programa,
  somando os pontos regulares com o bônus (quando aplicável) em uma única entrada.

  ## Mudanças
  - Credita pontos regulares e bônus em entradas separadas no estoque
  - Retorna apenas uma linha por parceiro com o total somado
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
      AND pc.dia_cobranca IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = pc.dia_cobranca
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
      
      IF v_clube.bonus_quantidade_pontos > 0 
         AND v_clube.data_ultima_assinatura = CURRENT_DATE THEN
        
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
          'Bônus de boas-vindas do clube ' || COALESCE(v_clube.produto_nome, ''),
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
'Processa créditos mensais de pontos para parceiros com clubes ativos. Retorna uma linha por parceiro com o total de pontos (regulares + bônus quando aplicável).';
