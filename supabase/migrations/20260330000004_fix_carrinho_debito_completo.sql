/*
  # Fix Carrinho: debitar origem_quantidade completo

  ## Problema
  Migration anterior debitava (origem_quantidade - compra_quantidade) da origem,
  mas a compra já foi adicionada ao estoque pelo trigger de compras antes da
  transferência ser processada. Resultado: sobravam os pontos do carrinho na origem.

  ## Fluxo correto
  1. Frontend insere na tabela `compras` → trigger adiciona 100k ao Livelo
  2. Frontend insere em `transferencia_pontos` → trigger debita 600k do Livelo
  3. Livelo fica zerado (correto)

  ## Correção
  - processar_transferencia_origem: quando carrinho=true, debita origem_quantidade completo
  - processar_transferencia_destino: usa custo_medio atual (já reflete a compra) × destino_quantidade
*/

-- ==========================================
-- 1. ORIGEM: debita origem_quantidade completo
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
  -- Buscar nome do programa de destino para rastreabilidade
  SELECT nome INTO v_destino_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.destino_programa_id;

  -- Debita origem_quantidade completo (carrinho ou não)
  -- Quando carrinho: a compra já foi adicionada ao estoque antes desta trigger
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
-- 2. DESTINO: usa custo_medio atual × destino_quantidade
-- ==========================================
CREATE OR REPLACE FUNCTION processar_transferencia_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_custo_medio   decimal;
  v_valor_destino        decimal;
  v_origem_programa_nome text;
BEGIN
  -- Buscar custo médio atual da origem (já reflete a compra do carrinho se houve)
  SELECT custo_medio INTO v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.origem_programa_id;

  -- Buscar nome do programa de origem
  SELECT nome INTO v_origem_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.origem_programa_id;

  -- Valor do destino: custo médio atual × quantidade transferida
  v_valor_destino := (NEW.destino_quantidade / 1000.0) * COALESCE(v_origem_custo_medio, 0);

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
