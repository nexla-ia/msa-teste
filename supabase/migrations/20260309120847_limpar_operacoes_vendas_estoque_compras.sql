
/*
  # Limpar operações de vendas, estoque e compras

  Remove todos os registros operacionais:
  - contas_receber
  - contas_a_pagar
  - localizadores
  - vendas (com admin mode)
  - estoque_movimentacoes
  - estoque_pontos
  - compra_bonificada
  - compras
  - transferencia_pontos
  - transferencia_pessoas
  - conta_familia_historico
*/

DO $$
BEGIN
  PERFORM set_config('app.is_admin', 'true', true);

  DELETE FROM contas_receber;
  DELETE FROM contas_a_pagar;
  DELETE FROM localizadores;
  DELETE FROM vendas;
  DELETE FROM estoque_movimentacoes;
  DELETE FROM estoque_pontos;
  DELETE FROM compra_bonificada;
  DELETE FROM compras;
  DELETE FROM transferencia_pontos;
  DELETE FROM transferencia_pessoas;
  DELETE FROM conta_familia_historico;

  PERFORM set_config('app.is_admin', 'false', true);
END $$;
