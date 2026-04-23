-- Permite vincular lançamento do extrato diretamente a uma venda
ALTER TABLE public.conciliacao_bancaria
  ADD COLUMN IF NOT EXISTS venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conciliacao_venda_id
  ON public.conciliacao_bancaria (venda_id)
  WHERE venda_id IS NOT NULL;

-- Flag para saber se a venda já foi conciliada com o banco
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vendas_nao_conciliadas
  ON public.vendas (conciliado)
  WHERE conciliado = false;
