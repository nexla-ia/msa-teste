/*
  # Fix trigger compra_bonificada to use parceiro_id

  1. Changes
    - Update registrar_conta_pagar_compra_bonificada function to use parceiro_id instead of cliente_id
    - Update query to fetch from parceiros table instead of clientes table

  2. Notes
    - The column was renamed from cliente_id to parceiro_id in an earlier migration
    - The trigger function was not updated accordingly
*/

CREATE OR REPLACE FUNCTION registrar_conta_pagar_compra_bonificada()
RETURNS TRIGGER AS $$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_parceiro_nome text;
  v_programa_nome text;
BEGIN
  -- Só registra se houver forma de pagamento e valor_produto (que representa o custo)
  IF NEW.forma_pagamento IS NOT NULL
     AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa'
     AND NEW.valor_produto IS NOT NULL
     AND NEW.valor_produto != 0 THEN

    -- Buscar nomes para descrição (agora usa parceiros ao invés de clientes)
    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;

    -- Calcular valor por parcela (valor_produto é negativo, então usamos ABS)
    v_valor_parcela := ABS(NEW.valor_produto) / COALESCE(NEW.parcelas, 1);

    -- Criar registro para cada parcela
    FOR v_parcela IN 1..COALESCE(NEW.parcelas, 1) LOOP
      -- Calcular data de vencimento
      v_data_vencimento := NEW.data_compra + ((v_parcela - 1) * INTERVAL '1 month');

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
        conta_bancaria_id,
        status_pagamento
      ) VALUES (
        'compra_bonificada',
        NEW.id,
        NEW.parceiro_id,
        NEW.programa_id,
        format('Compra bonificada - %s - %s - Loja: %s', v_parceiro_nome, v_programa_nome, NEW.loja),
        v_data_vencimento,
        v_valor_parcela,
        v_parcela,
        COALESCE(NEW.parcelas, 1),
        NEW.forma_pagamento,
        NEW.cartao_id,
        NEW.conta_bancaria_id,
        'pendente'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;