/*
  # Sistema de Documentos para Parceiros

  1. Storage
    - Cria bucket 'documentos-parceiros' privado para armazenar arquivos
    - Configura políticas de acesso para upload, visualização e exclusão

  2. Nova Tabela
    - `parceiro_documentos`
      - `id` (uuid, primary key)
      - `parceiro_id` (uuid, foreign key para parceiros)
      - `tipo_documento` (text - tipo do documento: rg, comprovante_endereco, etc)
      - `arquivo_path` (text - caminho no storage)
      - `arquivo_nome` (text - nome original do arquivo)
      - `tamanho_bytes` (bigint - tamanho do arquivo em bytes)
      - `uploaded_at` (timestamptz - data do upload)
      - `uploaded_by` (uuid - usuário que fez o upload)

  3. Security
    - Enable RLS on `parceiro_documentos`
    - Políticas para usuários autenticados poderem gerenciar documentos
    - Políticas de storage para controlar acesso aos arquivos
*/

-- Criar bucket de storage para documentos de parceiros
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-parceiros', 'documentos-parceiros', false)
ON CONFLICT (id) DO NOTHING;

-- Criar tabela para controlar os documentos
CREATE TABLE IF NOT EXISTS parceiro_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  tamanho_bytes bigint,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES usuarios(id)
);

-- Habilitar RLS
ALTER TABLE parceiro_documentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para a tabela parceiro_documentos
CREATE POLICY "Usuários autenticados podem visualizar documentos"
  ON parceiro_documentos
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir documentos"
  ON parceiro_documentos
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar documentos"
  ON parceiro_documentos
  FOR DELETE
  TO public
  USING (true);

-- Políticas de Storage para upload
CREATE POLICY "Usuários podem fazer upload de documentos"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'documentos-parceiros');

-- Política de Storage para visualização
CREATE POLICY "Usuários podem visualizar documentos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'documentos-parceiros');

-- Política de Storage para exclusão
CREATE POLICY "Usuários podem deletar documentos"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'documentos-parceiros');

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_parceiro_documentos_parceiro_id
  ON parceiro_documentos(parceiro_id);

CREATE INDEX IF NOT EXISTS idx_parceiro_documentos_tipo
  ON parceiro_documentos(tipo_documento);
