/*
  # Corrigir Função set_admin_mode - Remover Versão Antiga

  ## Problema
  A função antiga set_admin_mode(boolean) ainda existe no banco,
  causando conflito com a nova versão set_admin_mode(uuid, boolean).
  
  ## Solução
  1. Remove a função antiga explicitamente
  2. Recria a nova versão com verificação de admin
  
  ## Segurança
  Garante que apenas a versão correta da função existe e funciona.
*/

-- Remove a função antiga que só tinha 1 parâmetro
DROP FUNCTION IF EXISTS set_admin_mode(boolean);

-- Recria a função correta com verificação de admin
CREATE OR REPLACE FUNCTION set_admin_mode(usuario_id uuid, is_admin boolean DEFAULT true)
RETURNS void AS $$
DECLARE
  v_nivel_acesso text;
BEGIN
  -- Verifica o nível de acesso do usuário
  SELECT nivel_acesso INTO v_nivel_acesso
  FROM usuarios
  WHERE id = usuario_id;
  
  -- Se o usuário não for encontrado ou não for admin, não permite
  IF v_nivel_acesso IS NULL OR v_nivel_acesso != 'ADM' THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta operação.';
  END IF;
  
  -- Se passou na verificação e is_admin é true, ativa o modo admin
  IF is_admin THEN
    PERFORM set_config('app.is_admin', 'true', true);
  ELSE
    PERFORM set_config('app.is_admin', 'false', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_admin_mode(uuid, boolean) IS 
'Ativa ou desativa o modo administrador para a sessão atual. 
Verifica se o usuário tem nivel_acesso = ADM antes de permitir.
Permite que administradores façam operações de UPDATE/DELETE em tabelas protegidas.';
