/*
  # Atualizar Contas a Receber - Adicionar Transferências

  ## Descrição
  Atualiza o sistema de contas a receber para incluir também:
  - Transferências de pontos com pagamento (quando há custo_transferencia)
  - Transferências entre pessoas com pagamento (quando há custo/valor_custo)
  
  Esses são serviços prestados pela empresa onde ela cobra uma taxa, portanto são contas a RECEBER.

  ## Mudanças
  1. Adicionar coluna `origem_tipo` na tabela contas_receber para identificar a origem (venda, transferencia_pontos, transferencia_pessoas)
  2. Adicionar coluna `origem_id` para referenciar o ID da operação
  3. Criar triggers para registrar automaticamente contas a receber de transferências com custo
*/

-- Adicionar colunas na tabela contas_receber
DO $$
BEGIN
  -- Adicionar origem_tipo se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contas_receber' AND column_name = 'origem_tipo'
  ) THEN
    ALTER TABLE contas_receber 
    ADD COLUMN origem_tipo text CHECK (origem_tipo IN ('venda', 'transferencia_pontos', 'transferencia_pessoas', 'outro'));
  END IF;
  
  -- Adicionar origem_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contas_receber' AND column_name = 'origem_id'
  ) THEN
    ALTER TABLE contas_receber 
    ADD COLUMN origem_id uuid;
  END IF;
  
  -- Atualizar registros existentes para tipo 'venda'
  UPDATE contas_receber 
  SET origem_tipo = 'venda', 
      origem_id = venda_id
  WHERE origem_tipo IS NULL AND venda_id IS NOT NULL;
END $$;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_contas_receber_origem ON contas_receber(origem_tipo, origem_id);

-- ==========================================
-- TRIGGER PARA TRANSFERÊNCIA DE PONTOS
-- ==========================================
CREATE OR REPLACE FUNCTION registrar_conta_receber_transferencia_pontos()
RETURNS TRIGGER AS $$
DECLARE
  v_parceiro_nome text;
  v_origem_programa text;
  v_destino_programa text;
BEGIN
  -- Registra conta a receber se houver custo de transferência
  IF NEW.custo_transferencia IS NOT NULL 
     AND NEW.custo_transferencia > 0
     AND NEW.forma_pagamento_transferencia IS NOT NULL
     AND NEW.forma_pagamento_transferencia != 'Não registrar no fluxo de caixa' THEN
    
    -- Buscar nomes
    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_origem_programa FROM programas_fidelidade WHERE id = NEW.origem_programa_id;
    SELECT nome INTO v_destino_programa FROM programas_fidelidade WHERE id = NEW.destino_programa_id;
    
    -- Criar conta a receber (à vista, parcela única)
    INSERT INTO contas_receber (
      origem_tipo,
      origem_id,
      venda_id,
      localizador_id,
      data_vencimento,
      valor_parcela,
      numero_parcela,
      total_parcelas,
      forma_pagamento,
      cartao_id,
      conta_bancaria_id,
      status_pagamento,
      observacao
    ) VALUES (
      'transferencia_pontos',
      NEW.id,
      NULL,
      NULL,
      NEW.data_transferencia,
      NEW.custo_transferencia,
      1,
      1,
      NEW.forma_pagamento_transferencia,
      NEW.cartao_id,
      NEW.conta_bancaria_id,
      'pendente',
      format('Taxa de transferência - %s → %s - %s', v_origem_programa, v_destino_programa, v_parceiro_nome)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_registrar_conta_receber_transferencia_pontos ON transferencia_pontos;
CREATE TRIGGER trigger_registrar_conta_receber_transferencia_pontos
  AFTER INSERT ON transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_receber_transferencia_pontos();

-- ==========================================
-- TRIGGER PARA TRANSFERÊNCIA ENTRE PESSOAS
-- ==========================================
CREATE OR REPLACE FUNCTION registrar_conta_receber_transferencia_pessoas()
RETURNS TRIGGER AS $$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_origem_nome text;
  v_destino_nome text;
  v_programa_nome text;
BEGIN
  -- Registra contas a receber se houver custo
  IF NEW.tem_custo = true
     AND NEW.valor_custo IS NOT NULL 
     AND NEW.valor_custo > 0
     AND NEW.forma_pagamento IS NOT NULL
     AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa' THEN
    
    -- Buscar nomes
    SELECT nome_parceiro INTO v_origem_nome FROM parceiros WHERE id = NEW.origem_parceiro_id;
    SELECT nome_parceiro INTO v_destino_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
    SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;
    
    -- Calcular valor por parcela
    v_valor_parcela := NEW.valor_custo / COALESCE(NEW.parcelas, 1);
    
    -- Criar conta a receber para cada parcela
    FOR v_parcela IN 1..COALESCE(NEW.parcelas, 1) LOOP
      v_data_vencimento := NEW.data_transferencia + ((v_parcela - 1) * INTERVAL '1 month');
      
      INSERT INTO contas_receber (
        origem_tipo,
        origem_id,
        venda_id,
        localizador_id,
        data_vencimento,
        valor_parcela,
        numero_parcela,
        total_parcelas,
        forma_pagamento,
        cartao_id,
        conta_bancaria_id,
        status_pagamento,
        observacao
      ) VALUES (
        'transferencia_pessoas',
        NEW.id,
        NULL,
        NULL,
        v_data_vencimento,
        v_valor_parcela,
        v_parcela,
        COALESCE(NEW.parcelas, 1),
        NEW.forma_pagamento,
        NEW.cartao_id,
        NEW.conta_bancaria_id,
        'pendente',
        format('Taxa transferência entre pessoas - %s → %s - %s', v_origem_nome, v_destino_nome, v_programa_nome)
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_registrar_conta_receber_transferencia_pessoas ON transferencia_pessoas;
CREATE TRIGGER trigger_registrar_conta_receber_transferencia_pessoas
  AFTER INSERT ON transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_receber_transferencia_pessoas();

-- Atualizar comentários
COMMENT ON COLUMN contas_receber.origem_tipo IS 'Tipo da operação: venda, transferencia_pontos, transferencia_pessoas, outro';
COMMENT ON COLUMN contas_receber.origem_id IS 'ID do registro de origem';