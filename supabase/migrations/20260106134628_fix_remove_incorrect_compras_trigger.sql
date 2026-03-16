/*
  # Remover trigger incorreto de compras

  ## Problema
  O trigger `trigger_compras_estoque` estava tentando inserir dados na tabela
  `estoque_pontos` como se fosse uma tabela de histórico, mas ela é apenas
  para saldo consolidado.

  ## Solução
  - Remove a função `adicionar_pontos_compra_ao_estoque()`
  - Remove o trigger `trigger_compras_estoque`
  - Os triggers existentes `trigger_atualizar_estoque_compras_*` já fazem
    o trabalho correto de atualizar o saldo no estoque

  ## Funcionamento Correto
  - Quando uma compra é inserida, `trigger_atualizar_estoque_compras_insert`
    atualiza automaticamente o saldo e custo médio em `estoque_pontos`
  - O histórico é mantido através das próprias tabelas de movimentação
    (compras, vendas, transferencias, etc)
*/

-- Remove o trigger incorreto
DROP TRIGGER IF EXISTS trigger_compras_estoque ON compras;

-- Remove a função incorreta
DROP FUNCTION IF EXISTS adicionar_pontos_compra_ao_estoque();