/*
  # Corrigir transferência de pessoas para usar atualizar_estoque_pontos()

  1. Problema
    - As funções de transferência entre pessoas estavam fazendo UPDATE direto no estoque
    - Isso não calculava nem subtraía o valor_total corretamente nas saídas
    - A integridade do custo médio era comprometida

  2. Correção
    - Modificar `processar_transferencia_pessoas_origem()` para usar atualizar_estoque_pontos()
    - Remover manipulação direta do estoque (UPDATE)
    - Garantir que valor seja calculado e subtraído corretamente na saída

  3. Impacto
    - Transferências entre pessoas agora mantêm integridade do valor_total
    - Histórico de movimentações registra valor correto da saída
    - Custo médio é mantido corretamente na origem
*/

-- Corrigir função de origem para usar atualizar_estoque_pontos
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_origem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_estoque_id uuid;
  v_origem_saldo numeric;
  v_origem_custo_medio numeric;
  v_destino_parceiro_nome text;
  v_quantidade_total_saida numeric;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN

    -- Verificar estoque de origem
    SELECT id, saldo_atual, custo_medio 
    INTO v_origem_estoque_id, v_origem_saldo, v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

    IF v_origem_estoque_id IS NULL THEN
      RAISE EXCEPTION 'Estoque de origem não encontrado';
    END IF;

    -- Calcular quantidade total de saída (quantidade + custo se houver)
    v_quantidade_total_saida := NEW.quantidade;
    IF NEW.tem_custo = true AND COALESCE(NEW.custo_quantidade, 0) > 0 THEN
      v_quantidade_total_saida := v_quantidade_total_saida + NEW.custo_quantidade;
    END IF;

    -- Verificar saldo suficiente
    IF v_origem_saldo < v_quantidade_total_saida THEN
      RAISE EXCEPTION 'Saldo insuficiente no estoque de origem. Disponível: %, Necessário: %', 
        v_origem_saldo, v_quantidade_total_saida;
    END IF;

    SELECT nome_parceiro INTO v_destino_parceiro_nome
    FROM parceiros
    WHERE id = NEW.destino_parceiro_id;

    -- USAR atualizar_estoque_pontos para fazer a SAÍDA corretamente
    PERFORM atualizar_estoque_pontos(
      NEW.origem_parceiro_id,
      NEW.programa_id,
      v_quantidade_total_saida,
      'Saída',
      0, -- Saída não passa valor, é calculado internamente
      'transferencia_pessoas',
      'Transferência para ' || v_destino_parceiro_nome,
      NEW.id,
      'transferencia_pessoas'
    );

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_transferencia_pessoas_origem() IS 
'Debita pontos da origem usando atualizar_estoque_pontos(). 
Calcula e subtrai o valor correto (quantidade × custo_medio).';
