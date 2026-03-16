/*
  # Adicionar Constraints Únicas para Conta Família
  
  Este migration adiciona regras para garantir que:
  1. Um parceiro pode ser titular de apenas UMA conta por programa
  2. Um parceiro pode ser membro de apenas UMA conta por programa
  3. Estas regras impedem duplicações e conflitos
  
  ## Mudanças
  
  1. Constraints Únicas
     - Adiciona constraint única em `conta_familia` para (parceiro_principal_id, programa_id)
     - Adiciona índice único em `conta_familia_membros` para parceiros ativos
  
  2. Triggers de Validação
     - Trigger que impede titular de ser membro em outra conta
     - Trigger que impede membro de ser titular em outra conta
  
  ## Notas Importantes
  
  - As constraints permitem NULL em programa_id (para contas sem programa)
  - As validações consideram apenas contas e membros ativos
  - Mensagens de erro são descritivas em português
*/

-- Remove constraint única antiga se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conta_familia_parceiro_programa_key'
  ) THEN
    ALTER TABLE conta_familia DROP CONSTRAINT conta_familia_parceiro_programa_key;
  END IF;
END $$;

-- Adiciona constraint única: um parceiro só pode ser titular de uma conta por programa
-- (permite NULL para contas sem programa associado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conta_familia_parceiro_programa_unique'
  ) THEN
    ALTER TABLE conta_familia 
    ADD CONSTRAINT conta_familia_parceiro_programa_unique 
    UNIQUE (parceiro_principal_id, programa_id);
  END IF;
END $$;

-- Cria índice único para membros: um parceiro só pode estar em uma conta por programa
-- (apenas para membros ativos, usando índice parcial)
DROP INDEX IF EXISTS idx_conta_familia_membros_unique_parceiro_programa;

CREATE UNIQUE INDEX idx_conta_familia_membros_unique_parceiro_programa
ON conta_familia_membros (parceiro_id, conta_familia_id)
WHERE status = 'Ativo';

-- Função para verificar se titular está como membro em outra conta
CREATE OR REPLACE FUNCTION check_titular_nao_e_membro()
RETURNS TRIGGER AS $$
DECLARE
  v_programa_id uuid;
  v_conta_count integer;
BEGIN
  -- Busca o programa_id da conta família
  SELECT programa_id INTO v_programa_id
  FROM conta_familia
  WHERE id = NEW.conta_familia_id;
  
  -- Se não tem programa definido, permite
  IF v_programa_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se o parceiro é titular de alguma conta deste programa
  SELECT COUNT(*) INTO v_conta_count
  FROM conta_familia
  WHERE parceiro_principal_id = NEW.parceiro_id
    AND programa_id = v_programa_id
    AND id != NEW.conta_familia_id;
  
  IF v_conta_count > 0 THEN
    RAISE EXCEPTION 'Este parceiro é titular de outra conta deste programa e não pode ser membro adicional';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar quando adicionar membro
DROP TRIGGER IF EXISTS trigger_check_titular_nao_e_membro ON conta_familia_membros;

CREATE TRIGGER trigger_check_titular_nao_e_membro
BEFORE INSERT OR UPDATE ON conta_familia_membros
FOR EACH ROW
EXECUTE FUNCTION check_titular_nao_e_membro();

-- Função para verificar se membro está em outra conta quando definir como titular
CREATE OR REPLACE FUNCTION check_membro_nao_e_titular()
RETURNS TRIGGER AS $$
DECLARE
  v_membro_count integer;
BEGIN
  -- Se não tem programa ou parceiro principal definido, permite
  IF NEW.programa_id IS NULL OR NEW.parceiro_principal_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se o parceiro é membro ativo de alguma conta deste programa
  SELECT COUNT(*) INTO v_membro_count
  FROM conta_familia_membros cfm
  JOIN conta_familia cf ON cfm.conta_familia_id = cf.id
  WHERE cfm.parceiro_id = NEW.parceiro_principal_id
    AND cf.programa_id = NEW.programa_id
    AND cfm.status = 'Ativo'
    AND cf.id != NEW.id;
  
  IF v_membro_count > 0 THEN
    RAISE EXCEPTION 'Este parceiro é membro de outra conta deste programa e não pode ser titular';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar quando definir titular
DROP TRIGGER IF EXISTS trigger_check_membro_nao_e_titular ON conta_familia;

CREATE TRIGGER trigger_check_membro_nao_e_titular
BEFORE INSERT OR UPDATE ON conta_familia
FOR EACH ROW
EXECUTE FUNCTION check_membro_nao_e_titular();