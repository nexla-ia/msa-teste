/*
  # Criar storage bucket para documentos de vendas

  1. Novo Bucket
    - `vendas-documentos` - Bucket para armazenar PDFs de localizadores e outros documentos

  2. Políticas de Storage
    - Authenticated users podem fazer upload
    - Authenticated users podem visualizar
    - Authenticated users podem deletar
*/

-- Criar bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendas-documentos', 'vendas-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload de arquivos
CREATE POLICY "Authenticated users can upload vendas documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vendas-documentos');

-- Política para permitir visualização de arquivos
CREATE POLICY "Authenticated users can view vendas documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'vendas-documentos');

-- Política para permitir exclusão de arquivos
CREATE POLICY "Authenticated users can delete vendas documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vendas-documentos');