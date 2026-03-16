/*
  # Criar trigger para deletar atividades quando clube for removido

  1. Função
    - `deletar_atividades_clube()` - Remove todas as atividades pendentes quando um registro de programas_clubes é deletado
  
  2. Trigger
    - Executa ANTES de deletar um registro de programas_clubes
    - Remove atividades com status 'pendente' vinculadas ao clube
  
  3. Comportamento
    - Deleta apenas atividades pendentes
    - Mantém histórico de atividades concluídas ou em andamento
*/

-- Função para deletar atividades relacionadas ao clube
CREATE OR REPLACE FUNCTION deletar_atividades_clube()
RETURNS TRIGGER AS $$
BEGIN
  -- Deletar todas as atividades pendentes relacionadas ao clube que está sendo deletado
  DELETE FROM atividades
  WHERE referencia_tabela = 'programas_clubes'
    AND referencia_id = OLD.id
    AND status = 'pendente'
    AND tipo_atividade IN ('clube_credito_mensal', 'clube_credito_bonus');
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para deletar atividades quando clube for removido
DROP TRIGGER IF EXISTS trigger_deletar_atividades_clube ON programas_clubes;
CREATE TRIGGER trigger_deletar_atividades_clube
  BEFORE DELETE ON programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION deletar_atividades_clube();

-- Grant permissions
GRANT EXECUTE ON FUNCTION deletar_atividades_clube() TO anon, authenticated;
