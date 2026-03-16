/*
  # Criar Função para Limpar Tabelas de Movimentações

  ## Descrição
  Cria uma função administrativa que permite limpar todas as tabelas de movimentações
  de uma só vez, mas apenas se o usuário for admin.

  ## Tabelas Afetadas
  - compras
  - vendas
  - compra_bonificada
  - transferencia_pontos
  - transferencia_pessoas
  - estoque_pontos

  ## Segurança
  A função verifica se o usuário tem nivel_acesso = 'ADM' antes de executar.
*/

CREATE OR REPLACE FUNCTION limpar_movimentacoes(usuario_id uuid)
RETURNS json AS $$
DECLARE
  v_nivel_acesso text;
  v_compras_count int;
  v_vendas_count int;
  v_compra_bonificada_count int;
  v_transferencia_pontos_count int;
  v_transferencia_pessoas_count int;
  v_estoque_count int;
  v_result json;
BEGIN
  -- Verifica o nível de acesso do usuário
  SELECT nivel_acesso INTO v_nivel_acesso
  FROM usuarios
  WHERE id = usuario_id;
  
  -- Se o usuário não for encontrado ou não for admin, não permite
  IF v_nivel_acesso IS NULL OR v_nivel_acesso != 'ADM' THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta operação.';
  END IF;
  
  -- Conta registros antes de deletar
  SELECT COUNT(*) INTO v_compras_count FROM compras;
  SELECT COUNT(*) INTO v_vendas_count FROM vendas;
  SELECT COUNT(*) INTO v_compra_bonificada_count FROM compra_bonificada;
  SELECT COUNT(*) INTO v_transferencia_pontos_count FROM transferencia_pontos;
  SELECT COUNT(*) INTO v_transferencia_pessoas_count FROM transferencia_pessoas;
  SELECT COUNT(*) INTO v_estoque_count FROM estoque_pontos;
  
  -- Ativa modo admin para a sessão
  PERFORM set_config('app.is_admin', 'true', true);
  
  -- Deleta todos os registros das tabelas (ordem inversa de dependências)
  DELETE FROM transferencia_pessoas;
  DELETE FROM transferencia_pontos;
  DELETE FROM vendas;
  DELETE FROM compra_bonificada;
  DELETE FROM compras;
  DELETE FROM estoque_pontos;
  
  -- Desativa modo admin
  PERFORM set_config('app.is_admin', 'false', true);
  
  -- Retorna resumo
  v_result := json_build_object(
    'sucesso', true,
    'registros_removidos', json_build_object(
      'compras', v_compras_count,
      'vendas', v_vendas_count,
      'compra_bonificada', v_compra_bonificada_count,
      'transferencia_pontos', v_transferencia_pontos_count,
      'transferencia_pessoas', v_transferencia_pessoas_count,
      'estoque_pontos', v_estoque_count
    )
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION limpar_movimentacoes(uuid) IS 
'Limpa todas as tabelas de movimentações (compras, vendas, estoque, transferências).
Apenas administradores podem executar esta função.
Retorna um JSON com o número de registros removidos de cada tabela.';
