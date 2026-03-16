/*
  # Create User Profiles System

  1. New Tables
    - `perfis_usuario`
      - `id` (uuid, primary key)
      - `nome` (text) - Profile name
      - `descricao` (text) - Profile description
      - `ativo` (boolean) - Active status
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `perfil_permissoes`
      - `id` (uuid, primary key)
      - `perfil_id` (uuid) - References perfis_usuario
      - `recurso` (text) - Resource name
      - `pode_visualizar` (boolean)
      - `pode_editar` (boolean)
      - `pode_deletar` (boolean)

  2. Changes
    - Add `perfil_id` column to `usuarios` table to link users to profiles
    - Users with nivel_acesso = 'ADM' don't need profiles
    - Users with nivel_acesso = 'USER' can have a profile

  3. Security
    - Enable RLS on both new tables
    - Add policies for authenticated users to manage profiles
*/

-- Create perfis_usuario table
CREATE TABLE IF NOT EXISTS perfis_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text DEFAULT '',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create perfil_permissoes table
CREATE TABLE IF NOT EXISTS perfil_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES perfis_usuario(id) ON DELETE CASCADE,
  recurso text NOT NULL,
  pode_visualizar boolean DEFAULT false,
  pode_editar boolean DEFAULT false,
  pode_deletar boolean DEFAULT false,
  UNIQUE(perfil_id, recurso)
);

-- Add perfil_id to usuarios table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'perfil_id'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN perfil_id uuid REFERENCES perfis_usuario(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE perfis_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfil_permissoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for perfis_usuario
CREATE POLICY "Anyone can read perfis_usuario"
  ON perfis_usuario FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can insert perfis_usuario"
  ON perfis_usuario FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update perfis_usuario"
  ON perfis_usuario FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete perfis_usuario"
  ON perfis_usuario FOR DELETE
  TO authenticated, anon
  USING (true);

-- RLS Policies for perfil_permissoes
CREATE POLICY "Anyone can read perfil_permissoes"
  ON perfil_permissoes FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can insert perfil_permissoes"
  ON perfil_permissoes FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update perfil_permissoes"
  ON perfil_permissoes FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete perfil_permissoes"
  ON perfil_permissoes FOR DELETE
  TO authenticated, anon
  USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_perfil_permissoes_perfil_id ON perfil_permissoes(perfil_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil_id ON usuarios(perfil_id);
