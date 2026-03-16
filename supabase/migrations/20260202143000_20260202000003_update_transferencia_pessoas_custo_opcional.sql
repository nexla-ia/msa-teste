/*
  # Atualizar função de transferência para usar custo opcional

  1. Changes
    - Renomeia custo_transferencia para valor_custo (já existe o campo)
    - A função agora usa tem_custo para determinar se aplica o custo
    - Se tem_custo = false, não adiciona nenhum custo ao destino
    - Se tem_custo = true, adiciona valor_custo ao custo médio do destino

  2. Logic
    - Pontos transferidos: levam o custo médio da origem
    - Custo da transferência (se tem_custo = true): valor_custo é adicionado ao destino
    - Bônus recebido: tem custo ZERO (gratuito)
*/

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
    -- Fórmula: (saldo_antigo * custo_antigo + quantidade * custo_origem + taxa_opcional + bonus * 0) / saldo_novo
    IF v_novo_saldo_destino > 0 THEN
      -- Custo total antigo em reais
      v_custo_total_antigo_reais := calcular_custo_total_reais(v_destino_saldo, v_destino_custo_medio);
      
      -- Custo dos pontos recebidos em reais (vem da origem)
      v_custo_total_origem_reais := calcular_custo_total_reais(NEW.quantidade, v_origem_custo_medio);
      
      -- Custo de transferência (se tem_custo = true) - quem recebe paga
      IF NEW.tem_custo = true THEN
        v_custo_transferencia_reais := COALESCE(NEW.valor_custo, 0);
      ELSE
        v_custo_transferencia_reais := 0;
      END IF;
      
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
'Credita pontos no destino COM o custo transferido da origem. 
Se tem_custo = true, adiciona valor_custo ao custo médio do destino.
Bônus é creditado com custo ZERO. 
Fórmula: novo_custo = (custo_antigo + custo_transferido + taxa_opcional) / (saldo_novo incluindo bônus)';