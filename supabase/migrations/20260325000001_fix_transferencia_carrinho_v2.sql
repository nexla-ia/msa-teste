/*
  # Fix Transferência Carrinho v2

  ## Problemas encontrados na migration anterior (20260321000001):
  1. processar_transferencia_origem() usava -NEW.origem_quantidade (negativo)
     para Saída, o que fazia o saldo da origem AUMENTAR em vez de diminuir
     (bug que já havia sido corrigido em 20260115180335 e foi reintroduzido)
  2. processar_transferencia_origem() não passava os parâmetros extras de
     rastreabilidade para atualizar_estoque_pontos

  ## Correções:
  - Saída usa quantidade POSITIVA (comportamento correto)
  - Mantém os parâmetros de rastreabilidade (origem, observacao, referencia_id, etc.)
  - Compra no carrinho continua sem debitar a origem
*/

-- ==========================================
-- 1. ORIGEM: corrigida com quantidade positiva
-- ==========================================
CREATE OR REPLACE FUNCTION processar_transferencia_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destino_programa_nome text;
BEGIN
  -- Compra no carrinho: pontos não saem da origem
  -- (entram e saem ao mesmo tempo — efeito de passagem)
  IF NEW.realizar_compra_carrinho = true THEN
    RETURN NEW;
  END IF;

  -- Buscar nome do programa de destino para rastreabilidade
  SELECT nome INTO v_destino_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.destino_programa_id;

  -- Transferência normal: debita da origem (quantidade POSITIVA)
  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.origem_programa_id,
    NEW.origem_quantidade,
    'Saída',
    0,
    'Transferência de Pontos',
    'Transferência para ' || COALESCE(v_destino_programa_nome, 'destino'),
    NEW.id,
    'transferencia_pontos',
    'transferencia_saida'
  );

  RETURN NEW;
END;
$$;

-- ==========================================
-- 2. DESTINO: usa compra_valor_total quando carrinho
-- ==========================================
CREATE OR REPLACE FUNCTION processar_transferencia_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_custo_medio  decimal;
  v_valor_destino       decimal;
  v_origem_programa_nome text;
BEGIN
  -- Buscar custo médio da origem (usado apenas em transferência normal)
  SELECT custo_medio INTO v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.origem_programa_id;

  -- Buscar nome do programa de origem para rastreabilidade
  SELECT nome INTO v_origem_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.origem_programa_id;

  -- Definir valor que entra no destino
  IF NEW.realizar_compra_carrinho = true THEN
    -- Usa o custo real da compra no carrinho (total em R$)
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
      v_valor_destino,
      'Transferência de Pontos',
      'Recebimento de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- INSERT com bônus destino Concluído
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_bonus'
    );
  END IF;

  -- INSERT com bônus bumerangue Concluído
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus bumerangue',
      NEW.id,
      'transferencia_pontos',
      'bumerangue_retorno'
    );
  END IF;

  -- UPDATE de Pendente para Concluído: creditar pontos principais
  IF (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      v_valor_destino,
      'Transferência de Pontos',
      'Recebimento de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- UPDATE de status_bonus_destino de Pendente para Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_destino = 'Pendente' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_bonus'
    );
  END IF;

  RETURN NEW;
END;
$$;
