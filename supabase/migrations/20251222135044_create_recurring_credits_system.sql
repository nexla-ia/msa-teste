/*
  # Create recurring credits system for programas_clubes

  1. New Tables
    - `creditos_recorrentes_log`
      - `id` (uuid, primary key)
      - `programa_clube_id` (uuid, foreign key to programas_clubes)
      - `data_credito` (date) - Date when credit was processed
      - `quantidade_pontos` (integer) - Base points credited
      - `quantidade_bonus` (integer) - Bonus points credited
      - `quantidade_total` (integer) - Total points credited
      - `created_at` (timestamptz)
      - Tracks each recurring credit processed

  2. Functions
    - `processar_creditos_recorrentes` - Processes pending recurring credits
    - `calcular_proxima_data_credito` - Calculates next credit date based on frequency

  3. Security
    - Enable RLS on creditos_recorrentes_log table
    - Add policies for authenticated users

  4. Notes
    - This system automatically credits points to partners based on their program club frequency
    - Credits are tracked to avoid duplicates
*/

-- Create log table for recurring credits
CREATE TABLE IF NOT EXISTS creditos_recorrentes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_clube_id uuid REFERENCES programas_clubes(id) ON DELETE CASCADE NOT NULL,
  data_credito date NOT NULL,
  quantidade_pontos integer DEFAULT 0,
  quantidade_bonus integer DEFAULT 0,
  quantidade_total integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(programa_clube_id, data_credito)
);

-- Enable RLS
ALTER TABLE creditos_recorrentes_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all creditos_recorrentes_log"
  ON creditos_recorrentes_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert creditos_recorrentes_log"
  ON creditos_recorrentes_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_creditos_recorrentes_programa_clube 
  ON creditos_recorrentes_log(programa_clube_id);

CREATE INDEX IF NOT EXISTS idx_creditos_recorrentes_data 
  ON creditos_recorrentes_log(data_credito);

-- Function to calculate next credit date based on frequency
CREATE OR REPLACE FUNCTION calcular_proxima_data_credito(
  p_data_base date,
  p_frequencia text
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_frequencia
    WHEN 'mensal' THEN
      RETURN p_data_base + INTERVAL '1 month';
    WHEN 'trimestral' THEN
      RETURN p_data_base + INTERVAL '3 months';
    WHEN 'anual' THEN
      RETURN p_data_base + INTERVAL '1 year';
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- Function to process recurring credits
CREATE OR REPLACE FUNCTION processar_creditos_recorrentes()
RETURNS TABLE (
  programa_clube_id uuid,
  parceiro_nome text,
  programa_nome text,
  quantidade_creditada integer,
  data_credito date,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
  v_ultima_data_credito date;
  v_proxima_data_credito date;
  v_quantidade_bonus integer;
  v_quantidade_total integer;
  v_data_atual date := CURRENT_DATE;
  v_creditos_processados integer := 0;
BEGIN
  -- Loop through all active program clubs with frequency configured
  FOR v_record IN 
    SELECT 
      pc.id,
      pc.parceiro_id,
      pc.programa_id,
      pc.nome_parceiro,
      pc.data_ultima_assinatura,
      pc.quantidade_pontos,
      pc.bonus_porcentagem,
      pc.sequencia,
      pf.nome as programa_nome
    FROM programas_clubes pc
    LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    WHERE pc.sequencia IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND pc.data_ultima_assinatura IS NOT NULL
      AND pc.parceiro_id IS NOT NULL
      AND pc.programa_id IS NOT NULL
  LOOP
    -- Get the last credit date
    SELECT MAX(data_credito) INTO v_ultima_data_credito
    FROM creditos_recorrentes_log
    WHERE programa_clube_id = v_record.id;
    
    -- If no previous credit, use the last subscription date
    IF v_ultima_data_credito IS NULL THEN
      v_ultima_data_credito := v_record.data_ultima_assinatura;
    END IF;
    
    -- Calculate next credit date
    v_proxima_data_credito := calcular_proxima_data_credito(
      v_ultima_data_credito,
      v_record.sequencia
    );
    
    -- Check if credit is due (next date is today or in the past)
    IF v_proxima_data_credito IS NOT NULL AND v_proxima_data_credito <= v_data_atual THEN
      -- Calculate bonus points
      v_quantidade_bonus := FLOOR(
        v_record.quantidade_pontos * COALESCE(v_record.bonus_porcentagem, 0) / 100
      );
      
      v_quantidade_total := v_record.quantidade_pontos + v_quantidade_bonus;
      
      -- Insert credit log
      BEGIN
        INSERT INTO creditos_recorrentes_log (
          programa_clube_id,
          data_credito,
          quantidade_pontos,
          quantidade_bonus,
          quantidade_total
        ) VALUES (
          v_record.id,
          v_proxima_data_credito,
          v_record.quantidade_pontos,
          v_quantidade_bonus,
          v_quantidade_total
        );
        
        -- Update stock by calling the existing function
        PERFORM atualizar_estoque_pontos(
          v_record.parceiro_id,
          v_record.programa_id,
          v_quantidade_total,
          'Entrada',
          0
        );
        
        -- Return success result
        programa_clube_id := v_record.id;
        parceiro_nome := v_record.nome_parceiro;
        programa_nome := v_record.programa_nome;
        quantidade_creditada := v_quantidade_total;
        data_credito := v_proxima_data_credito;
        status := 'Creditado';
        
        v_creditos_processados := v_creditos_processados + 1;
        
        RETURN NEXT;
        
      EXCEPTION WHEN OTHERS THEN
        -- Return error result
        programa_clube_id := v_record.id;
        parceiro_nome := v_record.nome_parceiro;
        programa_nome := v_record.programa_nome;
        quantidade_creditada := 0;
        data_credito := v_proxima_data_credito;
        status := 'Erro: ' || SQLERRM;
        
        RETURN NEXT;
      END;
    END IF;
  END LOOP;
  
  -- If no credits were processed, return a message
  IF v_creditos_processados = 0 THEN
    programa_clube_id := NULL;
    parceiro_nome := NULL;
    programa_nome := NULL;
    quantidade_creditada := 0;
    data_credito := NULL;
    status := 'Nenhum crédito pendente para processar';
    RETURN NEXT;
  END IF;
END;
$$;
