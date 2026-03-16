/*
  # Corrigir todas as constraints e referências de colunas

  1. Problemas Corrigidos
    - Remove constraint restritiva de forma_pagamento em compras
    - Corrige todas as referências de tipo_movimentacao para tipo
    - Corrige funções que criam atividades com status incorreto
    - Permite todas as formas de pagamento da tabela formas_pagamento

  2. Alterações
    - DROP de constraint compras_forma_pagamento_check
    - Atualização de todas as funções que usam tipo_movimentacao
    - Atualização de triggers para usar 'pendente' ao invés de 'processado'
*/

-- 1. Remover constraint restritiva de forma_pagamento em compras
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_forma_pagamento_check;

-- 2. Corrigir função processar_transferencia_pessoas_destino
CREATE OR REPLACE FUNCTION processar_transferencia_pessoas_destino()
RETURNS TRIGGER AS $$
DECLARE
  v_custo_final numeric;
  v_parceiro_nome text;
  v_programa_nome text;
  v_destino_programa_nome text;
BEGIN
  SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
  SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;
  SELECT nome INTO v_destino_programa_nome FROM programas_fidelidade WHERE id = NEW.destino_programa_id;

  v_custo_final := COALESCE(NEW.custo_transferencia, 0);

  -- 1. Registrar ENTRADA no estoque do DESTINO (pontos normais)
  INSERT INTO estoque_movimentacoes (
    parceiro_id,
    programa_id,
    tipo,
    quantidade,
    valor_total,
    origem,
    observacao,
    referencia_id,
    referencia_tabela
  ) VALUES (
    NEW.destino_parceiro_id,
    NEW.destino_programa_id,
    'entrada',
    NEW.quantidade,
    v_custo_final * NEW.quantidade,
    'transferencia_pessoas',
    format('Transferência recebida de %s (%s → %s)', 
      v_parceiro_nome,
      v_programa_nome,
      v_destino_programa_nome
    ),
    NEW.id,
    'transferencia_pessoas'
  );

  -- 2. Se houver bônus, registrar ENTRADA adicional de bônus
  IF NEW.bonus_destino > 0 THEN
    INSERT INTO estoque_movimentacoes (
      parceiro_id,
      programa_id,
      tipo,
      quantidade,
      valor_total,
      origem,
      observacao,
      referencia_id,
      referencia_tabela
    ) VALUES (
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      'entrada',
      NEW.bonus_destino,
      0,
      'transferencia_pessoas_bonus',
      format('Bônus de transferência recebido de %s (%s → %s)', 
        v_parceiro_nome,
        v_programa_nome,
        v_destino_programa_nome
      ),
      NEW.id,
      'transferencia_pessoas'
    );
  END IF;

  -- 3. Registrar no histórico da conta família do DESTINO
  INSERT INTO conta_familia_historico (
    parceiro_id,
    programa_id,
    tipo_movimentacao,
    quantidade,
    quantidade_bonus,
    saldo_antes,
    saldo_depois,
    observacao
  )
  SELECT 
    NEW.destino_parceiro_id,
    NEW.destino_programa_id,
    'transferencia_recebida',
    NEW.quantidade,
    NEW.bonus_destino,
    COALESCE(ep.saldo_atual, 0),
    COALESCE(ep.saldo_atual, 0) + NEW.quantidade + NEW.bonus_destino,
    format('Transferência recebida de %s', v_parceiro_nome)
  FROM estoque_pontos ep
  WHERE ep.parceiro_id = NEW.destino_parceiro_id
    AND ep.programa_id = NEW.destino_programa_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Corrigir função processar_creditos_automaticos_clubes
CREATE OR REPLACE FUNCTION processar_creditos_automaticos_clubes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registro RECORD;
  v_titular_id uuid;
  v_total_credito numeric;
  v_clube_id uuid;
BEGIN
  FOR v_registro IN
    SELECT 
      pc.id as clube_id,
      pc.parceiro_id,
      pc.programa_id,
      pc.dia_cobranca,
      pc.bonus_mensal,
      pc.bonus_produto,
      pc.bonus_cashback,
      p.nome_parceiro,
      pf.nome as programa_nome
    FROM programas_clubes pc
    JOIN parceiros p ON p.id = pc.parceiro_id
    JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    WHERE pc.ativo = true
      AND pc.dia_cobranca IS NOT NULL
      AND EXTRACT(DAY FROM CURRENT_DATE) = pc.dia_cobranca
      AND NOT EXISTS (
        SELECT 1 FROM atividades a
        WHERE a.tipo_atividade = 'clube_credito_mensal'
          AND a.referencia_id = pc.id
          AND a.referencia_tabela = 'programas_clubes'
          AND DATE(a.created_at) = CURRENT_DATE
      )
  LOOP
    SELECT id INTO v_titular_id
    FROM conta_familia
    WHERE parceiro_id = v_registro.parceiro_id
      AND programa_id = v_registro.programa_id
      AND tipo = 'Titular'
    LIMIT 1;

    IF v_titular_id IS NULL THEN
      CONTINUE;
    END IF;

    v_total_credito := COALESCE(v_registro.bonus_mensal, 0) +
                       COALESCE(v_registro.bonus_produto, 0) +
                       COALESCE(v_registro.bonus_cashback, 0);

    IF v_total_credito > 0 THEN
      INSERT INTO atividades (
        tipo_atividade,
        tipo_lembrete,
        titulo,
        descricao,
        parceiro_id,
        parceiro_nome,
        programa_id,
        programa_nome,
        quantidade_pontos,
        data_prevista,
        status,
        prioridade,
        referencia_id,
        referencia_tabela
      ) VALUES (
        'clube_credito_mensal',
        'credito_pontos_conferir',
        'Crédito manual do mês atual',
        format('Crédito processado manualmente para o mês atual - clube %s', v_registro.programa_nome),
        v_titular_id,
        v_registro.nome_parceiro,
        v_registro.programa_id,
        v_registro.programa_nome,
        v_total_credito,
        CURRENT_DATE,
        'pendente',
        'alta',
        v_registro.clube_id,
        'programas_clubes'
      );
    END IF;
  END LOOP;
END;
$$;

-- 4. Corrigir função criar_lembretes_downgrade
CREATE OR REPLACE FUNCTION criar_lembretes_downgrade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registro RECORD;
BEGIN
  FOR v_registro IN
    SELECT 
      pc.id,
      pc.parceiro_id,
      pc.programa_id,
      pc.data_downgrade,
      p.nome_parceiro,
      pf.nome as programa_nome
    FROM programas_clubes pc
    JOIN parceiros p ON p.id = pc.parceiro_id
    JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    WHERE pc.ativo = true
      AND pc.data_downgrade IS NOT NULL
      AND pc.data_downgrade >= CURRENT_DATE
      AND pc.data_downgrade <= CURRENT_DATE + INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM atividades a
        WHERE a.tipo_atividade = 'lembrete_downgrade'
          AND a.referencia_id = pc.id
          AND a.data_prevista = pc.data_downgrade
          AND a.status = 'pendente'
      )
  LOOP
    INSERT INTO atividades (
      tipo_atividade,
      tipo_lembrete,
      titulo,
      descricao,
      parceiro_id,
      parceiro_nome,
      programa_id,
      programa_nome,
      data_prevista,
      status,
      prioridade,
      referencia_id,
      referencia_tabela
    ) VALUES (
      'lembrete_downgrade',
      'downgrade_verificar',
      'Lembrete de Downgrade',
      format('Verificar downgrade do programa %s', v_registro.programa_nome),
      v_registro.parceiro_id,
      v_registro.nome_parceiro,
      v_registro.programa_id,
      v_registro.programa_nome,
      v_registro.data_downgrade,
      'pendente',
      'alta',
      v_registro.id,
      'programas_clubes'
    );
  END LOOP;
END;
$$;

-- 5. Corrigir função criar_lembretes_milhas_expirando
CREATE OR REPLACE FUNCTION criar_lembretes_milhas_expirando()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registro RECORD;
  v_dias_aviso integer := 30;
BEGIN
  FOR v_registro IN
    SELECT 
      cf.id,
      cf.parceiro_id,
      cf.programa_id,
      cf.data_expiracao,
      cf.quantidade_milhas,
      p.nome_parceiro,
      pf.nome as programa_nome
    FROM conta_familia cf
    JOIN parceiros p ON p.id = cf.parceiro_id
    JOIN programas_fidelidade pf ON pf.id = cf.programa_id
    WHERE cf.data_expiracao IS NOT NULL
      AND cf.data_expiracao >= CURRENT_DATE
      AND cf.data_expiracao <= CURRENT_DATE + v_dias_aviso
      AND cf.quantidade_milhas > 0
      AND NOT EXISTS (
        SELECT 1 FROM atividades a
        WHERE a.tipo_atividade = 'lembrete_milhas_expirando'
          AND a.referencia_id = cf.id
          AND a.data_prevista = cf.data_expiracao
          AND a.status = 'pendente'
      )
  LOOP
    INSERT INTO atividades (
      tipo_atividade,
      tipo_lembrete,
      titulo,
      descricao,
      parceiro_id,
      parceiro_nome,
      programa_id,
      programa_nome,
      quantidade_pontos,
      data_prevista,
      status,
      prioridade,
      referencia_id,
      referencia_tabela
    ) VALUES (
      'lembrete_milhas_expirando',
      'milhas_expirando',
      'Milhas Expirando',
      format('%s milhas do programa %s expirarão em %s', 
        v_registro.quantidade_milhas,
        v_registro.programa_nome,
        TO_CHAR(v_registro.data_expiracao, 'DD/MM/YYYY')
      ),
      v_registro.parceiro_id,
      v_registro.nome_parceiro,
      v_registro.programa_id,
      v_registro.programa_nome,
      v_registro.quantidade_milhas,
      v_registro.data_expiracao,
      'pendente',
      'alta',
      v_registro.id,
      'conta_familia'
    );
  END LOOP;
END;
$$;

COMMENT ON COLUMN compras.forma_pagamento IS 'Forma de pagamento utilizada. Valores devem ser da tabela formas_pagamento.';
