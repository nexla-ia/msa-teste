/*
  # Corrigir constraint de status em atividades - Versão Final

  ## Problema
  A constraint atividades_status_check exige 'concluído' (com acento), mas as funções
  estão usando 'concluido' (sem acento), causando erro ao processar créditos de clube.

  ## Solução
  Simplesmente remover e recriar a constraint com ambos os valores aceitos temporariamente,
  depois atualizar os dados, e finalmente ajustar a constraint final.
*/

-- Passo 1: Remover constraint antiga
ALTER TABLE atividades DROP CONSTRAINT IF EXISTS atividades_status_check;

-- Passo 2: Criar constraint temporária que aceita ambos
ALTER TABLE atividades ADD CONSTRAINT atividades_status_check 
  CHECK (status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'concluído'::text, 'cancelado'::text]));

-- Passo 3: Atualizar todos os registros com acento para sem acento
UPDATE atividades 
SET status = 'concluido' 
WHERE status = 'concluído';

-- Passo 4: Remover constraint temporária
ALTER TABLE atividades DROP CONSTRAINT atividades_status_check;

-- Passo 5: Criar constraint final (apenas sem acento)
ALTER TABLE atividades ADD CONSTRAINT atividades_status_check 
  CHECK (status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'cancelado'::text]));

COMMENT ON COLUMN atividades.status IS 
'Status da atividade: pendente, concluido (sem acento), ou cancelado';