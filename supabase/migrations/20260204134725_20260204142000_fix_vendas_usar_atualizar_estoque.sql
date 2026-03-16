/*
  # Corrigir vendas para usar atualizar_estoque_pontos() e calcular CMV

  1. Problema
    - A função `processar_venda()` estava fazendo UPDATE direto no estoque
    - Não calculava nem subtraía o valor_total (CMV) da venda
    - Custo médio era apenas registrado, mas valor não era calculado

  2. Correção
    - Usar `atualizar_estoque_pontos()` para dar baixa no estoque
    - Calcular CMV (Custo da Mercadoria Vendida) = quantidade × custo_medio
    - Registrar CMV na venda para cálculos de margem/lucro

  3. Campos na tabela vendas
    - `custo_medio`: custo por 1000 pontos no momento da venda (já existe)
    - `cmv`: valor total do custo (quantidade × custo_medio / 1000) - adicionar se não existir

  4. Impacto
    - Vendas agora mantêm integridade do valor_total no estoque
    - CMV calculado corretamente para análise de rentabilidade
    - Histórico de movimentações consistente
*/

-- Adicionar coluna cmv (Custo da Mercadoria Vendida) na tabela vendas se não existir
ALTER TABLE vendas 
ADD COLUMN IF NOT EXISTS cmv numeric(15, 2);

COMMENT ON COLUMN vendas.cmv IS 
'Custo da Mercadoria Vendida (CMV). 
Calculado como: quantidade_milhas × custo_medio / 1000.
Valor imutável registrado no momento da venda.';

-- Corrigir função processar_venda para usar atualizar_estoque_pontos
CREATE OR REPLACE FUNCTION processar_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo_atual numeric;
  v_custo_medio numeric;
  v_cmv numeric;
BEGIN
  -- Buscar saldo atual e custo médio do estoque
  SELECT saldo_atual, custo_medio
  INTO v_saldo_atual, v_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.programa_id;

  -- Se não existir registro de estoque, criar com saldo 0
  IF NOT FOUND THEN
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, valor_total, custo_medio)
    VALUES (NEW.parceiro_id, NEW.programa_id, 0, 0, 0);
    v_saldo_atual := 0;
    v_custo_medio := 0;
  END IF;

  -- Validar se há saldo suficiente
  IF v_saldo_atual < NEW.quantidade_milhas THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: %, Quantidade solicitada: %', 
      v_saldo_atual, NEW.quantidade_milhas;
  END IF;

  -- Calcular CMV (Custo da Mercadoria Vendida)
  v_cmv := (NEW.quantidade_milhas * v_custo_medio / 1000);

  -- Registrar saldo anterior, custo médio e CMV na venda
  NEW.saldo_anterior := v_saldo_atual;
  NEW.custo_medio := v_custo_medio;
  NEW.cmv := v_cmv;

  -- Controlar baixa de estoque baseado no tipo de cliente
  IF NEW.tipo_cliente IN ('cliente_final', 'agencia_convencional') THEN
    -- Baixar do estoque usando atualizar_estoque_pontos
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      NEW.quantidade_milhas,
      'Saída',
      0, -- Saída calcula valor automaticamente
      'venda',
      'Venda #' || NEW.id::text,
      NEW.id,
      'vendas'
    );

    NEW.estoque_reservado := false;
    NEW.quantidade_reservada := 0;
  ELSE
    -- Agência grande: apenas reservar estoque (não baixa ainda)
    NEW.estoque_reservado := true;
    NEW.quantidade_reservada := NEW.quantidade_milhas;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_venda() IS 
'Processa venda calculando CMV e atualizando estoque.
Cliente final/Convencional: baixa imediata do estoque.
Agência grande: apenas reserva (baixa posterior).';
