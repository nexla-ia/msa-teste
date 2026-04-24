/*
  # RPC admin_update_venda

  Permite que administradores editem uma venda existente, ajustando:
  - Campos da própria venda
  - Estoque (delta de quantidade_milhas)
  - Localizador
  - Contas a receber pendentes
*/

CREATE OR REPLACE FUNCTION public.admin_update_venda(
  p_venda_id                 uuid,
  p_usuario_id               uuid,
  p_data_venda               date,
  p_cliente_id               uuid,
  p_ordem_compra             text,
  p_cia_parceira             text,
  p_quantidade_milhas        numeric,
  p_valor_milheiro           numeric,
  p_valor_total              numeric,
  p_taxa_embarque            numeric,
  p_taxa_resgate             numeric,
  p_taxa_bagagem             numeric,
  p_cartao_taxa_embarque_id  uuid,
  p_cartao_taxa_bagagem_id   uuid,
  p_cartao_taxa_resgate_id   uuid,
  p_data_voo_ida             date,
  p_data_voo_volta           date,
  p_nome_passageiro          text,
  p_quantidade_passageiros   integer,
  p_trecho                   text,
  p_tarifa_diamante          numeric,
  p_milhas_bonus             numeric,
  p_custo_emissao            numeric,
  p_emissor                  text,
  p_observacao               text,
  p_lucro_real               numeric,
  p_localizador              text,
  p_valor_conta              numeric,
  p_data_vencimento_venda    date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nivel_acesso  text;
  v_venda         RECORD;
  v_delta         numeric;
  v_custo_medio   numeric;
  v_valor_retorno numeric;
BEGIN
  SELECT nivel_acesso INTO v_nivel_acesso FROM usuarios WHERE id = p_usuario_id;
  IF v_nivel_acesso IS NULL OR v_nivel_acesso != 'ADM' THEN
    RAISE EXCEPTION 'Apenas administradores podem editar vendas.';
  END IF;

  PERFORM set_config('app.is_admin', 'true', true);

  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  -- Ajuste de estoque pelo delta de milhas
  v_delta := p_quantidade_milhas - v_venda.quantidade_milhas;

  IF v_delta > 0 THEN
    -- Precisa debitar milhas adicionais do estoque
    PERFORM atualizar_estoque_pontos(
      v_venda.parceiro_id,
      v_venda.programa_id,
      v_delta,
      'Saída',
      0,
      'Ajuste Venda',
      'Ajuste edição venda ' || COALESCE(v_venda.ordem_compra, p_venda_id::text),
      p_venda_id,
      'venda',
      'ajuste_venda'
    );

  ELSIF v_delta < 0 THEN
    -- Devolver milhas ao estoque
    SELECT custo_medio INTO v_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = v_venda.parceiro_id AND programa_id = v_venda.programa_id;

    v_custo_medio := COALESCE(v_custo_medio, 0);
    v_valor_retorno := CASE WHEN v_custo_medio > 0
      THEN (ABS(v_delta) * v_custo_medio) / 1000
      ELSE 0
    END;

    PERFORM atualizar_estoque_pontos(
      v_venda.parceiro_id,
      v_venda.programa_id,
      ABS(v_delta),
      'Entrada',
      v_valor_retorno,
      'Ajuste Venda',
      'Ajuste edição venda ' || COALESCE(v_venda.ordem_compra, p_venda_id::text),
      p_venda_id,
      'venda',
      'ajuste_venda'
    );
  END IF;

  -- Atualizar venda
  UPDATE vendas SET
    data_venda               = p_data_venda,
    cliente_id               = p_cliente_id,
    ordem_compra             = p_ordem_compra,
    cia_parceira             = p_cia_parceira,
    quantidade_milhas        = p_quantidade_milhas,
    valor_milheiro           = p_valor_milheiro,
    valor_total              = p_valor_total,
    taxa_embarque            = p_taxa_embarque,
    taxa_resgate             = p_taxa_resgate,
    taxa_bagagem             = p_taxa_bagagem,
    cartao_taxa_embarque_id  = p_cartao_taxa_embarque_id,
    cartao_taxa_bagagem_id   = p_cartao_taxa_bagagem_id,
    cartao_taxa_resgate_id   = p_cartao_taxa_resgate_id,
    data_voo_ida             = p_data_voo_ida,
    data_voo_volta           = p_data_voo_volta,
    nome_passageiro          = p_nome_passageiro,
    quantidade_passageiros   = p_quantidade_passageiros,
    trecho                   = p_trecho,
    tarifa_diamante          = p_tarifa_diamante,
    milhas_bonus             = p_milhas_bonus,
    custo_emissao            = p_custo_emissao,
    emissor                  = p_emissor,
    observacao               = p_observacao,
    lucro_real               = p_lucro_real,
    updated_at               = now()
  WHERE id = p_venda_id;

  -- Atualizar localizador
  IF p_localizador IS NOT NULL AND p_localizador != '' THEN
    UPDATE localizadores
    SET codigo_localizador = p_localizador
    WHERE venda_id = p_venda_id;

    IF NOT FOUND THEN
      INSERT INTO localizadores (venda_id, codigo_localizador, status)
      VALUES (p_venda_id, p_localizador, 'emitido');
    END IF;
  END IF;

  -- Atualizar contas a receber pendentes
  IF p_valor_conta IS NOT NULL AND p_data_vencimento_venda IS NOT NULL THEN
    UPDATE contas_receber
    SET
      valor_parcela  = p_valor_conta,
      data_vencimento = p_data_vencimento_venda
    WHERE venda_id = p_venda_id
      AND status_pagamento = 'pendente';
  END IF;

END;
$$;

COMMENT ON FUNCTION public.admin_update_venda IS
'Edita uma venda existente como administrador: ajusta estoque pelo delta de milhas,
atualiza o registro da venda, o localizador e as contas a receber pendentes.';
