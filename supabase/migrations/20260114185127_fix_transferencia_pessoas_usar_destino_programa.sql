/*
  # Corrigir função de transferência entre pessoas para usar destino_programa_id

  1. Problema
    - A função `processar_transferencia_pessoas_destino()` estava usando `NEW.programa_id` 
      ao invés de `NEW.destino_programa_id` ao creditar pontos no parceiro destino
    - Isso causava entrada de pontos no programa ERRADO no destino
    
  2. Correção
    - Atualizar função para usar `NEW.destino_programa_id` ao:
      - Buscar/criar estoque do destino
      - Registrar movimentação de entrada
    
  3. Impacto
    - Transferências entre pessoas agora creditam no programa correto do destino
    - Permite transferir LATAM → LIVELO corretamente
*/

-- Corrigir função de destino para usar destino_programa_id
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
    
    UPDATE estoque_pontos
    SET saldo_atual = v_novo_saldo_destino,
        custo_medio = v_novo_custo_medio,
        updated_at = now()
    WHERE id = v_destino_estoque_id;
    
    PERFORM registrar_movimentacao_transferencia_pessoas(
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      'entrada',
      NEW.quantidade,
      0,
      v_origem_parceiro_nome,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_transferencia_pessoas_destino() IS 
'Credita pontos no destino usando o destino_programa_id (programa correto do destino)';
