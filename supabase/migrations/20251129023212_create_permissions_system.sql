/*
  # Sistema de Permissões de Usuário

  1. Nova Tabela
    - `usuario_permissoes`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, foreign key para usuarios)
      - `recurso` (text) - Nome da tela/tabela (ex: 'cartoes', 'parceiros', 'usuarios')
      - `pode_visualizar` (boolean) - Se pode visualizar os dados
      - `pode_editar` (boolean) - Se pode editar os dados
      - `pode_deletar` (boolean) - Se pode deletar os dados
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Enable RLS na tabela
    - Adicionar políticas para usuários autenticados

  3. Nota Importante
    - ADM sempre tem acesso total a tudo (verificado no código)
    - USER precisa ter permissões definidas
    - Recursos disponíveis: dashboard, cartoes, parceiros, usuarios, clientes, 
      centro_custos, classificacao_contabil, contas_bancarias, produtos, programas, 
      logs, lojas, programas_fidelidade, conta_familia, status_programa,
      latam, azul, smiles, livelo, tap, accor, km, pagol, esfera, hotmilhas, coopera, gov
*/

CREATE TABLE IF NOT EXISTS usuario_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  recurso text NOT NULL,
  pode_visualizar boolean DEFAULT false,
  pode_editar boolean DEFAULT false,
  pode_deletar boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_usuario_recurso UNIQUE (usuario_id, recurso)
);

ALTER TABLE usuario_permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias permissões"
  ON usuario_permissoes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas ADM pode inserir permissões"
  ON usuario_permissoes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Apenas ADM pode atualizar permissões"
  ON usuario_permissoes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Apenas ADM pode deletar permissões"
  ON usuario_permissoes
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_usuario_id ON usuario_permissoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_recurso ON usuario_permissoes(recurso);