/*
  # Corrigir trigger de transferência entre pessoas - remover custo_quantidade

  1. Problema
    - Trigger estava tentando acessar campo `custo_quantidade` que não existe
    - O custo da transferência é financeiro (valor_custo em R$), não em pontos
    - Não deve deduzir pontos extras do saldo quando há custo

  2. Correção
    - Remover lógica que tentava deduzir custo_quantidade
    - Transferir apenas a quantidade especificada em pontos
    - O valor_custo é apenas para controle financeiro
*/

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

    -- Verificar saldo suficiente (apenas a quantidade a ser transferida)
    IF v_origem_saldo < NEW.quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente no estoque de origem. Disponível: %, Necessário: %', 
        v_origem_saldo, NEW.quantidade;
    END IF;

    SELECT nome_parceiro INTO v_destino_parceiro_nome
    FROM parceiros
    WHERE id = NEW.destino_parceiro_id;

    -- USAR atualizar_estoque_pontos para fazer a SAÍDA corretamente
    -- Saída apenas da quantidade de pontos transferida (não inclui custo financeiro)
    PERFORM atualizar_estoque_pontos(
      NEW.origem_parceiro_id,
      NEW.programa_id,
      NEW.quantidade,
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
O valor_custo é apenas financeiro e não afeta o saldo de pontos.';
