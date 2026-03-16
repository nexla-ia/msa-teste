/*
  # Criar Trigger para Gerar Contas a Receber por Localizador

  1. Nova Função
    - `criar_contas_receber_localizador` - Gera contas a receber automaticamente ao criar localizador
    - Cria parcelas baseadas no campo `parcelas` do localizador
    - Cada parcela tem vencimento espaçado em 30 dias

  2. Trigger
    - Executado AFTER INSERT em localizadores
    - Gera as parcelas automaticamente

  3. Notas
    - Cada localizador pode ter suas próprias parcelas
    - Permite pagamentos independentes por localizador
    - Facilita conciliação de pagamentos
*/

-- Função para criar contas a receber do localizador
CREATE OR REPLACE FUNCTION criar_contas_receber_localizador()
RETURNS TRIGGER AS $$
DECLARE
  valor_parcela numeric;
  data_venc date;
  i integer;
BEGIN
  -- Só criar contas a receber se valor_total > 0
  IF NEW.valor_total > 0 AND NEW.parcelas > 0 THEN
    -- Calcular valor de cada parcela
    valor_parcela := NEW.valor_total / NEW.parcelas;
    
    -- Criar as contas a receber para cada parcela
    FOR i IN 1..NEW.parcelas LOOP
      -- Calcular data de vencimento (30 dias para cada parcela)
      data_venc := COALESCE(NEW.data_emissao, NEW.created_at::date) + (i * 30);
      
      INSERT INTO contas_receber (
        venda_id,
        localizador_id,
        numero_parcela,
        total_parcelas,
        valor_parcela,
        data_vencimento,
        status_pagamento,
        forma_pagamento
      ) VALUES (
        NEW.venda_id,
        NEW.id,
        i,
        NEW.parcelas,
        valor_parcela,
        data_venc,
        'pendente',
        NEW.forma_pagamento
      );
    END LOOP;
    
    -- Atualizar saldo restante do localizador
    UPDATE localizadores
    SET saldo_restante = NEW.valor_total
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para localizadores
DROP TRIGGER IF EXISTS trigger_criar_contas_receber_localizador ON localizadores;
CREATE TRIGGER trigger_criar_contas_receber_localizador
  AFTER INSERT ON localizadores
  FOR EACH ROW
  EXECUTE FUNCTION criar_contas_receber_localizador();

-- Função para atualizar saldo restante quando pagamento é feito
CREATE OR REPLACE FUNCTION atualizar_saldo_localizador()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar saldo restante e valor pago do localizador
  IF NEW.localizador_id IS NOT NULL THEN
    UPDATE localizadores
    SET 
      valor_pago = COALESCE((
        SELECT SUM(valor_pago)
        FROM contas_receber
        WHERE localizador_id = NEW.localizador_id
          AND status_pagamento = 'pago'
      ), 0),
      saldo_restante = valor_total - COALESCE((
        SELECT SUM(valor_pago)
        FROM contas_receber
        WHERE localizador_id = NEW.localizador_id
          AND status_pagamento = 'pago'
      ), 0),
      updated_at = now()
    WHERE id = NEW.localizador_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar saldo após pagamento
DROP TRIGGER IF EXISTS trigger_atualizar_saldo_localizador ON contas_receber;
CREATE TRIGGER trigger_atualizar_saldo_localizador
  AFTER UPDATE ON contas_receber
  FOR EACH ROW
  WHEN (OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento)
  EXECUTE FUNCTION atualizar_saldo_localizador();
