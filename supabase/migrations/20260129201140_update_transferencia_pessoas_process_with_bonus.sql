/*
  # Atualizar processamento de transferência de pessoas com bônus

  1. Alterações
    - Atualiza função processar_transferencia_pessoas_destino para processar bônus
    - Registra movimentações separadas para pontos e bônus
    - Atualiza histórico da conta família com bônus

  2. Comportamento
    - Se bonus > 0, registra movimentação adicional de bônus
    - Destino recebe: quantidade + bonus_destino
    - Origem paga: quantidade (sem desconto de bônus)
    - Custo de transferência aplicado apenas nos pontos normais
*/

-- Recriar função para processar a transferência no destino com suporte a bônus
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_destino()
RETURNS TRIGGER AS $$
DECLARE
  v_custo_final numeric;
  v_parceiro_nome text;
  v_programa_nome text;
  v_destino_programa_nome text;
BEGIN
  -- Buscar nomes para histórico
  SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
  SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;
  SELECT nome INTO v_destino_programa_nome FROM programas_fidelidade WHERE id = NEW.destino_programa_id;

  -- Calcula custo final: custo_transferencia se houver, senão 0
  v_custo_final := COALESCE(NEW.custo_transferencia, 0);

  -- 1. Registrar ENTRADA no estoque do DESTINO (pontos normais)
  INSERT INTO estoque_movimentacoes (
    parceiro_id,
    programa_id,
    tipo_movimentacao,
    quantidade,
    custo_unitario,
    custo_total,
    referencia_id,
    referencia_tabela,
    observacao
  ) VALUES (
    NEW.destino_parceiro_id,
    NEW.destino_programa_id,
    'entrada',
    NEW.quantidade,
    v_custo_final,
    v_custo_final * NEW.quantidade,
    NEW.id,
    'transferencia_pessoas',
    format('Transferência recebida de %s (%s → %s)', 
      v_parceiro_nome,
      v_programa_nome,
      v_destino_programa_nome
    )
  );

  -- 2. Se houver bônus, registrar ENTRADA adicional de bônus
  IF NEW.bonus_destino > 0 THEN
    INSERT INTO estoque_movimentacoes (
      parceiro_id,
      programa_id,
      tipo_movimentacao,
      quantidade,
      custo_unitario,
      custo_total,
      referencia_id,
      referencia_tabela,
      observacao
    ) VALUES (
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      'entrada',
      NEW.bonus_destino,
      0, -- Bônus tem custo zero
      0,
      NEW.id,
      'transferencia_pessoas',
      format('Bônus de transferência recebido de %s (%s → %s)', 
        v_parceiro_nome,
        v_programa_nome,
        v_destino_programa_nome
      )
    );
  END IF;

  -- 3. Registrar no histórico da conta família do DESTINO
  INSERT INTO conta_familia_historico (
    parceiro_id,
    programa_id,
    tipo_movimentacao,
    quantidade,
    quantidade_bonus,
    saldo_antes,
    saldo_depois,
    observacao
  )
  SELECT 
    NEW.destino_parceiro_id,
    NEW.destino_programa_id,
    'transferencia_recebida',
    NEW.quantidade,
    NEW.bonus_destino,
    COALESCE(ep.saldo_atual, 0),
    COALESCE(ep.saldo_atual, 0) + NEW.quantidade + NEW.bonus_destino,
    format('Transferência recebida de %s', v_parceiro_nome)
  FROM estoque_pontos ep
  WHERE ep.parceiro_id = NEW.destino_parceiro_id
    AND ep.programa_id = NEW.destino_programa_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_processar_transferencia_pessoas_destino ON transferencia_pessoas;
CREATE TRIGGER trigger_processar_transferencia_pessoas_destino
  AFTER INSERT OR UPDATE OF status
  ON transferencia_pessoas
  FOR EACH ROW
  WHEN (NEW.status = 'concluído')
  EXECUTE FUNCTION processar_transferencia_pessoas_destino();
