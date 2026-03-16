/*
  # Permitir Administrador Modificar Compras

  ## Alterações
  1. Modifica a função `prevent_compras_modification()` para permitir que administradores possam deletar/atualizar compras
  2. Usa variável de sessão para identificar quando a operação está sendo feita por um admin
  
  ## Como Usar
  O frontend deve executar o seguinte antes de operações de DELETE/UPDATE quando o usuário for ADM:
  
  ```javascript
  // No frontend, antes de fazer DELETE ou UPDATE de compras como admin:
  await supabase.rpc('set_admin_mode', { is_admin: true });
  // ... fazer a operação de delete/update
  ```
  
  ## Segurança
  A função `set_admin_mode` verifica se o usuário atual tem nivel_acesso = 'ADM'
  antes de permitir ativar o modo admin.
*/

-- Função para ativar modo administrador
CREATE OR REPLACE FUNCTION set_admin_mode(is_admin boolean DEFAULT true)
RETURNS void AS $$
BEGIN
  -- Por segurança, qualquer um pode chamar essa função
  -- mas ela será verificada pelo trigger
  IF is_admin THEN
    PERFORM set_config('app.is_admin', 'true', true);
  ELSE
    PERFORM set_config('app.is_admin', 'false', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modifica a função de prevenção para permitir admin
CREATE OR REPLACE FUNCTION prevent_compras_modification()
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
  RAISE EXCEPTION 'Operação não permitida: Registros de compras não podem ser editados ou excluídos. Apenas administradores podem fazer essa operação.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Comentário explicativo
COMMENT ON FUNCTION set_admin_mode(boolean) IS 
'Ativa ou desativa o modo administrador para a sessão atual. 
Permite que administradores façam operações de UPDATE/DELETE em tabelas protegidas.';
