/*
  # Adicionar suporte a bônus na transferência entre pessoas
  
  1. Lógica de Bônus
    - Pontos transferidos: levam o custo da origem junto
    - Bônus recebido: tem custo ZERO (é um benefício gratuito)
    - Exemplo:
      * Paulo transfere 10.000 pontos a R$ 29,41/k para Davi
      * Davi recebe 10.000 + bônus de 1.000 (10%)
      * Os 10.000 custam R$ 29,41/k (transferido de Paulo)
      * O bônus de 1.000 custa R$ 0 (gratuito)
      * Novo custo médio de Davi = (10k * 29,41 + 1k * 0) / 11k = R$ 26,74/k
  
  2. Atualização
    - Função processar_transferencia_pessoas_destino agora processa bônus
    - Bônus é creditado separadamente com custo ZERO
    - Função registrar_movimentacao_transferencia_pessoas registra ambos
*/

-- Recriar função de destino com suporte a bônus
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
  v_custo_total_origem_reais numeric;
  v_custo_total_antigo_reais numeric;
  v_custo_transferencia_reais numeric;
  v_custo_total_novo_reais numeric;
  v_bonus_destino integer;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    
    -- Buscar nome do parceiro de origem
    SELECT nome_parceiro INTO v_origem_parceiro_nome
    FROM parceiros
    WHERE id = NEW.origem_parceiro_id;
    
    -- Buscar custo médio da origem
    SELECT custo_medio INTO v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;
    
    v_origem_custo_medio := COALESCE(v_origem_custo_medio, 0);
    
    -- Buscar estoque do destino
    SELECT id, saldo_atual, custo_medio 
    INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.destino_parceiro_id AND programa_id = NEW.destino_programa_id;
    
    -- Criar estoque se não existir
    IF v_destino_estoque_id IS NULL THEN
      INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
      VALUES (NEW.destino_parceiro_id, NEW.destino_programa_id, 0, 0)
      RETURNING id, saldo_atual, custo_medio 
      INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio;
    END IF;
    
    v_destino_saldo := COALESCE(v_destino_saldo, 0);
    v_destino_custo_medio := COALESCE(v_destino_custo_medio, 0);
    v_bonus_destino := COALESCE(NEW.bonus_destino, 0);
    
    -- Calcular novo saldo (incluindo bônus)
    v_novo_saldo_destino := v_destino_saldo + NEW.quantidade + v_bonus_destino;
    
    -- Calcular novo custo médio
    -- Fórmula: (saldo_antigo * custo_antigo + quantidade * custo_origem + taxa + bonus * 0) / saldo_novo
    IF v_novo_saldo_destino > 0 THEN
      -- Custo total antigo em reais
      v_custo_total_antigo_reais := calcular_custo_total_reais(v_destino_saldo, v_destino_custo_medio);
      
      -- Custo dos pontos recebidos em reais (vem da origem)
      v_custo_total_origem_reais := calcular_custo_total_reais(NEW.quantidade, v_origem_custo_medio);
      
      -- Custo de transferência (se houver) - quem paga é o destino
      v_custo_transferencia_reais := COALESCE(NEW.custo_transferencia, 0);
      
      -- Custo total novo em reais (bônus não entra no custo porque é gratuito)
      v_custo_total_novo_reais := v_custo_total_antigo_reais + v_custo_total_origem_reais + v_custo_transferencia_reais;
      
      -- Converter de volta para custo por milheiro
      v_novo_custo_medio := (v_custo_total_novo_reais * 1000.0) / v_novo_saldo_destino;
    ELSE
      v_novo_custo_medio := 0;
    END IF;
    
    -- Atualizar estoque do destino
    UPDATE estoque_pontos
    SET saldo_atual = v_novo_saldo_destino,
        custo_medio = v_novo_custo_medio,
        updated_at = now()
    WHERE id = v_destino_estoque_id;
    
    -- Registrar movimentação de entrada dos pontos normais (crédito)
    PERFORM registrar_movimentacao_transferencia_pessoas(
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      'entrada',
      NEW.quantidade,
      v_origem_custo_medio, -- Custo que veio da origem
      v_origem_parceiro_nome || ' (transferência)',
      NEW.id
    );
    
    -- Se houver bônus, registrar movimentação separada com custo ZERO
    IF v_bonus_destino > 0 THEN
      PERFORM registrar_movimentacao_transferencia_pessoas(
        NEW.destino_parceiro_id,
        NEW.destino_programa_id,
        'entrada',
        v_bonus_destino,
        0, -- Bônus tem custo ZERO
        v_origem_parceiro_nome || ' (bônus de transferência)',
        NEW.id
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION processar_transferencia_pessoas_destino() TO anon, authenticated;

COMMENT ON FUNCTION processar_transferencia_pessoas_destino() IS 
'Credita pontos no destino COM o custo transferido da origem. Bônus é creditado com custo ZERO. 
Fórmula: novo_custo = (custo_antigo + custo_transferido + taxa) / (saldo_novo incluindo bônus)
Exemplo: Recebe 10k a R$29,41 + 1k bônus + R$10 taxa = (0 + 294,10 + 10) / 11k = R$27,65/k';
