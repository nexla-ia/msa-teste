/*
  # Corrigir valor do clube no cálculo do custo médio

  ## Problema
  A função processar_creditos_clubes está passando valor 0 para atualizar_estoque_pontos,
  mas deveria passar o valor da mensalidade do clube para que entre no cálculo do custo médio.

  ## Solução
  Modificar a função para passar pc.valor quando disponível.

  ## Impacto
  - O valor da mensalidade do clube passa a ser considerado no custo médio
  - O histórico de movimentações passa a exibir o valor correto
  - Melhora a precisão do custo médio dos pontos
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
  v_valor_clube numeric;
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
      AND pc.dia_cobranca IS NOT NULL
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = pc.dia_cobranca
  LOOP
    -- Verifica se já foi creditado neste mês verificando nas atividades
    SELECT EXISTS(
      SELECT 1 
      FROM atividades 
      WHERE atividades.parceiro_id = v_clube.parceiro_id
        AND atividades.programa_id = v_clube.programa_id
        AND tipo_atividade = 'clube_credito_mensal'
        AND data_prevista >= v_data_referencia
        AND EXTRACT(MONTH FROM data_prevista) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data_prevista) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND status = 'concluido'
    ) INTO v_ja_creditado;
    
    IF NOT v_ja_creditado THEN
      v_pontos_total := v_clube.quantidade_pontos;
      v_tem_bonus := false;
      
      -- Usa o valor do clube se disponível, senão usa 0
      v_valor_clube := COALESCE(v_clube.valor, 0);
      
      -- Creditar pontos regulares usando a função correta COM origem, observação E VALOR
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        v_valor_clube,  -- VALOR DO CLUBE (mensalidade)
        'clube_credito_mensal',  -- origem
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.quantidade_pontos || ' pontos' || 
        CASE WHEN v_valor_clube > 0 THEN ' - ' || TO_CHAR(v_valor_clube, 'FM999G999G990D00') ELSE '' END,  -- observação com valor
        v_clube.id,  -- referencia_id
        'programas_clubes'  -- referencia_tabela
      );
      
      -- Buscar parceiro titular da conta família (se existir)
      DECLARE
        v_titular_id uuid;
      BEGIN
        IF v_clube.conta_familia_id IS NOT NULL THEN
          SELECT cf.parceiro_principal_id INTO v_titular_id
          FROM conta_familia cf
          WHERE cf.id = v_clube.conta_familia_id;
          
          -- Se for convidado, transfere automaticamente para titular
          IF v_titular_id IS NOT NULL AND v_titular_id != v_clube.parceiro_id THEN
            PERFORM transferir_pontos_automatico(
              v_clube.parceiro_id,
              v_titular_id,
              v_clube.programa_id,
              v_clube.quantidade_pontos,
              'Transferência automática de convidado para titular - Crédito de clube'
            );
          END IF;
        END IF;
      END;
      
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
        valor,
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
        v_valor_clube,  -- REGISTRAR VALOR NA ATIVIDADE TAMBÉM
        CURRENT_DATE,
        v_clube.id,
        'programas_clubes',
        'alta',
        'concluido'
      );
      
      -- Se tem bônus, creditar também (bônus não tem valor/custo)
      IF v_clube.bonus_quantidade_pontos > 0 THEN
        PERFORM atualizar_estoque_pontos(
          v_clube.parceiro_id,
          v_clube.programa_id,
          v_clube.bonus_quantidade_pontos,
          'Entrada',
          0,  -- Bônus não tem custo
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
'Processa créditos mensais de pontos para parceiros com clubes ativos. Os pontos são creditados no dia correspondente à data de cobrança (dia_cobranca). O VALOR DA MENSALIDADE DO CLUBE é incluído no cálculo do custo médio. Registra TODAS as movimentações no histórico com origem, observação, valor e detalhes completos. Usa atualizar_estoque_pontos() para manter consistência. Retorna uma linha por parceiro com o total de pontos (regulares + bônus quando aplicável).';