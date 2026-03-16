/*
  # Corrigir trigger de exclusão de compra bonificada

  ## Problema
  Ao deletar uma compra bonificada, o trigger estava chamando `atualizar_estoque_pontos`
  com quantidade negativa e tipo 'Entrada', causando violação da constraint que exige
  quantidade > 0 nas movimentações.

  ## Solução
  1. Atualizar a função do trigger para usar todos os 9 parâmetros da função atualizar_estoque_pontos
  2. Para DELETE: usar tipo 'Saída' com quantidade positiva para reverter a entrada original
  3. Para UPDATE: reverter a entrada antiga com 'Saída' e criar nova entrada

  ## Mudanças
  - Atualiza `trigger_atualizar_estoque_compra_bonificada()` para registrar movimentações corretamente
  - INSERT: Entrada com valor positivo
  - UPDATE: Saída (reverter antiga) + Entrada (nova)
  - DELETE: Saída com valor positivo para reverter
*/

CREATE OR REPLACE FUNCTION trigger_atualizar_estoque_compra_bonificada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Criar entrada no estoque
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      COALESCE(NEW.quantidade_pontos, 0),
      'Entrada',
      COALESCE(NEW.custo_total, 0),
      'compra_bonificada',
      'Compra bonificada: ' || COALESCE(NEW.produto, ''),
      NEW.id,
      'compra_bonificada'
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverter entrada antiga com SAÍDA
    IF OLD.quantidade_pontos > 0 THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        COALESCE(OLD.quantidade_pontos, 0),
        'Saída',
        0,
        'ajuste_compra_bonificada',
        'Reversão por atualização de compra bonificada',
        OLD.id,
        'compra_bonificada'
      );
    END IF;
    
    -- Criar nova entrada
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      COALESCE(NEW.quantidade_pontos, 0),
      'Entrada',
      COALESCE(NEW.custo_total, 0),
      'compra_bonificada',
      'Compra bonificada: ' || COALESCE(NEW.produto, ''),
      NEW.id,
      'compra_bonificada'
    );
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverter entrada com SAÍDA (quantidade positiva)
    IF OLD.quantidade_pontos > 0 THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        COALESCE(OLD.quantidade_pontos, 0),
        'Saída',
        0,
        'exclusao_compra_bonificada',
        'Reversão por exclusão de compra bonificada: ' || COALESCE(OLD.produto, ''),
        OLD.id,
        'compra_bonificada'
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;