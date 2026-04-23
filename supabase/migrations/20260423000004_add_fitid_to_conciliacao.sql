/*
  Adiciona coluna fitid à conciliacao_bancaria para deduplicação de extratos OFX.
  O FITID é o ID único de cada transação no arquivo OFX do banco.
*/

ALTER TABLE public.conciliacao_bancaria
  ADD COLUMN IF NOT EXISTS fitid text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliacao_fitid_conta
  ON public.conciliacao_bancaria (fitid, conta_bancaria_id)
  WHERE fitid IS NOT NULL;
