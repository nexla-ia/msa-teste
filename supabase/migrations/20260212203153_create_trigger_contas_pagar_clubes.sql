/*
  # Trigger para Contas a Pagar - Clubes

  ## Descrição
  Cria trigger para registrar automaticamente contas a pagar quando um crédito mensal de clube é processado.
  Como os clubes têm pagamentos recorrentes mensais, este trigger cria a conta a pagar toda vez que 
  os pontos são creditados automaticamente via função processar_creditos_clubes().

  ## Estratégia
  Como não há um evento específico para quando o clube faz a cobrança, vamos criar uma função
  que pode ser chamada manualmente ou integrada no fluxo de créditos automáticos para registrar
  a mensalidade do clube como conta a pagar.
*/

-- Função para registrar conta a pagar de clube (mensalidade)
CREATE OR REPLACE FUNCTION registrar_conta_pagar_clube(
  p_programa_clube_id uuid,
  p_data_cobranca date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
  v_clube RECORD;
  v_parceiro_nome text;
  v_programa_nome text;
  v_cartao_id uuid;
BEGIN
  -- Buscar dados do clube
  SELECT 
    pc.*,
    p.nome_parceiro,
    pf.nome as programa_nome,
    cc.id as cartao_id
  INTO v_clube
  FROM programas_clubes pc
  JOIN parceiros p ON p.id = pc.parceiro_id
  JOIN programas_fidelidade pf ON pf.id = pc.programa_id
  LEFT JOIN cartoes_credito cc ON cc.cartao = pc.cartao
  WHERE pc.id = p_programa_clube_id;
  
  -- Se não encontrou ou não tem valor, retorna
  IF NOT FOUND OR v_clube.valor IS NULL OR v_clube.valor <= 0 THEN
    RETURN;
  END IF;
  
  -- Verificar se já existe conta para este mês
  IF EXISTS (
    SELECT 1 FROM contas_a_pagar
    WHERE origem_tipo = 'clube'
      AND origem_id = p_programa_clube_id
      AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM p_data_cobranca)
      AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM p_data_cobranca)
  ) THEN
    -- Já existe, não criar duplicado
    RETURN;
  END IF;
  
  -- Criar conta a pagar para a mensalidade do clube
  INSERT INTO contas_a_pagar (
    origem_tipo,
    origem_id,
    parceiro_id,
    programa_id,
    descricao,
    data_vencimento,
    valor_parcela,
    numero_parcela,
    total_parcelas,
    forma_pagamento,
    cartao_id,
    status_pagamento,
    observacao
  ) VALUES (
    'clube',
    p_programa_clube_id,
    v_clube.parceiro_id,
    v_clube.programa_id,
    format('Mensalidade Clube - %s - %s (%s pontos)', v_clube.nome_parceiro, v_clube.programa_nome, v_clube.quantidade_pontos),
    p_data_cobranca,
    v_clube.valor,
    1,
    1,
    'Crédito', -- Clubes geralmente são cobrados no cartão
    v_clube.cartao_id,
    'pendente',
    format('Cobrança automática - %s pontos', v_clube.quantidade_pontos)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar função de processar créditos de clubes para também registrar conta a pagar
CREATE OR REPLACE FUNCTION processar_creditos_clubes_com_cobranca()
RETURNS TABLE (
  parceiro_id uuid,
  parceiro_nome text,
  programa_id uuid,
  programa_nome text,
  pontos_creditados integer,
  tipo_credito text,
  valor_cobrado numeric,
  processado_em timestamptz
) AS $$
DECLARE
  v_clube RECORD;
  v_hoje date := CURRENT_DATE;
  v_dia_atual integer := EXTRACT(DAY FROM v_hoje)::int;
BEGIN
  -- Loop por todos os clubes ativos
  FOR v_clube IN
    SELECT 
      pc.id as clube_id,
      pc.parceiro_id,
      p.nome_parceiro,
      pc.programa_id,
      pf.nome as programa_nome,
      pc.quantidade_pontos,
      pc.bonus_quantidade_pontos,
      pc.valor,
      pc.dia_cobranca,
      pc.data_ultima_assinatura,
      pc.sequencia
    FROM programas_clubes pc
    JOIN parceiros p ON p.id = pc.parceiro_id
    JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    WHERE pc.tem_clube = true
      AND pc.dia_cobranca = v_dia_atual
  LOOP
    -- Verificar se já foi creditado neste mês
    IF NOT EXISTS (
      SELECT 1 FROM estoque_movimentacoes
      WHERE parceiro_id = v_clube.parceiro_id
        AND programa_id = v_clube.programa_id
        AND tipo = 'clube_credito_mensal'
        AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM v_hoje)
        AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM v_hoje)
    ) THEN
      -- Creditar pontos mensais
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        0
      );
      
      -- Registrar movimentação
      INSERT INTO estoque_movimentacoes (
        parceiro_id,
        programa_id,
        tipo,
        quantidade,
        valor,
        origem,
        data,
        referencia_id
      ) VALUES (
        v_clube.parceiro_id,
        v_clube.programa_id,
        'clube_credito_mensal',
        v_clube.quantidade_pontos,
        v_clube.valor,
        format('Crédito mensal clube - %s', v_clube.programa_nome),
        v_hoje,
        v_clube.clube_id
      );
      
      -- Registrar conta a pagar para a mensalidade
      PERFORM registrar_conta_pagar_clube(v_clube.clube_id, v_hoje);
      
      -- Retornar registro do crédito
      parceiro_id := v_clube.parceiro_id;
      parceiro_nome := v_clube.nome_parceiro;
      programa_id := v_clube.programa_id;
      programa_nome := v_clube.programa_nome;
      pontos_creditados := v_clube.quantidade_pontos;
      tipo_credito := 'credito_mensal';
      valor_cobrado := v_clube.valor;
      processado_em := now();
      RETURN NEXT;
      
      -- Se tem bônus e é a primeira assinatura (data_ultima_assinatura = hoje)
      IF v_clube.bonus_quantidade_pontos > 0 
         AND v_clube.data_ultima_assinatura = v_hoje THEN
        
        PERFORM atualizar_estoque_pontos(
          v_clube.parceiro_id,
          v_clube.programa_id,
          v_clube.bonus_quantidade_pontos,
          'Entrada',
          0
        );
        
        INSERT INTO estoque_movimentacoes (
          parceiro_id,
          programa_id,
          tipo,
          quantidade,
          valor,
          origem,
          data,
          referencia_id
        ) VALUES (
          v_clube.parceiro_id,
          v_clube.programa_id,
          'clube_credito_bonus',
          v_clube.bonus_quantidade_pontos,
          0,
          format('Bônus inicial clube - %s', v_clube.programa_nome),
          v_hoje,
          v_clube.clube_id
        );
        
        parceiro_id := v_clube.parceiro_id;
        parceiro_nome := v_clube.nome_parceiro;
        programa_id := v_clube.programa_id;
        programa_nome := v_clube.programa_nome;
        pontos_creditados := v_clube.bonus_quantidade_pontos;
        tipo_credito := 'credito_bonus';
        valor_cobrado := 0;
        processado_em := now();
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;