/*
  # Corrigir estoques de transferências entre pessoas com programa incorreto

  1. Problema
    - 4 transferências creditaram pontos no programa errado do parceiro destino
    - Transferências LATAM → LIVELO/Smiles creditaram em LATAM ao invés do destino correto
    
  2. Correção
    - Para cada transferência incorreta:
      a) Remover pontos do programa errado no destino (reverter entrada incorreta)
      b) Adicionar pontos no programa correto no destino
      c) Atualizar movimentações no histórico
    
  3. Transferências afetadas
    - 420aa046-439c-43c0-939b-afe6c89feab5: Alisson (LATAM) → teste upload (LIVELO) - 750
    - 764baf9e-00fc-4c0c-b6b6-d15f68cad819: Alisson (LATAM) → Juliano (Smiles) - 1000
    - c635acf2-6b98-4ab0-8a02-7f880bc28e49: Alisson (LATAM) → Juliano (Smiles) - 1000
    - 85a9660d-5b6c-418f-81f3-2fc165445fe6: Alisson (LATAM) → Juliano (Smiles) - 5000
*/

DO $$
DECLARE
  v_transferencia record;
  v_origem_custo_medio numeric;
  v_destino_estoque_id uuid;
  v_destino_saldo numeric;
  v_destino_custo_medio numeric;
  v_novo_saldo numeric;
  v_novo_custo_medio numeric;
  v_origem_parceiro_nome text;
BEGIN
  -- Loop através das transferências incorretas
  FOR v_transferencia IN 
    SELECT 
      tp.id,
      tp.origem_parceiro_id,
      tp.destino_parceiro_id,
      tp.programa_id,
      tp.destino_programa_id,
      tp.quantidade,
      po.nome_parceiro as origem_nome
    FROM transferencia_pessoas tp
    JOIN parceiros po ON tp.origem_parceiro_id = po.id
    WHERE tp.programa_id != tp.destino_programa_id
      AND tp.status = 'Concluído'
  LOOP
    -- 1. REVERTER entrada no programa errado (programa_id)
    -- Remover pontos que foram adicionados incorretamente
    UPDATE estoque_pontos
    SET saldo_atual = saldo_atual - v_transferencia.quantidade,
        updated_at = now()
    WHERE parceiro_id = v_transferencia.destino_parceiro_id 
      AND programa_id = v_transferencia.programa_id
      AND saldo_atual >= v_transferencia.quantidade;
    
    -- Deletar movimentações incorretas de entrada
    DELETE FROM estoque_movimentacoes
    WHERE referencia_tabela = 'transferencia_pessoas'
      AND referencia_id = v_transferencia.id
      AND parceiro_id = v_transferencia.destino_parceiro_id
      AND programa_id = v_transferencia.programa_id
      AND tipo = 'transferencia_pessoas_entrada';
    
    -- 2. ADICIONAR entrada no programa correto (destino_programa_id)
    
    -- Buscar custo médio da origem
    SELECT custo_medio INTO v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = v_transferencia.origem_parceiro_id 
      AND programa_id = v_transferencia.programa_id;
    
    -- Buscar ou criar estoque do destino no programa correto
    SELECT id, saldo_atual, custo_medio 
    INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = v_transferencia.destino_parceiro_id 
      AND programa_id = v_transferencia.destino_programa_id;
    
    IF v_destino_estoque_id IS NULL THEN
      INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
      VALUES (v_transferencia.destino_parceiro_id, v_transferencia.destino_programa_id, 0, 0)
      RETURNING id, saldo_atual, custo_medio 
      INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio;
    END IF;
    
    -- Calcular novo saldo e custo médio
    v_novo_saldo := v_destino_saldo + v_transferencia.quantidade;
    IF v_novo_saldo > 0 THEN
      v_novo_custo_medio := ((v_destino_saldo * v_destino_custo_medio) + 
                              (v_transferencia.quantidade * COALESCE(v_origem_custo_medio, 0))) / v_novo_saldo;
    ELSE
      v_novo_custo_medio := 0;
    END IF;
    
    -- Atualizar estoque do destino no programa correto
    UPDATE estoque_pontos
    SET saldo_atual = v_novo_saldo,
        custo_medio = v_novo_custo_medio,
        updated_at = now()
    WHERE id = v_destino_estoque_id;
    
    -- Registrar movimentação correta no histórico
    PERFORM registrar_movimentacao_transferencia_pessoas(
      v_transferencia.destino_parceiro_id,
      v_transferencia.destino_programa_id,
      'entrada',
      v_transferencia.quantidade,
      0,
      v_transferencia.origem_nome,
      v_transferencia.id
    );
    
    RAISE NOTICE 'Corrigida transferência % - moveu % pontos do programa % para programa %',
      v_transferencia.id, 
      v_transferencia.quantidade,
      v_transferencia.programa_id,
      v_transferencia.destino_programa_id;
  END LOOP;
END $$;
