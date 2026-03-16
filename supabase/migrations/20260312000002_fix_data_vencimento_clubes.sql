/*
  # Fix data_vencimento para Clubes

  ## Descrição
  Atualiza a função registrar_conta_pagar_clube para usar calcular_data_vencimento()
  assim como os outros triggers, calculando a data correta baseada no dia_vencimento
  do cartão associado ao clube.
*/

CREATE OR REPLACE FUNCTION registrar_conta_pagar_clube(
  p_programa_clube_id uuid,
  p_data_cobranca date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
  v_clube RECORD;
  v_cartao_id uuid;
  v_data_vencimento date;
BEGIN
  -- Buscar dados do clube e o cartao_id via JOIN pelo nome do cartão
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
    RETURN;
  END IF;

  -- Calcular data de vencimento usando o cartão do clube (sempre Crédito, 1 parcela)
  v_data_vencimento := calcular_data_vencimento('Crédito', v_clube.cartao_id, NULL, p_data_cobranca, 1);

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
    v_data_vencimento,
    v_clube.valor,
    1,
    1,
    'Crédito',
    v_clube.cartao_id,
    'pendente',
    format('Cobrança automática - %s pontos', v_clube.quantidade_pontos)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
