/*
  # Fix Transferência com Compra no Carrinho — Custo Médio

  ## Problema
  Na transferência com "Compra no Carrinho":
  - A origem (ex: Livelo) estava sendo debitada, alterando seu saldo e valor_total
  - O destino (ex: Smiles) recebia os pontos valorados ao custo médio da ORIGEM
    em vez do custo real da compra no carrinho (compra_valor_total)

  ## Lógica Correta
  - Os pontos entram e saem da origem ao mesmo tempo (efeito de passagem/controle)
  - A origem NÃO deve ser debitada — saldo, valor_total e custo_medio ficam intocados
  - O destino recebe os pontos com o valor real da compra (compra_valor_total)

  ## Alterações
  1. processar_transferencia_origem() — pula o débito quando realizar_compra_carrinho = true
  2. processar_transferencia_destino() — usa compra_valor_total quando realizar_compra_carrinho = true
*/

-- ==========================================
-- 1. ORIGEM: não debita quando for carrinho
-- ==========================================
CREATE OR REPLACE FUNCTION processar_transferencia_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Compra no carrinho: pontos entram e saem da origem ao mesmo tempo
  -- Não impacta saldo nem custo médio da origem
  IF NEW.realizar_compra_carrinho = true THEN
    RETURN NEW;
  END IF;

  -- Transferência normal: debita da origem
  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.origem_programa_id,
    -NEW.origem_quantidade,
    'Saída',
    0
  );

  RETURN NEW;
END;
$$;

-- ==========================================
-- 2. DESTINO: usa compra_valor_total quando for carrinho
-- ==========================================
CREATE OR REPLACE FUNCTION processar_transferencia_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_custo_medio decimal;
  v_valor_destino      decimal;
BEGIN
  -- Buscar custo médio da origem (usado apenas em transferência normal)
  SELECT custo_medio INTO v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.origem_programa_id;

  -- Definir valor que entra no destino
  IF NEW.realizar_compra_carrinho = true THEN
    -- Usa o custo real da compra no carrinho
    v_valor_destino := COALESCE(NEW.compra_valor_total, 0);
  ELSE
    -- Usa o custo médio da origem proporcionalmente
    v_valor_destino := (NEW.destino_quantidade / 1000.0) * COALESCE(v_origem_custo_medio, 0);
  END IF;

  -- INSERT com status Concluído: creditar pontos principais
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      v_valor_destino
    );
  END IF;

  -- INSERT com bônus destino Concluído
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0
    );
  END IF;

  -- INSERT com bônus bumerangue Concluído
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0
    );
  END IF;

  -- UPDATE de Pendente para Concluído: creditar pontos principais
  IF (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      v_valor_destino
    );
  END IF;

  -- UPDATE de status_bonus_destino de Pendente para Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_destino = 'Pendente' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0
    );
  END IF;

  RETURN NEW;
END;
$$;
