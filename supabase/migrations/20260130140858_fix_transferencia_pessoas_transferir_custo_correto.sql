/*
  # Corrigir transferência de custo entre pessoas
  
  1. Problema
    - A função atual trata pontos recebidos como custo ZERO
    - Isso está ERRADO: o custo deve ser transferido junto com os pontos
    
  2. Lógica Correta
    - Quando Paulo transfere 10.000 pontos a R$ 29,41/k para Davi:
      * Paulo PERDE: 10.000 pontos E o custo proporcional (10k x R$ 29,41 = R$ 294,10)
      * Davi GANHA: 10.000 pontos E o custo proporcional (R$ 294,10)
    - É um débito e crédito contábil: o custo passa de uma conta para outra
    
  3. Custo de Transferência
    - Se houver custo adicional de transferência (taxa), quem paga é o DESTINO
    - Este custo ADICIONA ao custo médio do destino
    
  4. Fórmula do Novo Custo Médio
    - Sem custo de transferência:
      novo_custo = (saldo_antigo * custo_antigo + quantidade * custo_origem) / saldo_novo
    - Com custo de transferência:
      novo_custo = (saldo_antigo * custo_antigo + quantidade * custo_origem + custo_transferencia) / saldo_novo
*/

-- Função auxiliar para calcular custo total em reais (não por milheiro)
CREATE OR REPLACE FUNCTION calcular_custo_total_reais(
  p_quantidade numeric,
  p_custo_milheiro numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
BEGIN
  -- Custo total = (quantidade / 1000) * custo_por_milheiro
  RETURN (p_quantidade / 1000.0) * p_custo_milheiro;
END;
$$;

-- Recriar função de origem para debitar corretamente
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_estoque_id uuid;
  v_origem_saldo numeric;
  v_origem_custo_medio numeric;
  v_destino_parceiro_nome text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    
    SELECT id, saldo_atual, custo_medio 
    INTO v_origem_estoque_id, v_origem_saldo, v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;
    
    IF v_origem_estoque_id IS NULL THEN
      RAISE EXCEPTION 'Estoque de origem não encontrado';
    END IF;
    
    IF v_origem_saldo < NEW.quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente no estoque de origem. Disponível: %, Necessário: %', v_origem_saldo, NEW.quantidade;
    END IF;
    
    SELECT nome_parceiro INTO v_destino_parceiro_nome
    FROM parceiros
    WHERE id = NEW.destino_parceiro_id;
    
    -- Registrar saída (débito)
    PERFORM registrar_movimentacao_transferencia_pessoas(
      NEW.origem_parceiro_id,
      NEW.programa_id,
      'saida',
      NEW.quantidade,
      v_origem_custo_medio, -- Custo que está saindo
      v_destino_parceiro_nome,
      NEW.id
    );
    
    -- Debitar do estoque de origem
    UPDATE estoque_pontos
    SET saldo_atual = saldo_atual - NEW.quantidade,
        updated_at = now()
    WHERE id = v_origem_estoque_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar função de destino para creditar COM o custo transferido
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
    
    -- Calcular novo saldo
    v_novo_saldo_destino := v_destino_saldo + NEW.quantidade;
    
    -- Calcular novo custo médio
    IF v_novo_saldo_destino > 0 THEN
      -- Custo total antigo em reais
      v_custo_total_antigo_reais := calcular_custo_total_reais(v_destino_saldo, v_destino_custo_medio);
      
      -- Custo dos pontos recebidos em reais (vem da origem)
      v_custo_total_origem_reais := calcular_custo_total_reais(NEW.quantidade, v_origem_custo_medio);
      
      -- Custo de transferência (se houver)
      v_custo_transferencia_reais := COALESCE(NEW.custo_transferencia, 0);
      
      -- Custo total novo em reais
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
    
    -- Registrar movimentação de entrada (crédito)
    PERFORM registrar_movimentacao_transferencia_pessoas(
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      'entrada',
      NEW.quantidade,
      v_novo_custo_medio, -- Novo custo médio após receber
      v_origem_parceiro_nome,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calcular_custo_total_reais(numeric, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION processar_transferencia_pessoas_origem() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION processar_transferencia_pessoas_destino() TO anon, authenticated;

COMMENT ON FUNCTION calcular_custo_total_reais(numeric, numeric) IS 
'Calcula o custo total em reais a partir de quantidade de pontos e custo por milheiro';

COMMENT ON FUNCTION processar_transferencia_pessoas_origem() IS 
'Debita pontos e custo proporcional da origem. O custo sai junto com os pontos.';

COMMENT ON FUNCTION processar_transferencia_pessoas_destino() IS 
'Credita pontos no destino COM o custo transferido da origem. Se houver custo de transferência, ele é adicionado ao custo total e assumido pelo destino. Fórmula: novo_custo_medio = (custo_antigo + custo_transferido + taxa_transferencia) / saldo_novo';
