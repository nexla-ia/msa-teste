/*
  # Adicionar transferências ao histórico de movimentações do estoque

  1. Alterações
    - Criar função para registrar movimentações de transferência
    - Atualizar triggers de transferência para registrar no histórico
    - Registrar saída da origem como "Transferência - Saída"
    - Registrar entrada no destino como "Transferência - Entrada"
    - Incluir informações de origem e destino na observação

  2. Comportamento
    - Quando uma transferência é criada, registra:
      - Uma saída no programa de origem
      - Uma ou mais entradas no programa de destino (pontos principais + bônus)
    - O campo "origem" indica a origem da movimentação
    - O campo "observacao" inclui detalhes da transferência (de X para Y)
*/

-- Função para registrar movimentação de transferência no histórico
CREATE OR REPLACE FUNCTION registrar_movimentacao_transferencia(
  p_parceiro_id uuid,
  p_programa_id uuid,
  p_tipo text,
  p_quantidade decimal,
  p_valor_total decimal,
  p_origem_programa_nome text DEFAULT NULL,
  p_destino_programa_nome text DEFAULT NULL,
  p_referencia_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_anterior decimal;
  v_saldo_posterior decimal;
  v_custo_medio_anterior decimal;
  v_custo_medio_posterior decimal;
  v_observacao text;
BEGIN
  -- Buscar saldos e custos anteriores
  SELECT saldo_atual, custo_medio 
  INTO v_saldo_anterior, v_custo_medio_anterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Calcular saldo posterior
  IF p_tipo LIKE '%Saída%' THEN
    v_saldo_posterior := COALESCE(v_saldo_anterior, 0) - p_quantidade;
  ELSE
    v_saldo_posterior := COALESCE(v_saldo_anterior, 0) + p_quantidade;
  END IF;

  -- Buscar custo médio posterior (já foi atualizado pela função atualizar_estoque_pontos)
  SELECT custo_medio 
  INTO v_custo_medio_posterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Construir observação
  IF p_tipo LIKE '%Saída%' AND p_destino_programa_nome IS NOT NULL THEN
    v_observacao := 'Transferência para ' || p_destino_programa_nome;
  ELSIF p_tipo LIKE '%Entrada%' AND p_origem_programa_nome IS NOT NULL THEN
    v_observacao := 'Transferência de ' || p_origem_programa_nome;
  ELSE
    v_observacao := NULL;
  END IF;

  -- Inserir na tabela de movimentações
  INSERT INTO estoque_movimentacoes (
    parceiro_id,
    programa_id,
    tipo,
    quantidade,
    valor_total,
    saldo_anterior,
    saldo_posterior,
    custo_medio_anterior,
    custo_medio_posterior,
    origem,
    observacao,
    referencia_id,
    referencia_tabela,
    data_movimentacao
  ) VALUES (
    p_parceiro_id,
    p_programa_id,
    p_tipo,
    p_quantidade,
    p_valor_total,
    COALESCE(v_saldo_anterior, 0),
    v_saldo_posterior,
    COALESCE(v_custo_medio_anterior, 0),
    COALESCE(v_custo_medio_posterior, 0),
    'Transferência de Pontos',
    v_observacao,
    p_referencia_id,
    'transferencia_pontos',
    now()
  );
END;
$$;

-- Atualizar função de processar transferência origem para registrar movimentação
CREATE OR REPLACE FUNCTION processar_transferencia_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destino_programa_nome text;
BEGIN
  -- Buscar nome do programa de destino
  SELECT nome INTO v_destino_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.destino_programa_id;

  -- Debita da origem
  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.origem_programa_id,
    -NEW.origem_quantidade,
    'Saída',
    0
  );
  
  -- Registrar movimentação de saída no histórico
  PERFORM registrar_movimentacao_transferencia(
    NEW.parceiro_id,
    NEW.origem_programa_id,
    'Transferência - Saída',
    NEW.origem_quantidade,
    0,
    NULL,
    v_destino_programa_nome,
    NEW.id
  );
  
  RETURN NEW;
END;
$$;

-- Atualizar função de processar transferência destino para registrar movimentações
CREATE OR REPLACE FUNCTION processar_transferencia_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_custo_medio decimal;
  v_origem_programa_nome text;
BEGIN
  -- Buscar custo médio e nome da origem
  SELECT ep.custo_medio, pf.nome 
  INTO v_origem_custo_medio, v_origem_programa_nome
  FROM estoque_pontos ep
  JOIN programas_fidelidade pf ON pf.id = ep.programa_id
  WHERE ep.parceiro_id = NEW.parceiro_id 
    AND ep.programa_id = NEW.origem_programa_id;
  
  -- Se for INSERT e status = Concluído, creditar pontos principais
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      (NEW.destino_quantidade / 1000) * COALESCE(v_origem_custo_medio, 0)
    );
    
    -- Registrar movimentação de entrada no histórico
    PERFORM registrar_movimentacao_transferencia(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      'Transferência - Entrada',
      NEW.destino_quantidade,
      (NEW.destino_quantidade / 1000) * COALESCE(v_origem_custo_medio, 0),
      v_origem_programa_nome,
      NULL,
      NEW.id
    );
  END IF;
  
  -- Se for INSERT e status_bonus_destino = Concluído e tem bônus, creditar bônus
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0
    );
    
    -- Registrar movimentação de bônus no histórico
    PERFORM registrar_movimentacao_transferencia(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      'Transferência - Entrada (Bônus)',
      NEW.destino_quantidade_bonus,
      0,
      v_origem_programa_nome,
      NULL,
      NEW.id
    );
  END IF;
  
  -- Se for INSERT e status_bonus_bumerangue = Concluído e tem bônus, creditar bônus bumerangue
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0
    );
    
    -- Registrar movimentação de bônus bumerangue no histórico
    PERFORM registrar_movimentacao_transferencia(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      'Transferência - Entrada (Bumerangue)',
      NEW.bumerangue_quantidade_bonus,
      0,
      v_origem_programa_nome,
      NULL,
      NEW.id
    );
  END IF;
  
  -- Se for UPDATE de Pendente para Concluído, processar pontos principais
  IF (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      (NEW.destino_quantidade / 1000) * COALESCE(v_origem_custo_medio, 0)
    );
    
    -- Registrar movimentação de entrada no histórico
    PERFORM registrar_movimentacao_transferencia(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      'Transferência - Entrada',
      NEW.destino_quantidade,
      (NEW.destino_quantidade / 1000) * COALESCE(v_origem_custo_medio, 0),
      v_origem_programa_nome,
      NULL,
      NEW.id
    );
  END IF;
  
  -- Se for UPDATE de status_bonus_destino de Pendente para Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_destino = 'Pendente' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0
    );
    
    -- Registrar movimentação de bônus no histórico
    PERFORM registrar_movimentacao_transferencia(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      'Transferência - Entrada (Bônus)',
      NEW.destino_quantidade_bonus,
      0,
      v_origem_programa_nome,
      NULL,
      NEW.id
    );
  END IF;
  
  -- Se for UPDATE de status_bonus_bumerangue de Pendente para Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_bumerangue = 'Pendente' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0
    );
    
    -- Registrar movimentação de bônus bumerangue no histórico
    PERFORM registrar_movimentacao_transferencia(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      'Transferência - Entrada (Bumerangue)',
      NEW.bumerangue_quantidade_bonus,
      0,
      v_origem_programa_nome,
      NULL,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;