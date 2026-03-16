/*
  # Corrigir constraint de tipo na tabela estoque_movimentacoes

  1. Alterações
    - Remover constraint antiga que só permite 'entrada' e 'saida'
    - Adicionar nova constraint que permite tipos de transferência
    - Atualizar função registrar_movimentacao_transferencia para usar tipos válidos

  2. Tipos permitidos
    - entrada
    - saida
    - transferencia_entrada
    - transferencia_saida
*/

-- Remover constraint antiga
ALTER TABLE estoque_movimentacoes
  DROP CONSTRAINT IF EXISTS estoque_movimentacoes_tipo_check;

-- Adicionar nova constraint com tipos adicionais para transferências
ALTER TABLE estoque_movimentacoes
  ADD CONSTRAINT estoque_movimentacoes_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    'entrada'::text, 
    'saida'::text,
    'transferencia_entrada'::text,
    'transferencia_saida'::text
  ]));

-- Atualizar função para usar tipos válidos
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
  v_tipo_movimentacao text;
BEGIN
  -- Buscar saldos e custos anteriores
  SELECT saldo_atual, custo_medio 
  INTO v_saldo_anterior, v_custo_medio_anterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Calcular saldo posterior
  IF p_tipo LIKE '%Saída%' THEN
    v_saldo_posterior := COALESCE(v_saldo_anterior, 0) - p_quantidade;
    v_tipo_movimentacao := 'transferencia_saida';
  ELSE
    v_saldo_posterior := COALESCE(v_saldo_anterior, 0) + p_quantidade;
    v_tipo_movimentacao := 'transferencia_entrada';
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
    v_tipo_movimentacao,
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