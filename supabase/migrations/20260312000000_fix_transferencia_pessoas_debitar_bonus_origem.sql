/*
  # Corrigir transferência entre pessoas: debitar bônus da origem

  1. Problema
    - O trigger só debitava `quantidade` da origem, mas não o `bonus_destino`
    - O bônus enviado não era debitado do saldo do remetente
    - O saldo da origem ficava maior do que deveria após a transferência

  2. Solução
    - Debitar `quantidade + bonus_destino` da origem
    - Validar saldo considerando o total (quantidade + bônus)
*/

CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_completa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_saldo numeric;
  v_origem_custo_medio numeric;
  v_origem_parceiro_nome text;
  v_destino_parceiro_nome text;
  v_valor_recebido numeric;
  v_custo_transferencia numeric;
  v_bonus_destino integer;
  v_total_debitar numeric;
BEGIN
  IF (TG_OP = 'INSERT' AND LOWER(NEW.status) = 'concluído') OR
     (TG_OP = 'UPDATE' AND LOWER(OLD.status) != 'concluído' AND LOWER(NEW.status) = 'concluído') THEN

    -- 1. CAPTURAR custo_medio da origem ANTES de qualquer alteração
    SELECT saldo_atual, custo_medio
    INTO v_origem_saldo, v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

    IF v_origem_saldo IS NULL THEN
      RAISE EXCEPTION 'Estoque de origem não encontrado para parceiro_id=% programa_id=%',
        NEW.origem_parceiro_id, NEW.programa_id;
    END IF;

    v_origem_custo_medio := COALESCE(v_origem_custo_medio, 0);
    v_bonus_destino := COALESCE(NEW.bonus_destino, 0);
    v_total_debitar := NEW.quantidade + v_bonus_destino;

    -- Validar saldo (quantidade + bônus)
    IF v_origem_saldo < v_total_debitar THEN
      RAISE EXCEPTION 'Saldo insuficiente no estoque de origem. Disponível: %, Necessário: % (% + % bônus)',
        v_origem_saldo, v_total_debitar, NEW.quantidade, v_bonus_destino;
    END IF;

    -- Buscar nomes dos parceiros
    SELECT nome_parceiro INTO v_destino_parceiro_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
    SELECT nome_parceiro INTO v_origem_parceiro_nome FROM parceiros WHERE id = NEW.origem_parceiro_id;

    -- 2. PROCESSAR SAÍDA da origem (quantidade + bônus)
    PERFORM atualizar_estoque_pontos(
      NEW.origem_parceiro_id,
      NEW.programa_id,
      v_total_debitar,
      'Saída',
      0,
      'transferencia_pessoas',
      'Transferência para ' || COALESCE(v_destino_parceiro_nome, 'destino'),
      NEW.id,
      'transferencia_pessoas'
    );

    -- 3. CALCULAR valor para entrada no destino usando custo_medio capturado ANTES da saída
    v_valor_recebido := (NEW.quantidade * v_origem_custo_medio / 1000);

    IF NEW.tem_custo = true THEN
      v_custo_transferencia := COALESCE(NEW.valor_custo, 0);
    ELSE
      v_custo_transferencia := 0;
    END IF;

    -- 4. PROCESSAR ENTRADA no destino (quantidade principal)
    PERFORM atualizar_estoque_pontos(
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      NEW.quantidade,
      'Entrada',
      v_valor_recebido + v_custo_transferencia,
      'transferencia_pessoas',
      'Recebido de ' || COALESCE(v_origem_parceiro_nome, 'origem'),
      NEW.id,
      'transferencia_pessoas'
    );

    -- 5. PROCESSAR BÔNUS no destino (se houver)
    IF v_bonus_destino > 0 THEN
      PERFORM atualizar_estoque_pontos(
        NEW.destino_parceiro_id,
        NEW.destino_programa_id,
        v_bonus_destino,
        'Entrada',
        v_bonus_destino * v_origem_custo_medio / 1000, -- bônus carrega custo da origem
        'transferencia_pessoas_bonus',
        'Bônus de transferência de ' || COALESCE(v_origem_parceiro_nome, 'origem'),
        NEW.id,
        'transferencia_pessoas'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_transferencia_pessoas_completa() IS
'Processa transferência entre pessoas: debita quantidade+bônus da origem,
credita quantidade no destino com custo da origem, credita bônus no destino
com custo proporcional da origem.';
