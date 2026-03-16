/*
  # Atualizar trigger para deletar TODAS as atividades relacionadas ao clube
  
  1. Descrição
    - Quando um registro de programas_clubes é deletado, remove TODAS as atividades pendentes relacionadas
    - Incluindo: créditos mensais, bônus, lembretes de milhas e downgrade/upgrade
  
  2. Tipos de Atividades Removidos
    - clube_credito_mensal
    - clube_credito_bonus
    - lembrete_milhas_expirando
    - lembrete_downgrade
  
  3. Comportamento
    - Remove apenas atividades com status 'pendente'
    - Mantém histórico de atividades já processadas
*/

-- Recriar função com todos os tipos de atividades
CREATE OR REPLACE FUNCTION deletar_atividades_clube()
RETURNS TRIGGER AS $$
BEGIN
  -- Deletar TODAS as atividades pendentes relacionadas ao clube que está sendo deletado
  DELETE FROM atividades
  WHERE referencia_tabela = 'programas_clubes'
    AND referencia_id = OLD.id
    AND status = 'pendente';
  
  -- Log para debug (opcional)
  RAISE NOTICE 'Atividades pendentes do clube % foram removidas', OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_deletar_atividades_clube ON programas_clubes;
CREATE TRIGGER trigger_deletar_atividades_clube
  BEFORE DELETE ON programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION deletar_atividades_clube();

-- Grant permissions
GRANT EXECUTE ON FUNCTION deletar_atividades_clube() TO anon, authenticated;

COMMENT ON FUNCTION deletar_atividades_clube() IS 
'Remove todas as atividades pendentes relacionadas a um clube quando ele é deletado. Mantém histórico de atividades já processadas.';