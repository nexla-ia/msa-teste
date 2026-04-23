ALTER TABLE public.controle_emissoes
  ADD COLUMN IF NOT EXISTS venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_controle_emissoes_venda_id
  ON public.controle_emissoes (venda_id)
  WHERE venda_id IS NOT NULL;
