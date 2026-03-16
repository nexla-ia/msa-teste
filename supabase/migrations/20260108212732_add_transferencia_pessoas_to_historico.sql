/*
  # Adicionar transferências entre pessoas ao histórico de movimentações

  1. Alterações
    - Criar função para registrar movimentações de transferência entre pessoas
    - Atualizar trigger para registrar no histórico ao processar transferências
    - Adicionar novos tipos de movimentação à constraint

  2. Comportamento
    - Quando uma transferência entre pessoas é criada, registra:
      - Uma saída no parceiro de origem (com nome do parceiro destino)
      - Uma entrada no parceiro de destino (com nome do parceiro origem)
    - O campo "observacao" inclui detalhes (de qual parceiro para qual parceiro)
*/

-- Atualizar constraint para incluir novos tipos
ALTER TABLE estoque_movimentacoes
  DROP CONSTRAINT IF EXISTS estoque_movimentacoes_tipo_check;

ALTER TABLE estoque_movimentacoes
  ADD CONSTRAINT estoque_movimentacoes_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    'entrada'::text, 
    'saida'::text,
    'transferencia_entrada'::text,
    'transferencia_saida'::text,
    'transferencia_pessoas_entrada'::text,
    'transferencia_pessoas_saida'::text
  ]));

-- Função para registrar movimentação de transferência entre pessoas
CREATE OR REPLACE FUNCTION registrar_movimentacao_transferencia_pessoas(
  p_parceiro_id uuid,
  p_programa_id uuid,
  p_tipo text,
  p_quantidade decimal,
  p_valor_total decimal,
  p_outro_parceiro_nome text,
  p_referencia_id uuid
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
  v_tipo_movimentacao text;
BEGIN
  -- Buscar saldos e custos anteriores
  SELECT saldo_atual, custo_medio 
  INTO v_saldo_anterior, v_custo_medio_anterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Calcular saldo posterior e determinar tipo
  IF p_tipo = 'saida' THEN
    v_saldo_posterior := COALESCE(v_saldo_anterior, 0) - p_quantidade;
    v_tipo_movimentacao := 'transferencia_pessoas_saida';
    v_observacao := 'Transferência para ' || p_outro_parceiro_nome;
  ELSE
    v_saldo_posterior := COALESCE(v_saldo_anterior, 0) + p_quantidade;
    v_tipo_movimentacao := 'transferencia_pessoas_entrada';
    v_observacao := 'Transferência de ' || p_outro_parceiro_nome;
  END IF;

  -- Buscar custo médio posterior (já foi atualizado)
  SELECT custo_medio 
  INTO v_custo_medio_posterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

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
    v_tipo_movimentacao,
    p_quantidade,
    p_valor_total,
    COALESCE(v_saldo_anterior, 0),
    v_saldo_posterior,
    COALESCE(v_custo_medio_anterior, 0),
    COALESCE(v_custo_medio_posterior, 0),
    'Transferência entre Pessoas',
    v_observacao,
    p_referencia_id,
    'transferencia_pessoas',
    now()
  );
END;
$$;

-- Atualizar função de processar transferência entre pessoas
CREATE OR REPLACE FUNCTION process_transferencia_pessoas()
RETURNS TRIGGER AS $$
DECLARE
  v_origem_estoque_id uuid;
  v_destino_estoque_id uuid;
  v_origem_saldo numeric;
  v_origem_custo_medio numeric;
  v_destino_saldo numeric;
  v_destino_custo_medio numeric;
  v_novo_saldo_destino numeric;
  v_novo_custo_medio numeric;
  v_origem_parceiro_nome text;
  v_destino_parceiro_nome text;
BEGIN
  -- Buscar nomes dos parceiros
  SELECT nome_parceiro INTO v_origem_parceiro_nome
  FROM parceiros
  WHERE id = NEW.origem_parceiro_id;

  SELECT nome_parceiro INTO v_destino_parceiro_nome
  FROM parceiros
  WHERE id = NEW.destino_parceiro_id;

  -- Buscar estoque da origem
  SELECT id, saldo_atual, custo_medio INTO v_origem_estoque_id, v_origem_saldo, v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

  -- Validar se origem tem saldo suficiente
  IF v_origem_saldo < NEW.quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no estoque de origem';
  END IF;

  -- Buscar ou criar estoque do destino
  SELECT id, saldo_atual, custo_medio INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.destino_parceiro_id AND programa_id = NEW.programa_id;

  IF v_destino_estoque_id IS NULL THEN
    -- Criar estoque para o destino
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
    VALUES (NEW.destino_parceiro_id, NEW.programa_id, 0, 0)
    RETURNING id, saldo_atual, custo_medio INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio;
  END IF;

  -- Atualizar estoque de origem (diminuir)
  UPDATE estoque_pontos
  SET saldo_atual = saldo_atual - NEW.quantidade,
      updated_at = now()
  WHERE id = v_origem_estoque_id;

  -- Registrar movimentação de saída no histórico
  PERFORM registrar_movimentacao_transferencia_pessoas(
    NEW.origem_parceiro_id,
    NEW.programa_id,
    'saida',
    NEW.quantidade,
    NEW.custo_transferencia,
    v_destino_parceiro_nome,
    NEW.id
  );

  -- Calcular novo custo médio do destino
  v_novo_saldo_destino := v_destino_saldo + NEW.quantidade;
  IF v_novo_saldo_destino > 0 THEN
    v_novo_custo_medio := ((v_destino_saldo * v_destino_custo_medio) + (NEW.quantidade * v_origem_custo_medio)) / v_novo_saldo_destino;
  ELSE
    v_novo_custo_medio := 0;
  END IF;

  -- Atualizar estoque de destino (aumentar)
  UPDATE estoque_pontos
  SET saldo_atual = v_novo_saldo_destino,
      custo_medio = v_novo_custo_medio,
      updated_at = now()
  WHERE id = v_destino_estoque_id;

  -- Registrar movimentação de entrada no histórico
  PERFORM registrar_movimentacao_transferencia_pessoas(
    NEW.destino_parceiro_id,
    NEW.programa_id,
    'entrada',
    NEW.quantidade,
    0, -- Não tem custo no destino, pontos já foram contabilizados
    v_origem_parceiro_nome,
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;