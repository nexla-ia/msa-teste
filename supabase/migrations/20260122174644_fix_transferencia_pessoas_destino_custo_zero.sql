/*
  # Corrigir custo médio do destino em transferências entre pessoas
  
  1. Problema
    - Função `processar_transferencia_pessoas_destino()` está calculando custo médio usando o custo da origem
    - Linha problemática: `v_novo_custo_medio := ((saldo * custo) + (quantidade * custo_origem)) / novo_saldo`
    - Isso está errado porque quem recebe pontos de graça não pagou nada
  
  2. Solução
    - Pontos recebidos gratuitamente devem ter custo ZERO
    - Nova fórmula: `v_novo_custo_medio := (saldo_anterior * custo_anterior) / novo_saldo`
    - Isso dilui o custo médio do destino, pois recebeu pontos gratuitos
  
  3. Exemplo
    - Destino tem 1000 pontos a R$ 10/mil = custo médio de 0.010
    - Recebe 1000 pontos de graça (custo 0)
    - Novo custo médio: (1000 * 0.010 + 1000 * 0) / 2000 = 0.005 (metade)
*/

-- Recriar função de destino com custo zero para pontos recebidos
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
  v_novo_saldo_destino numeric;
  v_novo_custo_medio numeric;
  v_origem_parceiro_nome text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    
    SELECT nome_parceiro INTO v_origem_parceiro_nome
    FROM parceiros
    WHERE id = NEW.origem_parceiro_id;
    
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
    
    -- Pontos recebidos gratuitamente têm custo ZERO
    -- Nova fórmula: (saldo_anterior * custo_anterior + quantidade_nova * 0) / saldo_novo
    -- Simplificado: (saldo_anterior * custo_anterior) / saldo_novo
    IF v_novo_saldo_destino > 0 THEN
      v_novo_custo_medio := (COALESCE(v_destino_saldo, 0) * COALESCE(v_destino_custo_medio, 0)) / v_novo_saldo_destino;
    ELSE
      v_novo_custo_medio := 0;
    END IF;
    
    PERFORM registrar_movimentacao_transferencia_pessoas(
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      'entrada',
      NEW.quantidade,
      0, -- Custo zero para quem recebe
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION processar_transferencia_pessoas_destino() TO anon, authenticated;

COMMENT ON FUNCTION processar_transferencia_pessoas_destino() IS 
'Credita pontos no destino com custo ZERO (pontos recebidos gratuitamente). Dilui o custo médio do destino ao receber pontos gratuitos.';