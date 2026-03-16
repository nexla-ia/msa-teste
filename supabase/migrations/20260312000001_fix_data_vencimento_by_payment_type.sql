/*
  # Fix data_vencimento by payment type

  ## Description
  Adds manual due date support and a smart due date calculation function that
  considers the payment method (Dinheiro, Crédito, Débito) and card closing/due dates.

  ## Changes
  1. Add `data_vencimento_manual` column to compras, compra_bonificada, transferencia_pessoas
  2. Add `compra_data_vencimento_manual` and `taxa_data_vencimento_manual` to transferencia_pontos
  3. Create helper function `calcular_data_vencimento`
  4. Update all 4 trigger functions to use the new helper
*/

-- ==========================================
-- 1. ADD COLUMNS
-- ==========================================
ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS data_vencimento_manual date;

ALTER TABLE compra_bonificada
  ADD COLUMN IF NOT EXISTS data_vencimento_manual date;

ALTER TABLE transferencia_pessoas
  ADD COLUMN IF NOT EXISTS data_vencimento_manual date;

ALTER TABLE transferencia_pontos
  ADD COLUMN IF NOT EXISTS compra_data_vencimento_manual date,
  ADD COLUMN IF NOT EXISTS taxa_data_vencimento_manual date;

-- ==========================================
-- 2. HELPER FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION calcular_data_vencimento(
  p_forma_pagamento text,
  p_cartao_id uuid,
  p_data_vencimento_manual date,
  p_data_base date,
  p_parcela integer
) RETURNS date AS $$
DECLARE
  v_dia_fechamento integer;
  v_dia_vencimento integer;
  v_mes integer;
  v_ano integer;
BEGIN
  -- Dinheiro: usa data_vencimento_manual + offset de parcelas
  IF p_forma_pagamento = 'Dinheiro' THEN
    IF p_data_vencimento_manual IS NOT NULL THEN
      RETURN p_data_vencimento_manual + ((p_parcela - 1) * INTERVAL '1 month');
    ELSE
      RETURN p_data_base + ((p_parcela - 1) * INTERVAL '1 month');
    END IF;
  END IF;

  -- Crédito ou Débito com cartão: usa dia_fechamento e dia_vencimento do cartão
  IF (p_forma_pagamento = 'Crédito' OR p_forma_pagamento = 'Débito') AND p_cartao_id IS NOT NULL THEN
    SELECT dia_fechamento, dia_vencimento
    INTO v_dia_fechamento, v_dia_vencimento
    FROM cartoes_credito
    WHERE id = p_cartao_id;

    IF v_dia_vencimento IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM p_data_base)::integer;
      v_ano := EXTRACT(YEAR FROM p_data_base)::integer;

      -- Se passou do fechamento, avança para o próximo mês
      IF v_dia_fechamento IS NOT NULL AND EXTRACT(DAY FROM p_data_base)::integer >= v_dia_fechamento THEN
        v_mes := v_mes + 1;
        IF v_mes > 12 THEN
          v_mes := 1;
          v_ano := v_ano + 1;
        END IF;
      END IF;

      -- Avança pelos meses das parcelas
      v_mes := v_mes + (p_parcela - 1);
      WHILE v_mes > 12 LOOP
        v_mes := v_mes - 12;
        v_ano := v_ano + 1;
      END LOOP;

      RETURN make_date(
        v_ano,
        v_mes,
        LEAST(
          v_dia_vencimento,
          EXTRACT(DAY FROM (make_date(v_ano, v_mes, 1) + INTERVAL '1 month - 1 day'))::integer
        )
      );
    END IF;
  END IF;

  -- Fallback: data_base + offset de parcelas
  RETURN p_data_base + ((p_parcela - 1) * INTERVAL '1 month');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. TRIGGER: COMPRAS
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
      -- Calcular data de vencimento usando helper
      v_data_vencimento := calcular_data_vencimento(NEW.forma_pagamento, NEW.cartao_id, NEW.data_vencimento_manual, NEW.data_entrada::date, v_parcela);

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

-- ==========================================
-- 4. TRIGGER: COMPRA BONIFICADA
-- ==========================================
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

    -- Buscar nomes para descrição (usa parceiros)
    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;

    -- Calcular valor por parcela (valor_produto pode ser negativo, então usamos ABS)
    v_valor_parcela := ABS(NEW.valor_produto) / COALESCE(NEW.parcelas, 1);

    -- Criar registro para cada parcela
    FOR v_parcela IN 1..COALESCE(NEW.parcelas, 1) LOOP
      -- Calcular data de vencimento usando helper
      v_data_vencimento := calcular_data_vencimento(NEW.forma_pagamento, NEW.cartao_id, NEW.data_vencimento_manual, NEW.data_compra::date, v_parcela);

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

-- ==========================================
-- 5. TRIGGER: TRANSFERÊNCIA DE PONTOS (Compra no Carrinho)
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
  -- Só registra CONTA A PAGAR se houver compra no carrinho com pagamento
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
      v_data_vencimento := calcular_data_vencimento(NEW.compra_forma_pagamento, NEW.compra_cartao_id, NEW.compra_data_vencimento_manual, NEW.data_transferencia::date, v_parcela);

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

  -- Também registra o custo da transferência (taxa) se houver
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
      calcular_data_vencimento(NEW.forma_pagamento_transferencia, NEW.cartao_id, NEW.taxa_data_vencimento_manual, NEW.data_transferencia::date, 1),
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

-- ==========================================
-- 6. TRIGGER: TRANSFERÊNCIA ENTRE PESSOAS
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
      v_data_vencimento := calcular_data_vencimento(NEW.forma_pagamento, NEW.cartao_id, NEW.data_vencimento_manual, NEW.data_transferencia::date, v_parcela);

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

-- Re-create trigger for transferencia_pessoas (was dropped in a previous migration)
DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_transferencia_pessoas ON transferencia_pessoas;
CREATE TRIGGER trigger_registrar_conta_pagar_transferencia_pessoas
  AFTER INSERT ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_transferencia_pessoas();
