/*
  # Descontar CPF disponível ao registrar venda

  ## Descrição
  Ao emitir uma venda para um parceiro/programa, o sistema deve decrementar
  automaticamente o contador de CPFs disponíveis na tabela
  `parceiro_programa_cpfs_controle`.

  ## Alterações

  ### Função `processar_venda` (trigger BEFORE INSERT em vendas)
  - Após processar a baixa de estoque, incrementa `cpfs_emitidos` na tabela
    `parceiro_programa_cpfs_controle` para o parceiro/programa/ano vigente.
  - Se não existir registro para o ano, cria um novo com cpfs_emitidos = 1.

  ### Função `reverter_venda` (trigger AFTER UPDATE em vendas)
  - Ao cancelar uma venda (status → 'cancelada'), decrementa `cpfs_emitidos`
    para o parceiro/programa/ano da data original da venda, mantendo o mínimo de 0.

  ### Função `decrementar_cpf_venda_deletada` (nova, trigger BEFORE DELETE em vendas)
  - Quando um admin deleta uma venda, decrementa `cpfs_emitidos` correspondente.

  ## Notas
  - Apenas vendas com status 'concluida' afetam o contador de CPFs.
  - O ano usado é o ano da `data_venda`.
  - Se o limite for 0 ou NULL (ilimitado), o contador ainda é incrementado para
    fins de rastreamento, mas cpfs_disponiveis retorna 999999.
*/

-- Atualizar processar_venda para incluir desconto de CPF
CREATE OR REPLACE FUNCTION public.processar_venda()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_saldo_atual numeric;
  v_custo_medio numeric;
  v_cmv numeric;
  v_ano integer;
BEGIN
  -- Buscar saldo atual e custo médio do estoque
  SELECT saldo_atual, custo_medio
  INTO v_saldo_atual, v_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id
    AND programa_id = NEW.programa_id;

  -- Se não existir registro de estoque, criar com saldo 0
  IF NOT FOUND THEN
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, valor_total, custo_medio)
    VALUES (NEW.parceiro_id, NEW.programa_id, 0, 0, 0);
    v_saldo_atual := 0;
    v_custo_medio := 0;
  END IF;

  -- Validar se há saldo suficiente
  IF v_saldo_atual < NEW.quantidade_milhas THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: %, Quantidade solicitada: %',
      v_saldo_atual, NEW.quantidade_milhas;
  END IF;

  -- Calcular CMV (Custo da Mercadoria Vendida)
  v_cmv := (NEW.quantidade_milhas * v_custo_medio / 1000);

  -- Registrar saldo anterior, custo médio e CMV na venda
  NEW.saldo_anterior := v_saldo_atual;
  NEW.custo_medio := v_custo_medio;
  NEW.cmv := v_cmv;

  -- Controlar baixa de estoque baseado no tipo de cliente
  IF NEW.tipo_cliente IN ('cliente_final', 'agencia_convencional') THEN
    -- Baixar do estoque usando atualizar_estoque_pontos
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id,
      NEW.programa_id,
      NEW.quantidade_milhas,
      'Saída',
      0,
      'venda',
      'Venda #' || NEW.id::text,
      NEW.id,
      'vendas'
    );

    NEW.estoque_reservado := false;
    NEW.quantidade_reservada := 0;
  ELSE
    -- Agência grande: apenas reservar estoque (não baixa ainda)
    NEW.estoque_reservado := true;
    NEW.quantidade_reservada := NEW.quantidade_milhas;
  END IF;

  -- Decrementar CPFs disponíveis: incrementar cpfs_emitidos no controle
  v_ano := EXTRACT(YEAR FROM NEW.data_venda)::integer;

  INSERT INTO parceiro_programa_cpfs_controle
    (parceiro_id, programa_id, ano, cpfs_emitidos, data_primeiro_cpf, data_ultimo_cpf)
  VALUES
    (NEW.parceiro_id, NEW.programa_id, v_ano, 1, NEW.data_venda, NEW.data_venda)
  ON CONFLICT (parceiro_id, programa_id, ano)
  DO UPDATE SET
    cpfs_emitidos = parceiro_programa_cpfs_controle.cpfs_emitidos + 1,
    data_ultimo_cpf = NEW.data_venda,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- Atualizar reverter_venda para estornar CPF ao cancelar
CREATE OR REPLACE FUNCTION public.reverter_venda()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_cmv_original numeric;
  v_ano integer;
BEGIN
  -- Só reverter se o status mudou para 'cancelada'
  IF OLD.status != 'cancelada' AND NEW.status = 'cancelada' THEN

    -- Buscar CMV da venda (se não tiver, calcular)
    v_cmv_original := COALESCE(OLD.cmv, (OLD.quantidade_milhas * OLD.custo_medio / 1000));

    -- Devolver as milhas ao estoque usando atualizar_estoque_pontos
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.programa_id,
      OLD.quantidade_milhas,
      'Entrada',
      v_cmv_original,
      'reversao_venda',
      'Reversão da venda #' || OLD.id::text,
      OLD.id,
      'vendas'
    );

    -- Cancelar todas as contas a receber relacionadas
    UPDATE contas_receber
    SET status_pagamento = 'cancelado',
        updated_at = now()
    WHERE venda_id = OLD.id
      AND status_pagamento = 'pendente';

    -- Estornar CPF: decrementar cpfs_emitidos (mínimo 0)
    v_ano := EXTRACT(YEAR FROM OLD.data_venda)::integer;

    UPDATE parceiro_programa_cpfs_controle
    SET cpfs_emitidos = GREATEST(0, cpfs_emitidos - 1),
        updated_at = now()
    WHERE parceiro_id = OLD.parceiro_id
      AND programa_id = OLD.programa_id
      AND ano = v_ano;

  END IF;

  RETURN NEW;
END;
$function$;

-- Criar função para estornar CPF ao deletar venda (admin)
CREATE OR REPLACE FUNCTION public.decrementar_cpf_venda_deletada()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_ano integer;
BEGIN
  -- Estornar CPF somente se a venda estava concluída (não cancelada, pois cancelamento já estornou)
  IF OLD.status = 'concluida' THEN
    v_ano := EXTRACT(YEAR FROM OLD.data_venda)::integer;

    UPDATE parceiro_programa_cpfs_controle
    SET cpfs_emitidos = GREATEST(0, cpfs_emitidos - 1),
        updated_at = now()
    WHERE parceiro_id = OLD.parceiro_id
      AND programa_id = OLD.programa_id
      AND ano = v_ano;
  END IF;

  RETURN OLD;
END;
$function$;

-- Criar trigger de delete para estornar CPF (roda ANTES do prevent_vendas_modification
-- para que seja executado quando admin deleta)
DROP TRIGGER IF EXISTS decrementar_cpf_ao_deletar_venda ON vendas;
CREATE TRIGGER decrementar_cpf_ao_deletar_venda
  BEFORE DELETE ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION decrementar_cpf_venda_deletada();

-- Garantir unique constraint na tabela de controle para o ON CONFLICT funcionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'parceiro_programa_cpfs_controle'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'parceiro_programa_cpfs_controle_parceiro_programa_ano_key'
  ) THEN
    ALTER TABLE parceiro_programa_cpfs_controle
      ADD CONSTRAINT parceiro_programa_cpfs_controle_parceiro_programa_ano_key
      UNIQUE (parceiro_id, programa_id, ano);
  END IF;
END $$;
