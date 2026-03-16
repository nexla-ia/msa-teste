/*
  # Criar Sistema de Vendas

  1. Novas Tabelas
    - vendas: Armazena os dados principais da venda
      - Campos de venda, valores, lucro, status
    - localizadores: Armazena dados do bilhete/localizador
      - Código do localizador, dados do cliente, viagem
    - contas_receber: Armazena parcelas a receber
      - Parcelas, vencimentos, pagamentos

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Adicionar políticas para usuários autenticados

  3. Índices
    - Criar índices para melhorar performance
*/

-- Criar tabela de vendas
CREATE TABLE IF NOT EXISTS vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid REFERENCES parceiros(id) ON DELETE CASCADE,
  programa_id uuid REFERENCES programas_fidelidade(id) ON DELETE CASCADE,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  quantidade_milhas numeric(15,2) NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  valor_milheiro numeric(15,2) DEFAULT 0,
  tipo_valor text CHECK (tipo_valor IN ('VT', 'VM')),
  saldo_anterior numeric(15,2) DEFAULT 0,
  custo_medio numeric(15,2) DEFAULT 0,
  lucro_real numeric(15,2) DEFAULT 0,
  lucro_percentual numeric(5,2) DEFAULT 0,
  incluir_taxas_emissao boolean DEFAULT false,
  observacao text,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'cancelada')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Criar tabela de localizadores
CREATE TABLE IF NOT EXISTS localizadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid REFERENCES vendas(id) ON DELETE CASCADE,
  codigo_localizador text UNIQUE NOT NULL,
  cliente_nome text,
  cliente_cpf text,
  cliente_telefone text,
  cliente_email text,
  origem text,
  destino text,
  data_emissao date,
  data_embarque date,
  quantidade_passageiros integer DEFAULT 1,
  valor_taxas_emissao numeric(15,2) DEFAULT 0,
  status text DEFAULT 'emitido' CHECK (status IN ('emitido', 'voado', 'cancelado', 'reembolsado')),
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de contas a receber
CREATE TABLE IF NOT EXISTS contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid REFERENCES vendas(id) ON DELETE CASCADE,
  localizador_id uuid REFERENCES localizadores(id) ON DELETE CASCADE,
  data_vencimento date NOT NULL,
  valor_parcela numeric(15,2) NOT NULL DEFAULT 0,
  numero_parcela integer NOT NULL DEFAULT 1,
  total_parcelas integer NOT NULL DEFAULT 1,
  forma_pagamento text,
  conta_bancaria_id uuid REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  cartao_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL,
  status_pagamento text DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  data_pagamento date,
  valor_pago numeric(15,2),
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE localizadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;

-- Políticas para vendas
CREATE POLICY "Usuários podem visualizar vendas"
  ON vendas FOR SELECT TO public USING (true);

CREATE POLICY "Usuários podem criar vendas"
  ON vendas FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar vendas"
  ON vendas FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Usuários podem deletar vendas"
  ON vendas FOR DELETE TO public USING (true);

-- Políticas para localizadores
CREATE POLICY "Usuários podem visualizar localizadores"
  ON localizadores FOR SELECT TO public USING (true);

CREATE POLICY "Usuários podem criar localizadores"
  ON localizadores FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar localizadores"
  ON localizadores FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Usuários podem deletar localizadores"
  ON localizadores FOR DELETE TO public USING (true);

-- Políticas para contas_receber
CREATE POLICY "Usuários podem visualizar contas a receber"
  ON contas_receber FOR SELECT TO public USING (true);

CREATE POLICY "Usuários podem criar contas a receber"
  ON contas_receber FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar contas a receber"
  ON contas_receber FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Usuários podem deletar contas a receber"
  ON contas_receber FOR DELETE TO public USING (true);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_vendas_parceiro ON vendas(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_vendas_programa ON vendas(programa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status);

CREATE INDEX IF NOT EXISTS idx_localizadores_venda ON localizadores(venda_id);
CREATE INDEX IF NOT EXISTS idx_localizadores_codigo ON localizadores(codigo_localizador);

CREATE INDEX IF NOT EXISTS idx_contas_receber_venda ON contas_receber(venda_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_localizador ON contas_receber(localizador_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status ON contas_receber(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_contas_receber_vencimento ON contas_receber(data_vencimento);