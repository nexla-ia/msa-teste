/*
  # Corrigir Triggers de Transferências

  ## Descrição
  Remove os triggers que estavam criando contas a PAGAR para transferências.
  As taxas de transferência são contas a RECEBER (empresa cobra do cliente),
  não contas a pagar.

  ## Correções
  1. Remove trigger de transferencia_pontos que cria conta a pagar para custo_transferencia
  2. Remove trigger de transferencia_pessoas que cria conta a pagar para valor_custo
  3. Mantém apenas o trigger de compra no carrinho (esse sim é conta a pagar)
*/

-- Recriar trigger de transferencia_pontos APENAS para compra no carrinho
CREATE OR REPLACE FUNCTION registrar_conta_pagar_transferencia_pontos()
RETURNS TRIGGER AS $$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_parceiro_nome text;
  v_origem_programa text;
  v_destino_programa text;
  v_cartao_id uuid;
  v_conta_id uuid;
BEGIN
  -- Só registra CONTA A PAGAR se houver compra no carrinho com pagamento
  -- (A empresa está COMPRANDO pontos, então é uma despesa)
  IF NEW.realizar_compra_carrinho = true
     AND NEW.compra_forma_pagamento IS NOT NULL 
     AND NEW.compra_forma_pagamento != 'Não registrar no fluxo de caixa'
     AND NEW.compra_valor_total IS NOT NULL
     AND NEW.compra_valor_total > 0 THEN
    
    -- Buscar nomes
    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_origem_programa FROM programas_fidelidade WHERE id = NEW.origem_programa_id;
    SELECT nome INTO v_destino_programa FROM programas_fidelidade WHERE id = NEW.destino_programa_id;
    
    -- Identificar cartão ou conta
    v_cartao_id := NEW.compra_cartao_id;
    v_conta_id := NEW.compra_conta_bancaria_id;
    
    -- Calcular valor por parcela
    v_valor_parcela := NEW.compra_valor_total / COALESCE(NEW.compra_parcelas, 1);
    
    -- Criar registro para cada parcela
    FOR v_parcela IN 1..COALESCE(NEW.compra_parcelas, 1) LOOP
      v_data_vencimento := NEW.data_transferencia + ((v_parcela - 1) * INTERVAL '1 month');
      
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
        status_pagamento,
        created_by
      ) VALUES (
        'transferencia_pontos',
        NEW.id,
        NEW.parceiro_id,
        NEW.origem_programa_id,
        format('Compra no Carrinho - Transferência %s → %s - %s', v_origem_programa, v_destino_programa, v_parceiro_nome),
        v_data_vencimento,
        v_valor_parcela,
        v_parcela,
        COALESCE(NEW.compra_parcelas, 1),
        NEW.compra_forma_pagamento,
        v_cartao_id,
        v_conta_id,
        'pendente',
        NEW.created_by
      );
    END LOOP;
  END IF;

  -- NOTA: O custo_transferencia agora vai para CONTAS A RECEBER
  -- via trigger separado, pois é uma taxa que a empresa COBRA do cliente
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo de transferencia_pessoas das contas a pagar
DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_transferencia_pessoas ON transferencia_pessoas;
DROP FUNCTION IF EXISTS registrar_conta_pagar_transferencia_pessoas();

-- NOTA: Agora transferencia_pessoas com custo vai para CONTAS A RECEBER
-- via o trigger criado anteriormente