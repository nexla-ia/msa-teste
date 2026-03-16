/*
  # Triggers para Contas a Pagar

  ## Descrição
  Cria triggers para registrar automaticamente contas a pagar quando houver:
  - Compras de pontos/milhas
  - Compras bonificadas
  - Créditos mensais de clubes
  - Transferências de pontos com pagamento
  - Transferências entre pessoas com custo

  ## Funções Criadas
  1. `registrar_conta_pagar_compra()` - Trigger para tabela compras
  2. `registrar_conta_pagar_compra_bonificada()` - Trigger para compra_bonificada
  3. `registrar_conta_pagar_clube()` - Trigger para programas_clubes (créditos automáticos)
  4. `registrar_conta_pagar_transferencia_pontos()` - Trigger para transferencia_pontos
  5. `registrar_conta_pagar_transferencia_pessoas()` - Trigger para transferencia_pessoas
*/

-- ==========================================
-- 1. TRIGGER PARA COMPRAS
-- ==========================================
CREATE OR REPLACE FUNCTION registrar_conta_pagar_compra()
RETURNS TRIGGER AS $$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_parceiro_nome text;
  v_programa_nome text;
BEGIN
  -- Só registra se houver forma de pagamento e não for "Não registrar no fluxo de caixa"
  IF NEW.forma_pagamento IS NOT NULL 
     AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa'
     AND NEW.valor_total IS NOT NULL
     AND NEW.valor_total > 0 THEN
    
    -- Buscar nomes para descrição
    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;
    
    -- Calcular valor por parcela
    v_valor_parcela := NEW.valor_total / COALESCE(NEW.quantidade_parcelas, 1);
    
    -- Criar registro para cada parcela
    FOR v_parcela IN 1..COALESCE(NEW.quantidade_parcelas, 1) LOOP
      -- Calcular data de vencimento (mês atual + parcela)
      v_data_vencimento := NEW.data_entrada + ((v_parcela - 1) * INTERVAL '1 month');
      
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
        'compra',
        NEW.id,
        NEW.parceiro_id,
        NEW.programa_id,
        format('Compra de %s pontos/milhas - %s - %s', NEW.pontos_milhas, v_parceiro_nome, v_programa_nome),
        v_data_vencimento,
        v_valor_parcela,
        v_parcela,
        COALESCE(NEW.quantidade_parcelas, 1),
        NEW.forma_pagamento,
        NEW.cartao_id,
        NEW.conta_bancaria_id,
        'pendente',
        NEW.created_by
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_compra ON compras;
CREATE TRIGGER trigger_registrar_conta_pagar_compra
  AFTER INSERT ON compras
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_compra();

-- ==========================================
-- 2. TRIGGER PARA COMPRA BONIFICADA
-- ==========================================
CREATE OR REPLACE FUNCTION registrar_conta_pagar_compra_bonificada()
RETURNS TRIGGER AS $$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_cliente_nome text;
  v_programa_nome text;
BEGIN
  -- Só registra se houver forma de pagamento e valor_produto (que representa o custo)
  IF NEW.forma_pagamento IS NOT NULL 
     AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa'
     AND NEW.valor_produto IS NOT NULL
     AND NEW.valor_produto != 0 THEN
    
    -- Buscar nomes para descrição
    SELECT nome_cliente INTO v_cliente_nome FROM clientes WHERE id = NEW.cliente_id;
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
        status_pagamento,
        created_by
      ) VALUES (
        'compra_bonificada',
        NEW.id,
        NULL, -- Compra bonificada não tem parceiro, tem cliente
        NEW.programa_id,
        format('Compra bonificada - %s - %s - Loja: %s', v_cliente_nome, v_programa_nome, NEW.loja),
        v_data_vencimento,
        v_valor_parcela,
        v_parcela,
        COALESCE(NEW.parcelas, 1),
        NEW.forma_pagamento,
        NEW.cartao_id,
        NEW.conta_bancaria_id,
        'pendente',
        NEW.created_by
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_compra_bonificada ON compra_bonificada;
CREATE TRIGGER trigger_registrar_conta_pagar_compra_bonificada
  AFTER INSERT ON compra_bonificada
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_compra_bonificada();

-- ==========================================
-- 3. TRIGGER PARA TRANSFERÊNCIA DE PONTOS (Compra no Carrinho)
-- ==========================================
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
  -- Só registra se houver compra no carrinho com pagamento
  IF NEW.realizar_compra_carrinho = true
     AND NEW.compra_forma_pagamento IS NOT NULL 
     AND NEW.compra_forma_pagamento != 'Não registrar no fluxo de caixa'
     AND NEW.compra_valor_total IS NOT NULL
     AND NEW.compra_valor_total > 0 THEN
    
    -- Buscar nomes
    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_origem_programa FROM programas_fidelidade WHERE id = NEW.origem_programa_id;
    SELECT nome INTO v_destino_programa FROM programas_fidelidade WHERE id = NEW.destino_programa_id;
    
    -- Identificar cartão ou conta (transferencia_pontos tem campos específicos)
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

  -- Também registra o custo da transferência (se houver)
  IF NEW.custo_transferencia IS NOT NULL 
     AND NEW.custo_transferencia > 0
     AND NEW.forma_pagamento_transferencia IS NOT NULL
     AND NEW.forma_pagamento_transferencia != 'Não registrar no fluxo de caixa' THEN
    
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
      format('Taxa de Transferência - %s → %s - %s', v_origem_programa, v_destino_programa, v_parceiro_nome),
      NEW.data_transferencia,
      NEW.custo_transferencia,
      1,
      1,
      NEW.forma_pagamento_transferencia,
      NEW.cartao_id,
      NEW.conta_bancaria_id,
      'pendente',
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_transferencia_pontos ON transferencia_pontos;
CREATE TRIGGER trigger_registrar_conta_pagar_transferencia_pontos
  AFTER INSERT ON transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_transferencia_pontos();

-- ==========================================
-- 4. TRIGGER PARA TRANSFERÊNCIA ENTRE PESSOAS
-- ==========================================
CREATE OR REPLACE FUNCTION registrar_conta_pagar_transferencia_pessoas()
RETURNS TRIGGER AS $$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_origem_nome text;
  v_destino_nome text;
  v_programa_nome text;
BEGIN
  -- Só registra se houver custo com pagamento
  IF NEW.tem_custo = true
     AND NEW.valor_custo IS NOT NULL 
     AND NEW.valor_custo > 0
     AND NEW.forma_pagamento IS NOT NULL
     AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa' THEN
    
    -- Buscar nomes
    SELECT nome_parceiro INTO v_origem_nome FROM parceiros WHERE id = NEW.origem_parceiro_id;
    SELECT nome_parceiro INTO v_destino_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
    SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;
    
    -- Calcular valor por parcela
    v_valor_parcela := NEW.valor_custo / COALESCE(NEW.parcelas, 1);
    
    -- Criar registro para cada parcela
    FOR v_parcela IN 1..COALESCE(NEW.parcelas, 1) LOOP
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
        observacao,
        created_by
      ) VALUES (
        'transferencia_pontos',
        NEW.id,
        NEW.origem_parceiro_id,
        NEW.programa_id,
        format('Transferência entre Pessoas - %s → %s - %s', v_origem_nome, v_destino_nome, v_programa_nome),
        v_data_vencimento,
        v_valor_parcela,
        v_parcela,
        COALESCE(NEW.parcelas, 1),
        NEW.forma_pagamento,
        NEW.cartao_id,
        NEW.conta_bancaria_id,
        'pendente',
        NEW.observacao,
        NEW.created_by
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_transferencia_pessoas ON transferencia_pessoas;
CREATE TRIGGER trigger_registrar_conta_pagar_transferencia_pessoas
  AFTER INSERT ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_transferencia_pessoas();