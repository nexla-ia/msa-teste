/*
  # Adicionar constraint única em programas_clubes

  ## Problema
  O sistema está permitindo cadastrar o mesmo parceiro no mesmo programa múltiplas vezes,
  causando duplicatas indesejadas.

  ## Solução
  1. Remover registros duplicados (manter o mais antigo)
  2. Adicionar constraint UNIQUE em (parceiro_id, programa_id)

  ## Mudanças
  - Remove duplicatas existentes
  - Adiciona constraint única para impedir futuros cadastros duplicados
*/

-- Remover duplicatas mantendo apenas o registro mais antigo
DELETE FROM programas_clubes
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY parceiro_id, programa_id 
        ORDER BY created_at ASC, id ASC
      ) as rn
    FROM programas_clubes
  ) t
  WHERE rn > 1
);

-- Adicionar constraint única para impedir duplicatas no futuro
ALTER TABLE programas_clubes
ADD CONSTRAINT programas_clubes_parceiro_programa_unique 
UNIQUE (parceiro_id, programa_id);

COMMENT ON CONSTRAINT programas_clubes_parceiro_programa_unique ON programas_clubes IS 
'Garante que um parceiro só pode ter um único registro por programa de fidelidade';