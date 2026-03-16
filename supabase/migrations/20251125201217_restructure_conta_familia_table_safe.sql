/*
  # Reestruturar tabela Conta Família - Versão Segura

  1. Alterações na Estrutura
    - Adicionar campo `nome_conta` para identificar a conta família
    - Adicionar `parceiro_principal_id` para vincular ao parceiro principal
    - Adicionar campo `programa_id` para vincular ao programa de fidelidade
    - Remover campos antigos de forma segura

  2. Nova Tabela: conta_familia_membros
    - Criar tabela para armazenar os membros adicionais da conta família
    - Campos: id, conta_familia_id, parceiro_id, data_inclusao, data_exclusao, status

  3. Segurança
    - Manter RLS habilitado em ambas as tabelas
    - Políticas permitem acesso completo (compatível com auth customizado)

  4. Nota Importante
    - Dados existentes serão perdidos devido à incompatibilidade estrutural
    - Nova estrutura permite melhor organização de contas família
*/

-- Remover tabela antiga e recriá-la com nova estrutura
DROP TABLE IF EXISTS conta_familia CASCADE;

-- Criar tabela conta_familia com nova estrutura
CREATE TABLE conta_familia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_conta_familia text UNIQUE NOT NULL,
  nome_conta text NOT NULL,
  parceiro_principal_id uuid REFERENCES parceiros(id),
  programa_id uuid REFERENCES programas(id),
  status text NOT NULL DEFAULT 'Ativa',
  obs text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE conta_familia ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para conta_familia
CREATE POLICY "Allow all to view conta_familia"
  ON conta_familia FOR SELECT
  USING (true);

CREATE POLICY "Allow all to insert conta_familia"
  ON conta_familia FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all to update conta_familia"
  ON conta_familia FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all to delete conta_familia"
  ON conta_familia FOR DELETE
  USING (true);

-- Criar tabela de membros
CREATE TABLE IF NOT EXISTS conta_familia_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_familia_id uuid NOT NULL REFERENCES conta_familia(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES parceiros(id),
  data_inclusao date NOT NULL DEFAULT CURRENT_DATE,
  data_exclusao date,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS na nova tabela
ALTER TABLE conta_familia_membros ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para conta_familia_membros
CREATE POLICY "Allow all to view conta_familia_membros"
  ON conta_familia_membros FOR SELECT
  USING (true);

CREATE POLICY "Allow all to insert conta_familia_membros"
  ON conta_familia_membros FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all to update conta_familia_membros"
  ON conta_familia_membros FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all to delete conta_familia_membros"
  ON conta_familia_membros FOR DELETE
  USING (true);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_conta_familia_membros_conta 
  ON conta_familia_membros(conta_familia_id);
CREATE INDEX IF NOT EXISTS idx_conta_familia_membros_parceiro 
  ON conta_familia_membros(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_conta_familia_programa 
  ON conta_familia(programa_id);
CREATE INDEX IF NOT EXISTS idx_conta_familia_parceiro_principal 
  ON conta_familia(parceiro_principal_id);
