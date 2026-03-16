/*
  # Atualizar processamento automático de créditos para usar titular

  1. Descrição
    - Modifica processar_creditos_clubes() para creditar pontos ao titular da conta família
    - Mantém registro da atividade no parceiro original
    - Pontos vão para titular se o parceiro for convidado

  2. Mudanças
    - Usa obter_titular_conta_familia() para determinar quem recebe os pontos
    - Registra no histórico quem recebeu (titular ou próprio parceiro)
*/

CREATE OR REPLACE FUNCTION processar_creditos_clubes()
RETURNS TABLE (
  parceiro_id uuid,
  parceiro_nome text,
  programa_id uuid,
  programa_nome text,
  pontos_creditados numeric,
  tipo_credito text,
  processado_em timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clube RECORD;
  v_titular RECORD;
  v_ja_creditado boolean;
  v_data_referencia date;
  v_pontos_total numeric;
  v_tem_bonus boolean;
BEGIN
  v_data_referencia := DATE_TRUNC('month', CURRENT_DATE)::date;

  FOR v_clube IN
    SELECT
      pc.*,
      p.nome_parceiro,
      pf.nome as programa_nome,
      pr.nome as produto_nome
    FROM programas_clubes pc
    INNER JOIN parceiros p ON p.id = pc.parceiro_id
    LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
    WHERE pc.tem_clube = true
      AND pc.dia_cobranca IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = pc.dia_cobranca
  LOOP
    -- Verifica se já foi creditado neste mês
    SELECT EXISTS(
      SELECT 1
      FROM atividades a
      WHERE a.parceiro_id = v_clube.parceiro_id
        AND a.programa_id = v_clube.programa_id
        AND a.tipo_atividade = 'clube_credito_mensal'
        AND a.data_prevista >= v_data_referencia
        AND EXTRACT(MONTH FROM a.data_prevista) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM a.data_prevista) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND a.status = 'processado'
    ) INTO v_ja_creditado;

    IF NOT v_ja_creditado THEN
      -- Obter titular para crédito
      SELECT * INTO v_titular
      FROM obter_titular_conta_familia(v_clube.parceiro_id, v_clube.programa_id);

      v_pontos_total := v_clube.quantidade_pontos;
      v_tem_bonus := false;

      -- Creditar pontos regulares para o titular (ou próprio parceiro)
      PERFORM atualizar_estoque_pontos(
        v_titular.titular_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        0,
        'clube_credito_mensal',
        CASE
          WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
            'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '') ||
            ' de ' || v_clube.nome_parceiro || ' (convidado) para titular ' || v_titular.titular_nome
          ELSE
            'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '')
        END,
        v_clube.id,
        'programas_clubes'
      );

      -- Criar atividade para registrar o crédito (no nome do parceiro original)
      INSERT INTO atividades (
        tipo_atividade,
        titulo,
        descricao,
        parceiro_id,
        parceiro_nome,
        programa_id,
        programa_nome,
        quantidade_pontos,
        data_prevista,
        referencia_id,
        referencia_tabela,
        prioridade,
        status
      ) VALUES (
        'clube_credito_mensal',
        'Crédito mensal de clube',
        CASE
          WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
            'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '') ||
            '. Pontos creditados para titular ' || v_titular.titular_nome
          ELSE
            'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '')
        END,
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_clube.quantidade_pontos,
        CURRENT_DATE,
        v_clube.id,
        'programas_clubes',
        'alta',
        'processado'
      );

      -- Se tem bônus, creditar também
      IF v_clube.bonus_quantidade_pontos > 0 THEN
        PERFORM atualizar_estoque_pontos(
          v_titular.titular_id,
          v_clube.programa_id,
          v_clube.bonus_quantidade_pontos,
          'Entrada',
          0,
          'clube_credito_bonus',
          CASE
            WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
              'Bônus mensal do clube ' || COALESCE(v_clube.produto_nome, '') ||
              ' de ' || v_clube.nome_parceiro || ' para titular ' || v_titular.titular_nome
            ELSE
              'Bônus mensal do clube ' || COALESCE(v_clube.produto_nome, '')
          END,
          v_clube.id,
          'programas_clubes'
        );

        v_pontos_total := v_pontos_total + v_clube.bonus_quantidade_pontos;
        v_tem_bonus := true;
      END IF;

      RETURN QUERY SELECT
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_pontos_total,
        CASE WHEN v_tem_bonus THEN 'credito_com_bonus' ELSE 'credito_mensal' END::text,
        CURRENT_TIMESTAMP;

    END IF;
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION processar_creditos_clubes() IS
'Processa créditos mensais de pontos para parceiros com clubes ativos. Se o parceiro estiver em conta família como convidado, os pontos são creditados para o titular. Se for titular ou não tiver conta família, recebe normalmente. Os pontos são creditados no DIA DE COBRANÇA configurado. Registra TODAS as movimentações no histórico com origem e observação detalhadas.';
