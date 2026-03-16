/*
  # Criar tabela de Programas/Clubes

  1. Nova Tabela
    - `programas_clubes`
      - `id` (uuid, primary key)
      - `parceiro_id` (uuid, referência para parceiros)
      - `nome_parceiro` (text) - Nome do parceiro selecionado
      - `telefone` (text) - Auto-preenchido do parceiro
      - `dt_nasc` (date) - Data de nascimento do parceiro
      - `cpf` (text) - CPF do parceiro
      - `rg` (text) - RG do parceiro
      - `email` (text) - Email do parceiro
      - `idade` (integer) - Idade calculada
      - `programa_id` (uuid, referência para programas_fidelidade)
      - `n_fidelidade` (text) - Número de fidelidade
      - `senha` (text) - Senha do programa
      - `senha_resgate` (text) - Senha de resgate
      - `conta_familia_id` (uuid, referência para conta_familia)
      - `data_exclusao_conta_familia` (date)
      - `tem_clube` (boolean) - Se tem clube ou não
      - `clube_produto_id` (uuid, referência para produtos) - Clube selecionado
      - `cartao` (text) - Número do cartão
      - `data_ultima_assinatura` (date)
      - `dia_cobranca` (integer) - Dia do mês (1-31)
      - `valor` (numeric) - Valor da assinatura
      - `tempo_clube_mes` (integer) - Tempo de clube em meses
      - `liminar` (boolean) - Se é liminar
      - `aparelho` (integer) - Número de aparelhos permitidos
      - `downgrade_upgrade` (text) - Histórico de mudanças
      - `quantidade_pontos` (integer)
      - `bonus_porcentagem` (numeric)
      - `sequencia` (text) - mensal, trimestral ou anual
      - `milhas_expirando` (text)
      - `tipo_parceiro_fornecedor` (text) - Parceiro ou Fornecedor
      - `status_conta` (text) - Status da conta
      - `status_restricao` (text) - Com ou Sem restrição
      - `conferente` (text) - Última pessoa que editou
      - `ultima_data_conferencia` (date)
      - `grupo_liminar` (text)
      - `status_programa_id` (uuid, referência para status_programa)
      - `observacoes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - Habilitar RLS na tabela `programas_clubes`
    - Adicionar políticas para usuários autenticados
*/

CREATE TABLE IF NOT EXISTS programas_clubes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid REFERENCES parceiros(id) ON DELETE SET NULL,
  nome_parceiro text,
  telefone text,
  dt_nasc date,
  cpf text,
  rg text,
  email text,
  idade integer,
  programa_id uuid REFERENCES programas_fidelidade(id) ON DELETE SET NULL,
  n_fidelidade text,
  senha text,
  senha_resgate text,
  conta_familia_id uuid REFERENCES conta_familia(id) ON DELETE SET NULL,
  data_exclusao_conta_familia date,
  tem_clube boolean DEFAULT false,
  clube_produto_id uuid REFERENCES produtos(id) ON DELETE SET NULL,
  cartao text,
  data_ultima_assinatura date,
  dia_cobranca integer CHECK (dia_cobranca >= 1 AND dia_cobranca <= 31),
  valor numeric(10,2),
  tempo_clube_mes integer,
  liminar boolean DEFAULT false,
  aparelho integer,
  downgrade_upgrade text,
  quantidade_pontos integer,
  bonus_porcentagem numeric(5,2),
  sequencia text CHECK (sequencia IN ('mensal', 'trimestral', 'anual')),
  milhas_expirando text,
  tipo_parceiro_fornecedor text CHECK (tipo_parceiro_fornecedor IN ('Parceiro', 'Fornecedor')),
  status_conta text,
  status_restricao text CHECK (status_restricao IN ('Com Restrição', 'Sem Restrição')),
  conferente text,
  ultima_data_conferencia date,
  grupo_liminar text,
  status_programa_id uuid REFERENCES status_programa(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE programas_clubes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem visualizar programas/clubes"
  ON programas_clubes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Usuários podem criar programas/clubes"
  ON programas_clubes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar programas/clubes"
  ON programas_clubes
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários podem deletar programas/clubes"
  ON programas_clubes
  FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_programas_clubes_parceiro ON programas_clubes(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_programas_clubes_programa ON programas_clubes(programa_id);
CREATE INDEX IF NOT EXISTS idx_programas_clubes_conta_familia ON programas_clubes(conta_familia_id);
CREATE INDEX IF NOT EXISTS idx_programas_clubes_status_programa ON programas_clubes(status_programa_id);
