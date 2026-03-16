/*
  # Corrigir tabela conta_familia_historico

  1. Problema
    - A função processar_transferencia_pessoas_destino tenta inserir em colunas que não existem
    - A tabela conta_familia_historico foi criada para histórico de remoções, não movimentações

  2. Solução
    - Remover os INSERTs problemáticos das funções
    - O histórico de movimentações já está sendo registrado em estoque_movimentacoes
*/

-- Remover o INSERT problemático da função processar_transferencia_pessoas_destino
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_destino()
RETURNS TRIGGER AS $$
DECLARE
  v_custo_final numeric;
  v_parceiro_nome text;
  v_programa_nome text;
  v_destino_programa_nome text;
BEGIN
  SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
  SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;
  SELECT nome INTO v_destino_programa_nome FROM programas_fidelidade WHERE id = NEW.destino_programa_id;

  v_custo_final := COALESCE(NEW.custo_transferencia, 0);

  -- 1. Registrar ENTRADA no estoque do DESTINO (pontos normais)
  INSERT INTO estoque_movimentacoes (
    parceiro_id,
    programa_id,
    tipo,
    quantidade,
    valor_total,
    origem,
    observacao,
    referencia_id,
    referencia_tabela
  ) VALUES (
    NEW.destino_parceiro_id,
    NEW.destino_programa_id,
    'entrada',
    NEW.quantidade,
    v_custo_final * NEW.quantidade,
    'transferencia_pessoas',
    format('Transferência recebida de %s (%s → %s)', 
      v_parceiro_nome,
      v_programa_nome,
      v_destino_programa_nome
    ),
    NEW.id,
    'transferencia_pessoas'
  );

  -- 2. Se houver bônus, registrar ENTRADA adicional de bônus
  IF NEW.bonus_destino > 0 THEN
    INSERT INTO estoque_movimentacoes (
      parceiro_id,
      programa_id,
      tipo,
      quantidade,
      valor_total,
      origem,
      observacao,
      referencia_id,
      referencia_tabela
    ) VALUES (
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      'entrada',
      NEW.bonus_destino,
      0,
      'transferencia_pessoas_bonus',
      format('Bônus de transferência recebido de %s (%s → %s)', 
        v_parceiro_nome,
        v_programa_nome,
        v_destino_programa_nome
      ),
      NEW.id,
      'transferencia_pessoas'
    );
  END IF;

  -- REMOVIDO: INSERT em conta_familia_historico
  -- O histórico já está sendo registrado em estoque_movimentacoes

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION processar_transferencia_pessoas_destino IS 
'Processa crédito de pontos no destino da transferência entre pessoas. Registra movimentações em estoque_movimentacoes.';
