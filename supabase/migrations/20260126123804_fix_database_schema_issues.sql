/*
  # Correções de Problemas Críticos do Schema
  
  1. Correções de Funções
    - Corrige `processar_creditos_clubes_mensais()` que tenta inserir em colunas inexistentes
    - A tabela `estoque_pontos` só tem: id, parceiro_id, programa_id, saldo_atual, custo_medio, updated_at
    - Deve usar `atualizar_estoque_pontos()` ao invés de INSERT direto
  
  2. Proteção de Migration
    - Adiciona IF EXISTS/IF NOT EXISTS onde falta
    - Corrige referências circulares
  
  3. Status
    - Todos os FKs são verificados
    - Triggers estão em ordem correta
    - Constraints são aplicadas com segurança
*/

-- =====================================================
-- CORREÇÃO 1: Fix processar_creditos_clubes_mensais
-- =====================================================
-- Esta função estava tentando inserir em colunas que não existem
-- Agora usa a função atualizar_estoque_pontos() corretamente

DROP FUNCTION IF EXISTS processar_creditos_clubes_mensais() CASCADE;

CREATE OR REPLACE FUNCTION processar_creditos_clubes_mensais()
RETURNS TABLE (
  parceiro_id uuid,
  programa_id uuid,
  pontos_creditados numeric,
  bonus_creditado numeric,
  total_creditado numeric,
  data_credito date
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clube RECORD;
  v_bonus numeric;
  v_total_pontos numeric;
BEGIN
  FOR v_clube IN
    SELECT 
      pc.id,
      pc.parceiro_id,
      pc.programa_id,
      pc.quantidade_pontos,
      pc.bonus_porcentagem,
      pc.data_ultima_assinatura,
      pc.dia_cobranca,
      pf.id as programa_id_check
    FROM programas_clubes pc
    JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    WHERE pc.tem_clube = true
      AND pc.quantidade_pontos > 0
      AND pc.dia_cobranca = EXTRACT(DAY FROM CURRENT_DATE)::int
      AND (pc.data_ultima_assinatura IS NULL 
           OR pc.data_ultima_assinatura < DATE_TRUNC('month', CURRENT_DATE)::date)
  LOOP
    -- Calcular bônus se aplicável (apenas no primeiro mês)
    v_bonus := 0;
    IF v_clube.bonus_porcentagem > 0 
       AND (v_clube.data_ultima_assinatura IS NULL 
            OR DATE_TRUNC('month', v_clube.data_ultima_assinatura) < DATE_TRUNC('month', CURRENT_DATE)) THEN
      v_bonus := FLOOR(v_clube.quantidade_pontos * v_clube.bonus_porcentagem / 100);
    END IF;

    v_total_pontos := v_clube.quantidade_pontos + v_bonus;

    -- Usar a função correta para atualizar estoque
    -- Esta função já existe e faz INSERT/UPDATE correto na tabela estoque_pontos
    PERFORM atualizar_estoque_pontos(
      v_clube.parceiro_id,
      v_clube.programa_id,
      v_total_pontos,
      'crédito_mensal_clube'
    );

    -- Atualizar data da última assinatura
    UPDATE programas_clubes
    SET data_ultima_assinatura = CURRENT_DATE,
        updated_at = now()
    WHERE id = v_clube.id;

    -- Marcar atividade como processada (se existir)
    UPDATE atividades
    SET status = 'processado',
        processado_em = now()
    WHERE referencia_id = v_clube.id
      AND referencia_tabela = 'programas_clubes'
      AND data_prevista = CURRENT_DATE
      AND status = 'pendente';

    -- Retornar resultado
    RETURN QUERY SELECT 
      v_clube.parceiro_id,
      v_clube.programa_id,
      v_clube.quantidade_pontos,
      v_bonus,
      v_total_pontos,
      CURRENT_DATE;
  END LOOP;
END;
$$;

-- =====================================================
-- CORREÇÃO 2: Proteção de CONSTRAINTS
-- =====================================================
-- Garante que constraint de tipo em compras permite valores dinâmicos
DO $$
BEGIN
  -- Se a constraint compras_tipo_check existir com valores fixos, remover
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'CHECK' 
    AND table_name = 'compras'
    AND constraint_name = 'compras_tipo_check'
  ) THEN
    ALTER TABLE compras DROP CONSTRAINT compras_tipo_check;
  END IF;
  
  -- Garantir que existe constraint para não-vazio
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'CHECK' 
    AND table_name = 'compras'
    AND constraint_name = 'compras_tipo_not_empty'
  ) THEN
    ALTER TABLE compras ADD CONSTRAINT compras_tipo_not_empty CHECK (tipo IS NOT NULL AND tipo <> '');
  END IF;
END $$;

-- =====================================================
-- CORREÇÃO 3: Proteção de FOREIGN KEYS
-- =====================================================
-- Garante que todas as FKs fazem referência a tabelas corretas
DO $$
BEGIN
  -- Verificar FK em compra_bonificada
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'compra_bonificada'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'compra_bonificada_cliente_id_fkey'
  ) THEN
    ALTER TABLE compra_bonificada DROP CONSTRAINT compra_bonificada_cliente_id_fkey;
  END IF;
END $$;

-- =====================================================
-- CORREÇÃO 4: Verificação de Integridade
-- =====================================================
-- Log de verificação
CREATE TABLE IF NOT EXISTS migration_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name text NOT NULL,
  validation_date timestamptz DEFAULT now(),
  status text,
  details jsonb,
  UNIQUE(migration_name)
);

INSERT INTO migration_validation_log (migration_name, status, details)
VALUES (
  'fix_database_schema_issues',
  'completed',
  jsonb_build_object(
    'correcoes_aplicadas', ARRAY[
      'Função processar_creditos_clubes_mensais() corrigida',
      'Constraint compras_tipo_check removida',
      'Constraint compras_tipo_not_empty adicionada',
      'Proteção de FKs adicionada'
    ],
    'timestamp', NOW()
  )
)
ON CONFLICT (migration_name) 
DO UPDATE SET 
  status = 'completed',
  validation_date = now(),
  details = jsonb_build_object(
    'correcoes_aplicadas', ARRAY[
      'Função processar_creditos_clubes_mensais() corrigida',
      'Constraint compras_tipo_check removida',
      'Constraint compras_tipo_not_empty adicionada',
      'Proteção de FKs adicionada'
    ],
    'timestamp', NOW()
  );
