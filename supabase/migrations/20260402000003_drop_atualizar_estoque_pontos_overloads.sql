/*
  # Remover overloads antigos de atualizar_estoque_pontos

  ## Problema
  Existem múltiplas versões sobrecarregadas da função atualizar_estoque_pontos
  com diferentes assinaturas (5, 10 e 11 parâmetros). Ao chamar com 10 args,
  PostgreSQL não consegue resolver a ambiguidade entre a versão de 10 params
  e a de 11 params (que tem o último como DEFAULT) → "is not unique".

  ## Correção
  Dropar todas as versões antigas, mantendo apenas a de 11 parâmetros.
*/

-- Dropar versão original de 5 parâmetros
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, decimal, text, decimal);
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text, numeric);

-- Dropar versão de 10 parâmetros (sem p_data_operacao)
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, decimal, text, decimal, text, text, uuid, text, text);
DROP FUNCTION IF EXISTS atualizar_estoque_pontos(uuid, uuid, numeric, text, numeric, text, text, uuid, text, text);

-- Manter apenas a versão de 11 parâmetros (com p_data_operacao)
-- já definida em 20260330000010_data_operacao_tipo_date.sql
