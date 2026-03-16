/*
  # Corrigir ordem de registro de movimentação na transferência entre pessoas

  1. Problema
    - `registrar_movimentacao_transferencia_pessoas` é chamada DEPOIS de `atualizar_estoque_pontos`
    - Isso faz com que os saldos anterior/posterior fiquem incorretos
    - O saldo "anterior" já é o saldo após a operação
    
  2. Correção
    - Chamar `registrar_movimentacao_transferencia_pessoas` ANTES de `atualizar_estoque_pontos`
    - Assim os saldos serão calculados corretamente
*/

-- Corrigir função de origem para registrar movimentação ANTES de atualizar estoque
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_saldo numeric;
  v_destino_parceiro_nome text;
BEGIN
  SELECT saldo_atual INTO v_origem_saldo
  FROM estoque_pontos
  WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;
  
  IF v_origem_saldo < NEW.quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no estoque de origem';
  END IF;
  
  SELECT nome_parceiro INTO v_destino_parceiro_nome
  FROM parceiros
  WHERE id = NEW.destino_parceiro_id;
  
  PERFORM registrar_movimentacao_transferencia_pessoas(
    NEW.origem_parceiro_id,
    NEW.programa_id,
    'saida',
    NEW.quantidade,
    NEW.custo_transferencia,
    v_destino_parceiro_nome,
    NEW.id
  );
  
  PERFORM atualizar_estoque_pontos(
    NEW.origem_parceiro_id,
    NEW.programa_id,
    NEW.quantidade,
    'Saída',
    0
  );
  
  RETURN NEW;
END;
$$;

-- Corrigir função de destino para registrar movimentação ANTES de atualizar estoque
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destino_estoque_id uuid;
  v_destino_saldo numeric;
  v_destino_custo_medio numeric;
  v_origem_custo_medio numeric;
  v_novo_saldo_destino numeric;
  v_novo_custo_medio numeric;
  v_origem_parceiro_nome text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    
    SELECT nome_parceiro INTO v_origem_parceiro_nome
    FROM parceiros
    WHERE id = NEW.origem_parceiro_id;
    
    SELECT custo_medio INTO v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;
    
    SELECT id, saldo_atual, custo_medio 
    INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.destino_parceiro_id AND programa_id = NEW.destino_programa_id;
    
    IF v_destino_estoque_id IS NULL THEN
      INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
      VALUES (NEW.destino_parceiro_id, NEW.destino_programa_id, 0, 0)
      RETURNING id, saldo_atual, custo_medio 
      INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio;
    END IF;
    
    v_novo_saldo_destino := v_destino_saldo + NEW.quantidade;
    IF v_novo_saldo_destino > 0 THEN
      v_novo_custo_medio := ((v_destino_saldo * v_destino_custo_medio) + (NEW.quantidade * COALESCE(v_origem_custo_medio, 0))) / v_novo_saldo_destino;
    ELSE
      v_novo_custo_medio := 0;
    END IF;
    
    PERFORM registrar_movimentacao_transferencia_pessoas(
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      'entrada',
      NEW.quantidade,
      0,
      v_origem_parceiro_nome,
      NEW.id
    );
    
    UPDATE estoque_pontos
    SET saldo_atual = v_novo_saldo_destino,
        custo_medio = v_novo_custo_medio,
        updated_at = now()
    WHERE id = v_destino_estoque_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_transferencia_pessoas_origem() IS 
'Debita pontos da origem - registra movimentação ANTES de atualizar estoque para saldos corretos';

COMMENT ON FUNCTION processar_transferencia_pessoas_destino() IS 
'Credita pontos no destino - registra movimentação ANTES de atualizar estoque para saldos corretos';
