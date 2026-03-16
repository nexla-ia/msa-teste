/*
  # Corrigir transferência de pessoas DESTINO para usar atualizar_estoque_pontos()

  1. Problema
    - A função de destino estava fazendo UPDATE direto no estoque
    - Não usava a função padronizada para atualizar custo médio
    - Lógica duplicada e difícil de manter

  2. Correção
    - Usar `atualizar_estoque_pontos()` para creditar pontos normais
    - Usar `atualizar_estoque_pontos()` para creditar bônus (valor zero)
    - Remover UPDATE direto no estoque

  3. Vantagens
    - Código mais limpo e mantível
    - Histórico de movimentações consistente
    - Valor total calculado corretamente
*/

-- Corrigir função de destino para usar atualizar_estoque_pontos
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_destino()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_custo_medio numeric;
  v_origem_parceiro_nome text;
  v_valor_recebido numeric;
  v_custo_transferencia numeric;
  v_bonus_destino integer;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN

    -- Buscar custo médio da origem
    SELECT custo_medio INTO v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

    v_origem_custo_medio := COALESCE(v_origem_custo_medio, 0);

    -- Buscar nome do parceiro de origem
    SELECT nome_parceiro INTO v_origem_parceiro_nome
    FROM parceiros
    WHERE id = NEW.origem_parceiro_id;

    v_bonus_destino := COALESCE(NEW.bonus_destino, 0);

    -- Calcular valor dos pontos recebidos (baseado no custo da origem)
    v_valor_recebido := (NEW.quantidade * v_origem_custo_medio / 1000);

    -- Adicionar custo de transferência se houver (quem recebe paga)
    IF NEW.tem_custo = true THEN
      v_custo_transferencia := COALESCE(NEW.valor_custo, 0);
    ELSE
      v_custo_transferencia := 0;
    END IF;

    -- Creditar pontos normais usando atualizar_estoque_pontos
    PERFORM atualizar_estoque_pontos(
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      NEW.quantidade,
      'Entrada',
      v_valor_recebido + v_custo_transferencia, -- Valor dos pontos + taxa
      'transferencia_pessoas',
      'Recebido de ' || v_origem_parceiro_nome,
      NEW.id,
      'transferencia_pessoas'
    );

    -- Se houver bônus, creditar separadamente com valor ZERO
    IF v_bonus_destino > 0 THEN
      PERFORM atualizar_estoque_pontos(
        NEW.destino_parceiro_id,
        NEW.destino_programa_id,
        v_bonus_destino,
        'Entrada',
        0, -- Bônus não tem custo
        'transferencia_pessoas_bonus',
        'Bônus de transferência de ' || v_origem_parceiro_nome,
        NEW.id,
        'transferencia_pessoas'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_transferencia_pessoas_destino() IS 
'Credita pontos no destino usando atualizar_estoque_pontos(). 
Considera: custo da origem + taxa de transferência + bônus (custo zero).';
