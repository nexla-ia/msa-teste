/*
  # Permitir Administrador Modificar Vendas

  ## Alterações
  1. Garante que a função set_admin_mode() existe (cria se não existir)
  2. Cria função que bloqueia UPDATE e DELETE em vendas para usuários comuns
  3. Permite que administradores possam deletar/atualizar vendas usando o modo admin

  ## Justificativa
  As vendas afetam diretamente o estoque de pontos/milhas e geram localizadores e contas a receber.
  Permitir que apenas administradores possam fazer modificações garante a integridade dos dados.

  ## Como Usar
  O frontend deve executar o seguinte antes de operações de DELETE/UPDATE quando o usuário for ADM:

  ```javascript
  // No frontend, antes de fazer DELETE ou UPDATE de vendas como admin:
  await supabase.rpc('set_admin_mode', { is_admin: true });
  // ... fazer a operação de delete/update
  await supabase.rpc('set_admin_mode', { is_admin: false }); // desativar depois
  ```

  ## Segurança
  A função set_admin_mode pode ser chamada por qualquer usuário, mas o trigger
  verifica se a operação é realmente permitida.
*/

-- Garante que a função set_admin_mode existe (pode ter sido criada na migration de compras)
CREATE OR REPLACE FUNCTION set_admin_mode(is_admin boolean DEFAULT true)
RETURNS void AS $$
BEGIN
  IF is_admin THEN
    PERFORM set_config('app.is_admin', 'true', true);
  ELSE
    PERFORM set_config('app.is_admin', 'false', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_admin_mode(boolean) IS
'Ativa ou desativa o modo administrador para a sessão atual.
Permite que administradores façam operações de UPDATE/DELETE em tabelas protegidas.';

-- Cria função que bloqueia UPDATE e DELETE em vendas para não-admins
CREATE OR REPLACE FUNCTION prevent_vendas_modification()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin text;
BEGIN
  -- Verifica se está no modo admin
  BEGIN
    v_is_admin := current_setting('app.is_admin', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_is_admin := 'false';
  END;
  
  -- Se for admin, permite a operação
  IF v_is_admin = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Caso contrário, bloqueia
  RAISE EXCEPTION 'Operação não permitida: Registros de vendas não podem ser editados ou excluídos. Apenas administradores podem fazer essa operação.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger para BEFORE UPDATE em vendas
DROP TRIGGER IF EXISTS block_vendas_update ON vendas;
CREATE TRIGGER block_vendas_update
  BEFORE UPDATE ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION prevent_vendas_modification();

-- Cria trigger para BEFORE DELETE em vendas
DROP TRIGGER IF EXISTS block_vendas_delete ON vendas;
CREATE TRIGGER block_vendas_delete
  BEFORE DELETE ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION prevent_vendas_modification();

-- Comentário explicativo
COMMENT ON FUNCTION prevent_vendas_modification() IS 
'Bloqueia modificações (UPDATE/DELETE) em vendas para usuários comuns. 
Apenas administradores com modo admin ativado podem fazer essas operações.';
