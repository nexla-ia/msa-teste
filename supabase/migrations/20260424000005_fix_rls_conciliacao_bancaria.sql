/*
  # Fix RLS conciliacao_bancaria

  A tabela conciliacao_bancaria tem RLS ativo mas sem políticas de INSERT/UPDATE/DELETE,
  bloqueando a importação de extratos OFX.
*/

DROP POLICY IF EXISTS "Permitir leitura conciliacao"    ON public.conciliacao_bancaria;
DROP POLICY IF EXISTS "Permitir inserção conciliacao"   ON public.conciliacao_bancaria;
DROP POLICY IF EXISTS "Permitir atualização conciliacao" ON public.conciliacao_bancaria;
DROP POLICY IF EXISTS "Permitir exclusão conciliacao"   ON public.conciliacao_bancaria;

CREATE POLICY "Permitir leitura conciliacao"
  ON public.conciliacao_bancaria FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Permitir inserção conciliacao"
  ON public.conciliacao_bancaria FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização conciliacao"
  ON public.conciliacao_bancaria FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão conciliacao"
  ON public.conciliacao_bancaria FOR DELETE
  TO anon, authenticated USING (true);
