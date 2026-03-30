/*
  # Fix observacao Compra no Carrinho no histórico de movimentações

  Quando a transferência é do tipo "Compra no Carrinho", a observação registrada
  no estoque_movimentacoes deve ser "Compra no Carrinho" em vez de
  "Recebimento de [origem]", para diferenciar no histórico.
*/

CREATE OR REPLACE FUNCTION processar_transferencia_destino()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_custo_medio   decimal;
  v_valor_destino        decimal;
  v_origem_programa_nome text;
  v_observacao_destino   text;
BEGIN
  -- Buscar custo médio da origem (usado apenas em transferência normal)
  SELECT custo_medio INTO v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.origem_programa_id;

  -- Buscar nome do programa de origem para rastreabilidade
  SELECT nome INTO v_origem_programa_nome
  FROM programas_fidelidade
  WHERE id = NEW.origem_programa_id;

  -- Definir valor e observação conforme tipo
  IF NEW.realizar_compra_carrinho = true THEN
    v_valor_destino      := COALESCE(NEW.compra_valor_total, 0);
    v_observacao_destino := 'Compra no Carrinho';
  ELSE
    v_valor_destino      := (NEW.destino_quantidade / 1000.0) * COALESCE(v_origem_custo_medio, 0);
    v_observacao_destino := 'Recebimento de ' || COALESCE(v_origem_programa_nome, 'origem');
  END IF;

  -- INSERT com status Concluído: creditar pontos principais
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      v_valor_destino,
      'Transferência de Pontos',
      v_observacao_destino,
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- INSERT com bônus destino Concluído
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_bonus'
    );
  END IF;

  -- INSERT com bônus bumerangue Concluído
  IF (TG_OP = 'INSERT' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.origem_programa_id,
      NEW.bumerangue_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus bumerangue',
      NEW.id,
      'transferencia_pontos',
      'bumerangue_retorno'
    );
  END IF;

  -- UPDATE de Pendente para Concluído: creditar pontos principais
  IF (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade,
      'Entrada',
      v_valor_destino,
      'Transferência de Pontos',
      v_observacao_destino,
      NEW.id,
      'transferencia_pontos',
      'transferencia_entrada'
    );
  END IF;

  -- UPDATE de status_bonus_destino de Pendente para Concluído
  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_destino = 'Pendente' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.destino_programa_id,
      NEW.destino_quantidade_bonus,
      'Entrada',
      0,
      'Transferência de Pontos',
      'Bônus de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id,
      'transferencia_pontos',
      'transferencia_bonus'
    );
  END IF;

  RETURN NEW;
END;
$$;
