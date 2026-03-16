/*
  # Corrigir Constraints de Conta Família por Programa (v2)

  1. Problema Identificado
    - Constraint atual impede parceiro de ser membro de mais de 1 conta (qualquer programa)
    - Regra correta: parceiro pode ser membro de 1 conta POR PROGRAMA
    - Exemplo: pode ser membro de conta Livelo E conta LATAM (programas diferentes)
    - Mas NÃO pode ser membro de 2 contas Livelo (mesmo programa)

  2. Mudanças
    - Remover índice único antigo (parceiro_id, conta_familia_id)
    - Criar triggers para validar por programa
    - Atualizar triggers existentes para considerar apenas contas ativas

  3. Regras Finais
    - Titular: pode ser titular de 1 conta ATIVA por programa ✓
    - Membro: pode ser membro ATIVO de 1 conta por programa ✓
    - Titular não pode ser membro ATIVO do mesmo programa ✓
    - Membro ATIVO não pode ser titular de conta ATIVA do mesmo programa ✓
*/

-- Remover índice único antigo que estava muito restritivo
DROP INDEX IF EXISTS idx_conta_familia_membros_unique_parceiro_programa;

-- Atualizar função check_titular_nao_e_membro para verificar corretamente
CREATE OR REPLACE FUNCTION check_titular_nao_e_membro()
RETURNS TRIGGER AS $$
DECLARE
  v_programa_id uuid;
  v_conta_count integer;
BEGIN
  -- Só validar se o membro está ATIVO
  IF NEW.status != 'Ativo' THEN
    RETURN NEW;
  END IF;

  -- Busca o programa_id da conta família
  SELECT programa_id INTO v_programa_id
  FROM conta_familia
  WHERE id = NEW.conta_familia_id;
  
  -- Se não tem programa definido, permite
  IF v_programa_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se o parceiro é titular de alguma conta ATIVA deste programa
  SELECT COUNT(*) INTO v_conta_count
  FROM conta_familia
  WHERE parceiro_principal_id = NEW.parceiro_id
    AND programa_id = v_programa_id
    AND status = 'Ativa'
    AND id != NEW.conta_familia_id;
  
  IF v_conta_count > 0 THEN
    RAISE EXCEPTION 'Este parceiro já é titular de outra conta ativa deste programa e não pode ser membro adicional';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função check_membro_nao_e_titular para verificar corretamente
CREATE OR REPLACE FUNCTION check_membro_nao_e_titular()
RETURNS TRIGGER AS $$
DECLARE
  v_membro_count integer;
BEGIN
  -- Se não tem programa ou parceiro principal definido, permite
  IF NEW.programa_id IS NULL OR NEW.parceiro_principal_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Só validar se a conta está ATIVA
  IF NEW.status != 'Ativa' THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se o parceiro é membro ativo de alguma conta ATIVA deste programa
  SELECT COUNT(*) INTO v_membro_count
  FROM conta_familia_membros cfm
  JOIN conta_familia cf ON cfm.conta_familia_id = cf.id
  WHERE cfm.parceiro_id = NEW.parceiro_principal_id
    AND cf.programa_id = NEW.programa_id
    AND cf.status = 'Ativa'
    AND cfm.status = 'Ativo'
    AND cf.id != NEW.id;
  
  IF v_membro_count > 0 THEN
    RAISE EXCEPTION 'Este parceiro já é membro ativo de outra conta deste programa e não pode ser titular';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar função para validar se membro já existe em outra conta DO MESMO PROGRAMA
CREATE OR REPLACE FUNCTION check_membro_programa_duplicado()
RETURNS TRIGGER AS $$
DECLARE
  v_programa_id uuid;
  v_membro_count integer;
BEGIN
  -- Só validar se o membro está ATIVO
  IF NEW.status != 'Ativo' THEN
    RETURN NEW;
  END IF;

  -- Busca o programa_id da conta família onde está tentando adicionar
  SELECT programa_id INTO v_programa_id
  FROM conta_familia
  WHERE id = NEW.conta_familia_id;
  
  -- Se não tem programa definido, permite
  IF v_programa_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se o parceiro já é membro ativo de outra conta ATIVA deste mesmo programa
  SELECT COUNT(*) INTO v_membro_count
  FROM conta_familia_membros cfm
  JOIN conta_familia cf ON cfm.conta_familia_id = cf.id
  WHERE cfm.parceiro_id = NEW.parceiro_id
    AND cf.programa_id = v_programa_id
    AND cfm.status = 'Ativo'
    AND cf.status = 'Ativa'
    AND cfm.conta_familia_id != NEW.conta_familia_id;
  
  IF v_membro_count > 0 THEN
    RAISE EXCEPTION 'Este parceiro já é membro ativo de outra conta deste programa';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar duplicação de membro no mesmo programa
DROP TRIGGER IF EXISTS trigger_check_membro_programa_duplicado ON conta_familia_membros;

CREATE TRIGGER trigger_check_membro_programa_duplicado
BEFORE INSERT OR UPDATE ON conta_familia_membros
FOR EACH ROW
EXECUTE FUNCTION check_membro_programa_duplicado();

-- Comentários explicativos das regras
COMMENT ON FUNCTION check_titular_nao_e_membro() IS 
'Valida que um parceiro que é titular de uma conta ATIVA não pode ser membro ATIVO de outra conta do MESMO programa';

COMMENT ON FUNCTION check_membro_nao_e_titular() IS 
'Valida que um parceiro que é membro ATIVO não pode ser titular de conta ATIVA do MESMO programa';

COMMENT ON FUNCTION check_membro_programa_duplicado() IS 
'Valida que um parceiro só pode ser membro ATIVO de UMA conta por programa. Pode ser membro de contas de programas diferentes';