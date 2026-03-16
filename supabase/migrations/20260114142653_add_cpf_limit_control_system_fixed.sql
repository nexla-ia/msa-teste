/*
  # Sistema de Controle de Limite de CPFs por Status e Programa

  1. Problema
    - Cada status de programa permite um número limitado de emissões de CPF por ano
    - Cada parceiro tem seu próprio limite por programa
    - Os limites resetam anualmente
    - Exemplo: Alisson emitiu 25 CPFs no Livelo (limite 25), não pode mais emitir
               Mas pode emitir em outros programas normalmente

  2. Solução
    - Adicionar campo limite_cpfs_ano na tabela status_programa
    - Criar tabela para controlar CPFs emitidos por parceiro/programa/ano
    - Criar funções para calcular CPFs disponíveis
    - Criar view para facilitar consultas no estoque

  3. Mudanças
    - Novo campo: status_programa.limite_cpfs_ano
    - Nova tabela: parceiro_programa_cpfs_controle
    - Nova função: calcular_cpfs_disponiveis
    - Nova view: estoque_cpfs_disponiveis
*/

-- 1. Adicionar campo limite_cpfs_ano na tabela status_programa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'status_programa' AND column_name = 'limite_cpfs_ano'
  ) THEN
    ALTER TABLE status_programa 
    ADD COLUMN limite_cpfs_ano integer DEFAULT 0;
    
    COMMENT ON COLUMN status_programa.limite_cpfs_ano IS 
    'Número máximo de CPFs que podem ser emitidos por parceiro neste status durante um ano';
  END IF;
END $$;

-- 2. Criar tabela de controle de CPFs emitidos por parceiro/programa/ano
CREATE TABLE IF NOT EXISTS parceiro_programa_cpfs_controle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  programa_id uuid NOT NULL REFERENCES programas_fidelidade(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  cpfs_emitidos integer DEFAULT 0,
  data_primeiro_cpf date,
  data_ultimo_cpf date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(parceiro_id, programa_id, ano)
);

ALTER TABLE parceiro_programa_cpfs_controle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total a parceiro_programa_cpfs_controle"
  ON parceiro_programa_cpfs_controle
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cpfs_controle_parceiro_programa_ano 
ON parceiro_programa_cpfs_controle(parceiro_id, programa_id, ano);

CREATE INDEX IF NOT EXISTS idx_cpfs_controle_ano 
ON parceiro_programa_cpfs_controle(ano);

COMMENT ON TABLE parceiro_programa_cpfs_controle IS 
'Controla quantos CPFs cada parceiro emitiu em cada programa por ano';

-- 3. Criar função para calcular CPFs disponíveis para um parceiro/programa
CREATE OR REPLACE FUNCTION calcular_cpfs_disponiveis(
  p_parceiro_id uuid,
  p_programa_id uuid,
  p_status_programa_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_limite integer;
  v_emitidos integer;
  v_ano_atual integer;
BEGIN
  v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT limite_cpfs_ano INTO v_limite
  FROM status_programa
  WHERE id = p_status_programa_id;
  
  IF v_limite IS NULL OR v_limite = 0 THEN
    RETURN 999999;
  END IF;
  
  SELECT COALESCE(cpfs_emitidos, 0) INTO v_emitidos
  FROM parceiro_programa_cpfs_controle
  WHERE parceiro_id = p_parceiro_id
    AND programa_id = p_programa_id
    AND ano = v_ano_atual;
  
  v_emitidos := COALESCE(v_emitidos, 0);
  
  RETURN GREATEST(0, v_limite - v_emitidos);
END;
$$;

COMMENT ON FUNCTION calcular_cpfs_disponiveis IS 
'Calcula quantos CPFs ainda estão disponíveis para um parceiro emitir em um programa no ano atual';

-- 4. Criar view para facilitar consulta de CPFs disponíveis no estoque
CREATE OR REPLACE VIEW estoque_cpfs_disponiveis AS
SELECT 
  pc.id as programa_clube_id,
  pc.parceiro_id,
  p.nome_parceiro,
  pc.programa_id,
  pf.nome as programa_nome,
  pc.status_programa_id,
  sp.chave_referencia as status_nome,
  sp.limite_cpfs_ano,
  EXTRACT(YEAR FROM CURRENT_DATE)::integer as ano_atual,
  COALESCE(cpfc.cpfs_emitidos, 0) as cpfs_emitidos,
  CASE 
    WHEN sp.limite_cpfs_ano = 0 OR sp.limite_cpfs_ano IS NULL THEN 999999
    ELSE GREATEST(0, sp.limite_cpfs_ano - COALESCE(cpfc.cpfs_emitidos, 0))
  END as cpfs_disponiveis,
  cpfc.data_primeiro_cpf,
  cpfc.data_ultimo_cpf
FROM programas_clubes pc
INNER JOIN parceiros p ON pc.parceiro_id = p.id
INNER JOIN programas_fidelidade pf ON pc.programa_id = pf.id
INNER JOIN status_programa sp ON pc.status_programa_id = sp.id
LEFT JOIN parceiro_programa_cpfs_controle cpfc ON (
  cpfc.parceiro_id = pc.parceiro_id 
  AND cpfc.programa_id = pc.programa_id
  AND cpfc.ano = EXTRACT(YEAR FROM CURRENT_DATE)
)
WHERE pc.tem_clube = false;

COMMENT ON VIEW estoque_cpfs_disponiveis IS 
'View que mostra quantos CPFs cada parceiro ainda pode emitir em cada programa no ano atual';

-- 5. Criar função para incrementar contador quando CPF é emitido
CREATE OR REPLACE FUNCTION incrementar_cpf_emitido(
  p_parceiro_id uuid,
  p_programa_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_ano_atual integer;
BEGIN
  v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);
  
  INSERT INTO parceiro_programa_cpfs_controle (
    parceiro_id,
    programa_id,
    ano,
    cpfs_emitidos,
    data_primeiro_cpf,
    data_ultimo_cpf,
    updated_at
  )
  VALUES (
    p_parceiro_id,
    p_programa_id,
    v_ano_atual,
    1,
    CURRENT_DATE,
    CURRENT_DATE,
    now()
  )
  ON CONFLICT (parceiro_id, programa_id, ano)
  DO UPDATE SET
    cpfs_emitidos = parceiro_programa_cpfs_controle.cpfs_emitidos + 1,
    data_ultimo_cpf = CURRENT_DATE,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION incrementar_cpf_emitido IS 
'Incrementa o contador de CPFs emitidos quando uma nova conta em programa é criada';

-- 6. Criar função para verificar se pode emitir CPF
CREATE OR REPLACE FUNCTION pode_emitir_cpf(
  p_parceiro_id uuid,
  p_programa_id uuid,
  p_status_programa_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_disponiveis integer;
BEGIN
  v_disponiveis := calcular_cpfs_disponiveis(
    p_parceiro_id,
    p_programa_id,
    p_status_programa_id
  );
  
  RETURN v_disponiveis > 0;
END;
$$;

COMMENT ON FUNCTION pode_emitir_cpf IS 
'Verifica se um parceiro ainda pode emitir CPF em um programa baseado no status e limite anual';

-- 7. Criar trigger para incrementar CPFs quando um programa/clube é cadastrado
CREATE OR REPLACE FUNCTION trigger_incrementar_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tem_clube = false AND NEW.status_programa_id IS NOT NULL THEN
    PERFORM incrementar_cpf_emitido(NEW.parceiro_id, NEW.programa_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incrementar_cpf_programa ON programas_clubes;

CREATE TRIGGER trg_incrementar_cpf_programa
  AFTER INSERT ON programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_incrementar_cpf();

COMMENT ON TRIGGER trg_incrementar_cpf_programa ON programas_clubes IS 
'Incrementa o contador de CPFs emitidos quando um novo CPF é cadastrado em um programa';

-- 8. Popular valores padrão para status existentes (25 CPFs por ano)
UPDATE status_programa 
SET limite_cpfs_ano = 25 
WHERE limite_cpfs_ano = 0 OR limite_cpfs_ano IS NULL;