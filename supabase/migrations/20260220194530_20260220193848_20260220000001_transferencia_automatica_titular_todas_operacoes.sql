/*
  # Corrigir trigger de transferência automática para titular

  1. Problema
    - O trigger verificava NEW.tipo != 'Entrada' (maiúsculo)
    - Mas atualizar_estoque_pontos salva tipo como 'entrada' (minúsculo)
    - Resultado: o trigger nunca processava nenhuma movimentação

  2. Correção
    - Comparar tipo em minúsculo: NEW.tipo != 'entrada'
    - Incluir 'transferencia_entrada' como tipo válido para entrada
    - Verificar origens ignoradas também em minúsculo
*/

CREATE OR REPLACE FUNCTION processar_transferencia_automatica_titular()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_titular RECORD;
  v_origem_info text;
BEGIN
  -- Só processa entradas (tipo salvo em minúsculo pela atualizar_estoque_pontos)
  IF NEW.tipo NOT IN ('entrada', 'transferencia_entrada') THEN
    RETURN NEW;
  END IF;

  -- Ignora transferências automáticas para evitar loop
  IF NEW.origem IN (
    'transferencia_clube_para_titular',
    'transferencia_clube_de_convidado',
    'transferencia_automatica_para_titular',
    'transferencia_automatica_de_convidado'
  ) THEN
    RETURN NEW;
  END IF;

  -- Verifica se o parceiro é convidado de uma conta família
  SELECT * INTO v_titular
  FROM obter_titular_conta_familia(NEW.parceiro_id, NEW.programa_id);

  -- Se não for convidado ou não tiver conta família, não faz nada
  IF v_titular.eh_titular OR v_titular.conta_familia_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Montar descrição baseada na origem
  CASE NEW.origem
    WHEN 'compra_bonificada' THEN
      v_origem_info := 'Compra Bonificada';
    WHEN 'compra' THEN
      v_origem_info := 'Compra de Pontos';
    WHEN 'transferencia_pontos' THEN
      v_origem_info := 'Transferência de Pontos';
    WHEN 'transferencia_pessoas' THEN
      v_origem_info := 'Transferência entre Pessoas';
    WHEN 'clube_credito_mensal' THEN
      v_origem_info := 'Crédito Mensal de Clube';
    WHEN 'clube_credito_retroativo' THEN
      v_origem_info := 'Crédito Retroativo de Clube';
    WHEN 'clube_credito_manual' THEN
      v_origem_info := 'Crédito Manual de Clube';
    WHEN 'clube_credito_bonus' THEN
      v_origem_info := 'Bônus de Clube';
    ELSE
      v_origem_info := COALESCE(NEW.origem, 'Operação');
  END CASE;

  -- Debitar do convidado (saída)
  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.programa_id,
    NEW.quantidade,
    'Saída',
    0,
    'transferencia_automatica_para_titular',
    'Transferência automática para titular ' || v_titular.titular_nome || ' - ' || v_origem_info,
    NEW.referencia_id,
    NEW.referencia_tabela
  );

  -- Creditar no titular (entrada com custo zero)
  PERFORM atualizar_estoque_pontos(
    v_titular.titular_id,
    NEW.programa_id,
    NEW.quantidade,
    'Entrada',
    0,
    'transferencia_automatica_de_convidado',
    'Recebido de convidado ' || (SELECT nome_parceiro FROM parceiros WHERE id = NEW.parceiro_id) || ' - ' || v_origem_info,
    NEW.referencia_id,
    NEW.referencia_tabela
  );

  RETURN NEW;
END;
$$;
