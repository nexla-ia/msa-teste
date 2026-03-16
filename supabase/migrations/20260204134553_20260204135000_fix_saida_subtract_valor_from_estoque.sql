/*
  # Corrigir lógica de SAÍDA para subtrair valor do estoque

  1. Problema Atual
    - Nas SAÍDAS (vendas, transferências), o sistema NÃO estava subtraindo o VALOR monetário do estoque
    - O custo médio era mantido, mas o valor total do estoque não era ajustado
    - Isso causa inconsistência entre saldo e valor total

  2. Mudanças
    - Adicionar coluna `valor_total` na tabela `estoque_pontos`
    - Corrigir função `atualizar_estoque_pontos()` para:
      * ENTRADA: somar valor ao valor_total
      * SAÍDA: subtrair (qtd_saida × custo_medio) do valor_total
    - Manter histórico imutável em `estoque_movimentacoes`

  3. Regras de Integridade
    - Cada SAÍDA grava o custo médio vigente no momento (histórico imutável)
    - Novas ENTRADAS recalculam custo_medio somente a partir daquele ponto
    - SAÍDAS anteriores nunca são recalculadas
    - Fórmula SAÍDA:
      * movimento.valor_total = qtd_saida × custo_medio_atual
      * estoque.saldo_atual -= qtd_saida
      * estoque.valor_total -= movimento.valor_total
      * estoque.custo_medio = MANTÉM (não muda)
*/

-- 1. Adicionar coluna valor_total no estoque_pontos
ALTER TABLE estoque_pontos 
ADD COLUMN IF NOT EXISTS valor_total numeric(15, 2) DEFAULT 0 NOT NULL;

-- 2. Calcular valor_total existente baseado em saldo_atual × custo_medio
UPDATE estoque_pontos
SET valor_total = (saldo_atual * custo_medio / 1000)
WHERE valor_total = 0 AND saldo_atual > 0;

-- 3. Recriar a função atualizar_estoque_pontos com lógica correta de saída
CREATE OR REPLACE FUNCTION atualizar_estoque_pontos(
  p_parceiro_id uuid,
  p_programa_id uuid,
  p_quantidade numeric,
  p_tipo text,
  p_valor_total numeric DEFAULT 0,
  p_origem text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_referencia_id uuid DEFAULT NULL,
  p_referencia_tabela text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_anterior numeric;
  v_saldo_posterior numeric;
  v_valor_anterior numeric;
  v_valor_posterior numeric;
  v_custo_medio_anterior numeric;
  v_custo_medio_posterior numeric;
  v_tipo_movimentacao text;
  v_valor_movimentacao numeric;
BEGIN
  -- Criar registro no estoque se não existir
  INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, valor_total, custo_medio)
  VALUES (p_parceiro_id, p_programa_id, 0, 0, 0)
  ON CONFLICT (parceiro_id, programa_id) DO NOTHING;

  -- Obter estado atual do estoque
  SELECT saldo_atual, valor_total, custo_medio
  INTO v_saldo_anterior, v_valor_anterior, v_custo_medio_anterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Processar ENTRADA
  IF p_tipo = 'Entrada' OR p_tipo = 'Compra de Pontos/Milhas' THEN
    v_tipo_movimentacao := 'entrada';
    v_valor_movimentacao := p_valor_total;

    -- Somar quantidade e valor
    v_saldo_posterior := v_saldo_anterior + p_quantidade;
    v_valor_posterior := v_valor_anterior + p_valor_total;

    -- Recalcular custo médio ponderado
    IF v_saldo_posterior > 0 THEN
      v_custo_medio_posterior := (v_valor_posterior / v_saldo_posterior) * 1000;
    ELSE
      v_custo_medio_posterior := 0;
    END IF;

  -- Processar SAÍDA
  ELSIF p_tipo = 'Saída' THEN
    v_tipo_movimentacao := 'saida';
    
    -- Calcular valor da saída usando custo médio VIGENTE
    v_valor_movimentacao := (p_quantidade * v_custo_medio_anterior / 1000);

    -- Subtrair quantidade e valor
    v_saldo_posterior := v_saldo_anterior - p_quantidade;
    v_valor_posterior := v_valor_anterior - v_valor_movimentacao;

    -- Proteger contra saldo/valor negativo
    IF v_saldo_posterior < 0 THEN
      v_saldo_posterior := 0;
    END IF;
    
    IF v_valor_posterior < 0 THEN
      v_valor_posterior := 0;
    END IF;

    -- Custo médio MANTÉM (não recalcula na saída)
    IF v_saldo_posterior = 0 THEN
      v_custo_medio_posterior := 0;
      v_valor_posterior := 0;
    ELSE
      v_custo_medio_posterior := v_custo_medio_anterior;
    END IF;

  ELSE
    RAISE EXCEPTION 'Tipo inválido: %. Use "Entrada" ou "Saída"', p_tipo;
  END IF;

  -- Atualizar estoque com novos valores
  UPDATE estoque_pontos
  SET 
    saldo_atual = v_saldo_posterior,
    valor_total = v_valor_posterior,
    custo_medio = v_custo_medio_posterior,
    updated_at = now()
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  -- Registrar movimentação no histórico (IMUTÁVEL)
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
    referencia_tabela
  ) VALUES (
    p_parceiro_id,
    p_programa_id,
    v_tipo_movimentacao,
    p_quantidade,
    v_valor_movimentacao,  -- Valor calculado (entrada ou saída)
    v_saldo_anterior,
    v_saldo_posterior,
    v_custo_medio_anterior,
    v_custo_medio_posterior,
    p_origem,
    p_observacao,
    p_referencia_id,
    p_referencia_tabela
  );
END;
$$;

COMMENT ON FUNCTION atualizar_estoque_pontos IS 
'Atualiza estoque com custo médio ponderado. 
ENTRADA: recalcula custo médio. 
SAÍDA: mantém custo médio e subtrai valor calculado (qtd × custo).';

COMMENT ON COLUMN estoque_pontos.valor_total IS 
'Valor monetário total do estoque (saldo × custo_medio). 
Aumenta nas entradas, diminui nas saídas.';
