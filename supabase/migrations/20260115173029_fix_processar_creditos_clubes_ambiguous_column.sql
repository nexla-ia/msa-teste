/*
  # Corrigir erro de coluna ambígua em processar_creditos_clubes

  ## Problema
  A função processar_creditos_clubes() está falhando com erro:
  "column reference 'parceiro_id' is ambiguous"
  
  Isso está impedindo o processamento automático dos créditos mensais.

  ## Solução
  Qualificar explicitamente as colunas com alias da tabela para remover ambiguidade.

  ## Mudanças
  - Adiciona alias 'a' para tabela atividades
  - Qualifica todas as referências de coluna: a.parceiro_id, a.programa_id, etc.
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
      AND pc.data_ultima_assinatura IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = EXTRACT(DAY FROM pc.data_ultima_assinatura)::int
  LOOP
    -- Verifica se já foi creditado neste mês verificando nas atividades
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
      v_pontos_total := v_clube.quantidade_pontos;
      v_tem_bonus := false;
      
      -- Creditar pontos regulares usando a função correta COM origem e observação
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        0,  -- custo zero porque é crédito de clube
        'clube_credito_mensal',  -- origem
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.quantidade_pontos || ' pontos',  -- observação
        v_clube.id,  -- referencia_id
        'programas_clubes'  -- referencia_tabela
      );
      
      -- Criar atividade para registrar o crédito
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
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, ''),
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
          v_clube.parceiro_id,
          v_clube.programa_id,
          v_clube.bonus_quantidade_pontos,
          'Entrada',
          0,
          'clube_credito_bonus',  -- origem
          'Bônus mensal do clube ' || COALESCE(v_clube.produto_nome, '') || ' - ' || v_clube.bonus_quantidade_pontos || ' pontos',  -- observação
          v_clube.id,  -- referencia_id
          'programas_clubes'  -- referencia_tabela
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
'Processa créditos mensais de pontos para parceiros com clubes ativos. Os pontos são creditados no dia correspondente à data de assinatura (ex: se assinou dia 5, créditos caem todo dia 5). Registra TODAS as movimentações no histórico com origem e observação detalhadas. Usa atualizar_estoque_pontos() para manter consistência. Retorna uma linha por parceiro com o total de pontos (regulares + bônus quando aplicável).';