/*
  # Transferência automática para titular em todas as operações

  1. Descrição
    Implementa transferência automática de pontos para o titular da conta família
    em TODAS as operações que creditam pontos (não apenas clube):
    - Compra Bonificada
    - Compra de Pontos (via compras)
    - Transferência de Pontos
    - Transferência entre Pessoas

  2. Lógica
    Quando um parceiro CONVIDADO recebe pontos:
    - Pontos caem primeiro na conta do convidado (registra entrada)
    - Imediatamente transfere para o titular (registra saída + entrada)
    - Se for TITULAR ou NÃO ESTIVER em conta família: mantém os pontos

  3. Implementação
    - Cria trigger na tabela estoque_movimentacoes
    - Intercepta operações de entrada (exceto as transferências automáticas)
    - Verifica se é convidado e transfere automaticamente

  4. Segurança
    - Mantém RLS policies
    - Registra histórico completo
    - Evita loops infinitos (ignora transferências automáticas)
*/

-- ==================================================================
-- Função: processar_transferencia_automatica_titular
-- ==================================================================
CREATE OR REPLACE FUNCTION processar_transferencia_automatica_titular()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_titular RECORD;
  v_origem_info text;
  v_referencia_nome text;
BEGIN
  -- Só processa entradas (não saídas)
  IF NEW.tipo != 'Entrada' THEN
    RETURN NEW;
  END IF;

  -- Ignora transferências que já são automáticas para evitar loop
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

  -- Se não for convidado (eh_titular = true ou não tem conta família), não faz nada
  IF v_titular.eh_titular OR v_titular.conta_familia_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- É convidado: transferir automaticamente para o titular
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
    ELSE
      v_origem_info := NEW.origem;
  END CASE;

  -- Buscar nome da referência se existir
  IF NEW.referencia_tabela IS NOT NULL AND NEW.referencia_id IS NOT NULL THEN
    v_referencia_nome := ' (Ref: ' || NEW.referencia_tabela || ')';
  ELSE
    v_referencia_nome := '';
  END IF;

  -- Debitar do convidado (saída)
  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id,
    NEW.programa_id,
    NEW.quantidade,
    'Saída',
    0,
    'transferencia_automatica_para_titular',
    'Transferência automática para titular ' || v_titular.titular_nome || ' - ' || v_origem_info || v_referencia_nome,
    NEW.referencia_id,
    NEW.referencia_tabela
  );

  -- Creditar no titular (entrada)
  PERFORM atualizar_estoque_pontos(
    v_titular.titular_id,
    NEW.programa_id,
    NEW.quantidade,
    'Entrada',
    0,
    'transferencia_automatica_de_convidado',
    'Recebido de convidado ' || (SELECT nome_parceiro FROM parceiros WHERE id = NEW.parceiro_id) || ' - ' || v_origem_info || v_referencia_nome,
    NEW.referencia_id,
    NEW.referencia_tabela
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION processar_transferencia_automatica_titular() IS
'Trigger que intercepta todas as entradas de pontos e transfere automaticamente para o titular se o parceiro for convidado de uma conta família.';

-- ==================================================================
-- Criar trigger na tabela estoque_movimentacoes
-- ==================================================================
DROP TRIGGER IF EXISTS trigger_transferencia_automatica_titular ON estoque_movimentacoes;

CREATE TRIGGER trigger_transferencia_automatica_titular
  AFTER INSERT ON estoque_movimentacoes
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_automatica_titular();

COMMENT ON TRIGGER trigger_transferencia_automatica_titular ON estoque_movimentacoes IS
'Transfere automaticamente pontos de convidados para o titular da conta família após qualquer entrada de pontos.';

-- ==================================================================
-- Permissões
-- ==================================================================
GRANT EXECUTE ON FUNCTION processar_transferencia_automatica_titular() TO anon, authenticated;
