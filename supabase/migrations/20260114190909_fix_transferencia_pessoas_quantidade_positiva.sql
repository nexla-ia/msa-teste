/*
  # Corrigir função transferência pessoas para usar quantidade positiva

  1. Problema
    - A função `processar_transferencia_pessoas_origem` passa quantidade negativa 
      para `atualizar_estoque_pontos`, mas a função espera quantidade positiva
    - Isso causa erro na constraint de quantidade > 0 em estoque_movimentacoes
    
  2. Correção
    - Passar quantidade positiva (NEW.quantidade ao invés de -NEW.quantidade)
    - A função `atualizar_estoque_pontos` já trata o tipo 'Saída' corretamente
*/

-- Corrigir função de origem para passar quantidade positiva
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_origem_saldo numeric;
  v_destino_parceiro_nome text;
BEGIN
  SELECT saldo_atual INTO v_origem_saldo
  FROM estoque_pontos
  WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;
  
  IF v_origem_saldo < NEW.quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no estoque de origem';
  END IF;
  
  SELECT nome_parceiro INTO v_destino_parceiro_nome
  FROM parceiros
  WHERE id = NEW.destino_parceiro_id;
  
  PERFORM atualizar_estoque_pontos(
    NEW.origem_parceiro_id,
    NEW.programa_id,
    NEW.quantidade,
    'Saída',
    0
  );
  
  PERFORM registrar_movimentacao_transferencia_pessoas(
    NEW.origem_parceiro_id,
    NEW.programa_id,
    'saida',
    NEW.quantidade,
    NEW.custo_transferencia,
    v_destino_parceiro_nome,
    NEW.id
  );
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_transferencia_pessoas_origem() IS 
'Debita pontos da origem imediatamente - usa quantidade positiva pois o tipo Saída já indica débito';
