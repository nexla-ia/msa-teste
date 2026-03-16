/*
  # Fix: Transferência de pontos — duplicidade no histórico + saldo da origem errado

  ## Problema 1 (CRÍTICO) — saldo da origem aumentava ao invés de diminuir
  - `processar_transferencia_origem` chamava `atualizar_estoque_pontos` com
    `-NEW.origem_quantidade` (quantidade negativa) e tipo 'Saída'.
  - A migration `20260311120001` mudou a lógica de 'Saída' para
    `saldo_posterior = saldo_anterior - p_quantidade`.
  - Com quantidade negativa: `saldo_anterior - (-200k) = saldo_anterior + 200k`
    → origem ganhava pontos ao invés de perder.

  ## Problema 2 — histórico duplicado para o destino
  - `processar_transferencia_destino` chamava:
    1. `atualizar_estoque_pontos(..., 'Entrada', ...)` → inseria tipo='entrada'
    2. `registrar_movimentacao_transferencia(..., 'Transferência - Entrada')` → inseria tipo='transferencia_entrada'
  - Resultado: duas linhas para cada transferência do destino.

  ## Solução
  1. Adicionar parâmetro opcional `p_tipo_movimentacao` em `atualizar_estoque_pontos`
     para permitir que o caller controle o tipo armazenado no histórico.
  2. Corrigir `processar_transferencia_origem` para usar quantidade positiva e
     passar `p_tipo_movimentacao = 'transferencia_saida'`.
  3. Corrigir `processar_transferencia_destino` para passar
     `p_tipo_movimentacao = 'transferencia_entrada'` e remover as chamadas
     duplicadas a `registrar_movimentacao_transferencia`.
*/

-- =====================================================================
-- 1. Atualizar atualizar_estoque_pontos para aceitar tipo_movimentacao
--    DROP a versão antiga (9 params) para evitar ambiguidade de overload
-- =====================================================================
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text, numeric, text, text, uuid, text);

CREATE OR REPLACE FUNCTION atualizar_estoque_pontos(
  p_parceiro_id       uuid,
  p_programa_id       uuid,
  p_quantidade        numeric,
  p_tipo              text,
  p_valor_total       numeric  DEFAULT 0,
  p_origem            text     DEFAULT NULL,
  p_observacao        text     DEFAULT NULL,
  p_referencia_id     uuid     DEFAULT NULL,
  p_referencia_tabela text     DEFAULT NULL,
  p_tipo_movimentacao text     DEFAULT NULL   -- override para o tipo gravado em estoque_movimentacoes
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_anterior       numeric;
  v_saldo_posterior      numeric;
  v_valor_anterior       numeric;
  v_valor_posterior      numeric;
  v_custo_medio_anterior numeric;
  v_custo_medio_posterior numeric;
  v_tipo_movimentacao    text;
  v_valor_movimentacao   numeric;
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
    v_tipo_movimentacao  := COALESCE(p_tipo_movimentacao, 'entrada');
    v_valor_movimentacao := p_valor_total;

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
    v_tipo_movimentacao := COALESCE(p_tipo_movimentacao, 'saida');

    -- Calcular valor da saída usando custo médio VIGENTE
    v_valor_movimentacao := (p_quantidade * v_custo_medio_anterior / 1000);

    v_saldo_posterior := v_saldo_anterior - p_quantidade;
    v_valor_posterior := v_valor_anterior - v_valor_movimentacao;

    IF v_saldo_posterior < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para saída. Saldo atual: %, Quantidade solicitada: %, Origem: %',
        v_saldo_anterior, p_quantidade, COALESCE(p_origem, 'não informada');
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
    saldo_atual  = v_saldo_posterior,
    valor_total  = v_valor_posterior,
    custo_medio  = v_custo_medio_posterior,
    updated_at   = now()
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
    v_valor_movimentacao,
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
SAÍDA: mantém custo médio, subtrai valor calculado (qtd × custo), RAISE EXCEPTION se saldo insuficiente.
p_tipo_movimentacao: se fornecido, usa esse valor em estoque_movimentacoes.tipo
  (ex: "transferencia_entrada", "transferencia_saida") ao invés do padrão ("entrada"/"saida").';


-- =====================================================================
-- 2. Corrigir processar_transferencia_origem
--    - Quantidade POSITIVA (corrige bug do saldo aumentando)
--    - Passa p_tipo_movimentacao = transferencia_saida
--    - Remove chamada duplicada a registrar_movimentacao_transferencia
-- =====================================================================
CREATE OR REPLACE FUNCTION processar_transferencia_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destino_programa_nome text;
BEGIN
  -- Buscar nome do programa de destino para a observação
  SELECT nome INTO v_destino_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.destino_programa_id;

  -- Debitar da origem (quantidade POSITIVA, tipo override = transferencia_saida)
  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.origem_programa_id,
    NEW.origem_quantidade,                            -- POSITIVO (corrige bug)
    'Saída',
    0,
    'Transferência de Pontos',
    'Transferência para ' || COALESCE(v_destino_programa_nome, 'destino'),
    NEW.id,
    'transferencia_pontos',
    'transferencia_saida'                             -- tipo correto no histórico
  );

  RETURN NEW;
END;
$$;


-- =====================================================================
-- 3. Corrigir processar_transferencia_destino
--    - Passa p_tipo_movimentacao = transferencia_entrada
--    - Remove todas as chamadas duplicadas a registrar_movimentacao_transferencia
-- =====================================================================
CREATE OR REPLACE FUNCTION processar_transferencia_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_custo_medio    decimal;
  v_origem_programa_nome  text;
BEGIN
  -- Buscar custo médio e nome da origem
  SELECT ep.custo_medio, pf.nome
  INTO v_origem_custo_medio, v_origem_programa_nome
  FROM estoque_pontos ep
  JOIN programas_fidelidade pf ON pf.id = ep.programa_id
  WHERE ep.parceiro_id = NEW.parceiro_id
    AND ep.programa_id = NEW.origem_programa_id;

  -- INSERT com status = Concluído → creditar pontos principais
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      (NEW.destino_quantidade / 1000) * COALESCE(v_origem_custo_medio, 0),
      'Transferência de Pontos',
      'Transferência de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- INSERT com status_bonus_destino = Concluído → creditar bônus destino
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus de transferência de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- INSERT com status_bonus_bumerangue = Concluído → creditar bônus bumerangue
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus bumerangue de transferência',
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- UPDATE Pendente → Concluído → creditar pontos principais
  IF (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      (NEW.destino_quantidade / 1000) * COALESCE(v_origem_custo_medio, 0),
      'Transferência de Pontos',
      'Transferência de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- UPDATE status_bonus_destino Pendente → Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_destino = 'Pendente' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus de transferência de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- UPDATE status_bonus_bumerangue Pendente → Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_bumerangue = 'Pendente' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus bumerangue de transferência',
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  RETURN NEW;
END;
$$;
