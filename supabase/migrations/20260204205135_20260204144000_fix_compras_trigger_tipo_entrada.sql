/*
  # Corrige Trigger de Compras - Tipo deve ser 'Entrada'

  ## Problema
  - O trigger de compras estava passando NEW.tipo (tipo da compra) para atualizar_estoque_pontos()
  - A função atualizar_estoque_pontos() só aceita 'Entrada' ou 'Saída'
  - Causava erro: "Tipo inválido: Ajuste de Milhas. Use 'Entrada' ou 'Saída'"

  ## Solução
  - Compras são sempre ENTRADAS de pontos
  - O trigger deve passar a string 'Entrada' em vez de NEW.tipo
  - NEW.tipo deve ser usado apenas para identificar o tipo de operação (Compra de Pontos, Ajuste de Saldo, etc)

  ## Alterações
  - Atualiza função trigger_atualizar_estoque_compras()
  - Passa 'Entrada' fixo como tipo de movimentação
*/

-- Corrige a função do trigger de compras
CREATE OR REPLACE FUNCTION trigger_atualizar_estoque_compras()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Para INSERT: só processa se status = Concluído
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Concluído' THEN
      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada',  -- Compras são sempre ENTRADAS
        COALESCE(NEW.valor_total, 0)
      );
    END IF;
    
  -- Para UPDATE: processa mudanças de status
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se mudou de Pendente para Concluído, adiciona pontos
    IF OLD.status = 'Pendente' AND NEW.status = 'Concluído' THEN
      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada',  -- Compras são sempre ENTRADAS
        COALESCE(NEW.valor_total, 0)
      );
    
    -- Se mudou de Concluído para Pendente, remove pontos
    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Pendente' THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        'Saída',  -- Reverter entrada é uma SAÍDA
        -COALESCE(OLD.valor_total, 0)
      );
    
    -- Se mudou valores mas manteve status Concluído
    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Concluído' THEN
      -- Remove pontos antigos
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        'Saída',  -- Reverter entrada é uma SAÍDA
        -COALESCE(OLD.valor_total, 0)
      );
      
      -- Adiciona pontos novos
      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id,
        NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada',  -- Compras são sempre ENTRADAS
        COALESCE(NEW.valor_total, 0)
      );
    END IF;
  
  -- Para DELETE: só remove se estava Concluído
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'Concluído' THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id,
        OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        'Saída',  -- Reverter entrada é uma SAÍDA
        -COALESCE(OLD.valor_total, 0)
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;