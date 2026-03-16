/*
  # Adicionar permissões para recurso Atividades

  1. Alterações
    - Adicionar registro de permissão 'atividades' na tabela usuario_permissoes
    - Todos os usuários existentes receberão permissão de visualização
    - Usuários ADM terão permissões completas (visualizar, editar, deletar)

  2. Notas
    - O recurso 'atividades' permite acesso à página de notificações e atividades do sistema
*/

DO $$
DECLARE
  usuario_record RECORD;
  permissao_existe boolean;
BEGIN
  FOR usuario_record IN SELECT id, nivel_acesso FROM usuarios
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM usuario_permissoes 
      WHERE usuario_id = usuario_record.id 
      AND recurso = 'atividades'
    ) INTO permissao_existe;
    
    IF NOT permissao_existe THEN
      IF usuario_record.nivel_acesso = 'ADM' THEN
        INSERT INTO usuario_permissoes (
          usuario_id,
          recurso,
          pode_visualizar,
          pode_editar,
          pode_deletar
        ) VALUES (
          usuario_record.id,
          'atividades',
          true,
          true,
          true
        );
      ELSE
        INSERT INTO usuario_permissoes (
          usuario_id,
          recurso,
          pode_visualizar,
          pode_editar,
          pode_deletar
        ) VALUES (
          usuario_record.id,
          'atividades',
          true,
          false,
          false
        );
      END IF;
    END IF;
  END LOOP;
END $$;
