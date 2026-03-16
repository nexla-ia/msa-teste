
/*
  # Forçar limpeza de todas as operações

  Desabilita os triggers de bloqueio de vendas, limpa tudo e reabilita.
*/

DO $$
BEGIN
  PERFORM set_config('app.is_admin', 'true', true);

  ALTER TABLE vendas DISABLE TRIGGER prevent_vendas_modification;
  ALTER TABLE vendas DISABLE TRIGGER reverter_venda_trigger;
  ALTER TABLE vendas DISABLE TRIGGER processar_venda_trigger;
  ALTER TABLE vendas DISABLE TRIGGER decrementar_cpf_ao_deletar_venda;

  DELETE FROM localizadores;
  DELETE FROM contas_receber;
  DELETE FROM contas_a_pagar;
  DELETE FROM vendas;
  DELETE FROM estoque_movimentacoes;
  DELETE FROM estoque_pontos;
  DELETE FROM compra_bonificada;
  DELETE FROM compras;
  DELETE FROM transferencia_pontos;
  DELETE FROM transferencia_pessoas;
  DELETE FROM conta_familia_historico;

  ALTER TABLE vendas ENABLE TRIGGER prevent_vendas_modification;
  ALTER TABLE vendas ENABLE TRIGGER reverter_venda_trigger;
  ALTER TABLE vendas ENABLE TRIGGER processar_venda_trigger;
  ALTER TABLE vendas ENABLE TRIGGER decrementar_cpf_ao_deletar_venda;

  PERFORM set_config('app.is_admin', 'false', true);
END $$;
