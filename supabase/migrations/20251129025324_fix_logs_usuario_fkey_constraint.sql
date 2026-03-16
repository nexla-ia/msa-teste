/*
  # Corrige constraint de foreign key na tabela logs

  1. Alterações
    - Remove a constraint existente logs_usuario_id_fkey
    - Adiciona nova constraint com ON DELETE SET NULL
    - Permite que logs sejam mantidos mesmo após exclusão do usuário
    
  2. Segurança
    - Mantém integridade dos logs históricos
    - Permite exclusão de usuários sem perder histórico
    - usuario_nome continua disponível para identificação
*/

-- Remove a constraint existente
ALTER TABLE logs 
DROP CONSTRAINT IF EXISTS logs_usuario_id_fkey;

-- Adiciona nova constraint com ON DELETE SET NULL
ALTER TABLE logs 
ADD CONSTRAINT logs_usuario_id_fkey 
FOREIGN KEY (usuario_id) 
REFERENCES usuarios(id) 
ON DELETE SET NULL;