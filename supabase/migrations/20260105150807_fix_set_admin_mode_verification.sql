/*
  # Corrigir Verificação de Admin na Função set_admin_mode

  ## Problema
  A função set_admin_mode não estava verificando se o usuário é realmente admin,
  permitindo que qualquer usuário ativasse o modo admin.

  ## Solução
  1. Adiciona parâmetro usuario_id à função
  2. Verifica se o usuário tem nivel_acesso = 'ADM'
  3. Só permite ativar modo admin se for realmente admin
  
  ## Segurança
  Esta correção garante que apenas usuários com nivel_acesso = 'ADM' possam
  modificar registros protegidos.
*/

-- Função corrigida para ativar modo administrador
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
