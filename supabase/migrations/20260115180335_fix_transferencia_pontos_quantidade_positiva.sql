/*
  # Corrigir função transferência pontos para usar quantidade positiva

  1. Problema
    - A função `processar_transferencia_origem()` passa quantidade negativa
      para `atualizar_estoque_pontos`, mas a função espera quantidade positiva
    - Isso causa erro na constraint de quantidade > 0 em estoque_movimentacoes

  2. Correção
    - Passar quantidade positiva (NEW.origem_quantidade ao invés de -NEW.origem_quantidade)
    - A função `atualizar_estoque_pontos` já trata o tipo 'Saída' corretamente
*/

-- Corrigir função de origem para passar quantidade positiva
CREATE OR REPLACE FUNCTION processar_transferencia_origem()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Debita da origem - passa quantidade positiva pois o tipo 'Saída' já indica débito
  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.origem_programa_id,
    NEW.origem_quantidade,
    'Saída',
    0
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_transferencia_origem() IS
'Debita pontos da origem imediatamente - usa quantidade positiva pois o tipo Saída já indica débito';
