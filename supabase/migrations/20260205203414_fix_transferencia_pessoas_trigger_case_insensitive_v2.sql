/*
  # Corrigir triggers de transferência entre pessoas - case insensitive

  1. Problema
    - Triggers verificam status = 'concluído' (minúsculo)
    - Mas o status real é 'Concluído' (maiúsculo)
    - Triggers não estão disparando devido à comparação case-sensitive

  2. Correção
    - Alterar triggers para usar LOWER() na comparação
    - Processar manualmente transferências pendentes
*/

-- Recriar trigger de origem com comparação case-insensitive
DROP TRIGGER IF EXISTS trigger_transferencia_pessoas_debitar_origem ON transferencia_pessoas;

CREATE TRIGGER trigger_transferencia_pessoas_debitar_origem
  AFTER INSERT OR UPDATE OF status
  ON transferencia_pessoas
  FOR EACH ROW
  WHEN (LOWER(NEW.status) = 'concluído')
  EXECUTE FUNCTION processar_transferencia_pessoas_origem();

-- Recriar trigger de destino com comparação case-insensitive  
DROP TRIGGER IF EXISTS trigger_processar_transferencia_pessoas_destino ON transferencia_pessoas;

CREATE TRIGGER trigger_processar_transferencia_pessoas_destino
  AFTER INSERT OR UPDATE OF status
  ON transferencia_pessoas
  FOR EACH ROW
  WHEN (LOWER(NEW.status) = 'concluído')
  EXECUTE FUNCTION processar_transferencia_pessoas_destino();

-- Processar manualmente a transferência que não foi processada
-- Buscar transferências com status 'Concluído' que não têm entrada correspondente no destino
DO $$
DECLARE
  v_transferencia record;
  v_origem_custo_medio numeric;
  v_origem_parceiro_nome text;
  v_valor_recebido numeric;
  v_custo_transferencia numeric;
  v_destino_movimentacao_exists boolean;
BEGIN
  FOR v_transferencia IN 
    SELECT tp.*
    FROM transferencia_pessoas tp
    WHERE tp.status = 'Concluído'
      AND tp.created_at > NOW() - INTERVAL '1 hour' -- Apenas última hora
  LOOP
    -- Verificar se já existe movimentação de entrada no destino
    SELECT EXISTS(
      SELECT 1 FROM estoque_movimentacoes
      WHERE parceiro_id = v_transferencia.destino_parceiro_id
        AND programa_id = v_transferencia.destino_programa_id
        AND tipo = 'Entrada'
        AND origem = 'transferencia_pessoas'
        AND referencia_id = v_transferencia.id
    ) INTO v_destino_movimentacao_exists;

    -- Se não existe, processar
    IF NOT v_destino_movimentacao_exists THEN
      -- Buscar custo médio da origem
      SELECT custo_medio INTO v_origem_custo_medio
      FROM estoque_pontos
      WHERE parceiro_id = v_transferencia.origem_parceiro_id 
        AND programa_id = v_transferencia.programa_id;

      v_origem_custo_medio := COALESCE(v_origem_custo_medio, 0);

      -- Buscar nome do parceiro de origem
      SELECT nome_parceiro INTO v_origem_parceiro_nome
      FROM parceiros
      WHERE id = v_transferencia.origem_parceiro_id;

      -- Calcular valor dos pontos recebidos
      v_valor_recebido := (v_transferencia.quantidade * v_origem_custo_medio / 1000);

      -- Adicionar custo de transferência se houver
      IF v_transferencia.tem_custo = true THEN
        v_custo_transferencia := COALESCE(v_transferencia.valor_custo, 0);
      ELSE
        v_custo_transferencia := 0;
      END IF;

      -- Creditar pontos normais
      PERFORM atualizar_estoque_pontos(
        v_transferencia.destino_parceiro_id,
        v_transferencia.destino_programa_id,
        v_transferencia.quantidade,
        'Entrada',
        v_valor_recebido + v_custo_transferencia,
        'transferencia_pessoas',
        'Recebido de ' || v_origem_parceiro_nome,
        v_transferencia.id,
        'transferencia_pessoas'
      );

      -- Se houver bônus, creditar separadamente
      IF COALESCE(v_transferencia.bonus_destino, 0) > 0 THEN
        PERFORM atualizar_estoque_pontos(
          v_transferencia.destino_parceiro_id,
          v_transferencia.destino_programa_id,
          v_transferencia.bonus_destino,
          'Entrada',
          0,
          'transferencia_pessoas_bonus',
          'Bônus de transferência de ' || v_origem_parceiro_nome,
          v_transferencia.id,
          'transferencia_pessoas'
        );
      END IF;

      RAISE NOTICE 'Processado destino da transferência %', v_transferencia.id;
    END IF;
  END LOOP;
END $$;
