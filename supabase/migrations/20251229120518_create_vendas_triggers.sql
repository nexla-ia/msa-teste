/*
  # Criar Triggers para Sistema de Vendas

  1. Funções e Triggers
    - Atualizar timestamps automaticamente
    - Baixar estoque automaticamente ao criar venda
    - Validar saldo suficiente antes da venda
    - Atualizar custo médio na venda

  2. Notas Importantes
    - A baixa de estoque é irreversível
    - Validação de saldo antes de permitir a venda
    - Registro do saldo anterior para auditoria
*/

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_vendas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at em vendas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_vendas_updated_at'
  ) THEN
    CREATE TRIGGER set_vendas_updated_at
      BEFORE UPDATE ON vendas
      FOR EACH ROW
      EXECUTE FUNCTION update_vendas_updated_at();
  END IF;
END $$;

-- Trigger para atualizar updated_at em localizadores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_localizadores_updated_at'
  ) THEN
    CREATE TRIGGER set_localizadores_updated_at
      BEFORE UPDATE ON localizadores
      FOR EACH ROW
      EXECUTE FUNCTION update_vendas_updated_at();
  END IF;
END $$;

-- Trigger para atualizar updated_at em contas_receber
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_contas_receber_updated_at'
  ) THEN
    CREATE TRIGGER set_contas_receber_updated_at
      BEFORE UPDATE ON contas_receber
      FOR EACH ROW
      EXECUTE FUNCTION update_vendas_updated_at();
  END IF;
END $$;

-- Função para processar venda e baixar estoque
CREATE OR REPLACE FUNCTION processar_venda()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo_atual numeric;
  v_custo_medio numeric;
BEGIN
  -- Buscar saldo atual e custo médio do estoque
  SELECT saldo_atual, custo_medio
  INTO v_saldo_atual, v_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.programa_id;

  -- Se não existir registro de estoque, criar com saldo 0
  IF NOT FOUND THEN
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
    VALUES (NEW.parceiro_id, NEW.programa_id, 0, 0);
    v_saldo_atual := 0;
    v_custo_medio := 0;
  END IF;

  -- Validar se há saldo suficiente
  IF v_saldo_atual < NEW.quantidade_milhas THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: %, Quantidade solicitada: %', 
      v_saldo_atual, NEW.quantidade_milhas;
  END IF;

  -- Registrar saldo anterior e custo médio na venda
  NEW.saldo_anterior := v_saldo_atual;
  NEW.custo_medio := v_custo_medio;

  -- Baixar do estoque
  UPDATE estoque_pontos
  SET saldo_atual = saldo_atual - NEW.quantidade_milhas,
      updated_at = now()
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.programa_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar venda antes de inserir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'processar_venda_trigger'
  ) THEN
    DROP TRIGGER processar_venda_trigger ON vendas;
  END IF;
  
  CREATE TRIGGER processar_venda_trigger
    BEFORE INSERT ON vendas
    FOR EACH ROW
    EXECUTE FUNCTION processar_venda();
END $$;

-- Função para reverter venda (caso seja cancelada)
CREATE OR REPLACE FUNCTION reverter_venda()
RETURNS TRIGGER AS $$
BEGIN
  -- Só reverter se o status mudou para 'cancelada'
  IF OLD.status != 'cancelada' AND NEW.status = 'cancelada' THEN
    -- Devolver as milhas ao estoque
    UPDATE estoque_pontos
    SET saldo_atual = saldo_atual + OLD.quantidade_milhas,
        updated_at = now()
    WHERE parceiro_id = OLD.parceiro_id
      AND programa_id = OLD.programa_id;

    -- Cancelar todas as contas a receber relacionadas
    UPDATE contas_receber
    SET status_pagamento = 'cancelado',
        updated_at = now()
    WHERE venda_id = OLD.id
      AND status_pagamento = 'pendente';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para reverter venda ao cancelar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'reverter_venda_trigger'
  ) THEN
    DROP TRIGGER reverter_venda_trigger ON vendas;
  END IF;
  
  CREATE TRIGGER reverter_venda_trigger
    AFTER UPDATE ON vendas
    FOR EACH ROW
    WHEN (NEW.status = 'cancelada' AND OLD.status != 'cancelada')
    EXECUTE FUNCTION reverter_venda();
END $$;