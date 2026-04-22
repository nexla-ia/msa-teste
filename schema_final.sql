-- Schema limpo MSA — gerado em 2026-04-15T12:52:29.811Z
-- Cole este arquivo no SQL Editor do Supabase do cliente e execute.

-- EXTENSIONS
-- pg_graphql é gerenciada pelo Supabase automaticamente
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- supabase_vault é gerenciada pelo Supabase automaticamente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABELAS

CREATE TABLE IF NOT EXISTS public.atividades (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tipo_atividade text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  parceiro_id uuid,
  parceiro_nome text,
  programa_id uuid,
  programa_nome text,
  quantidade_pontos numeric(15,2),
  data_prevista date NOT NULL,
  status text DEFAULT 'pendente'::text,
  referencia_id uuid,
  referencia_tabela text,
  prioridade text DEFAULT 'normal'::text,
  processado_em timestamp with time zone,
  processado_por uuid,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tipo_lembrete text,
  descricao_completa text,
  pode_excluir boolean DEFAULT true,
  data_conclusao timestamp with time zone,
  concluido_por uuid,
  usuario_id uuid,
  valor numeric(15,2),
  PRIMARY KEY (id),
  CONSTRAINT atividades_prioridade_check CHECK ((prioridade = ANY (ARRAY['baixa'::text, 'média'::text, 'alta'::text, 'normal'::text]))),
  CONSTRAINT atividades_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'cancelado'::text]))),
  CONSTRAINT atividades_tipo_atividade_check CHECK ((tipo_atividade = ANY (ARRAY['clube_credito_mensal'::text, 'clube_credito_manual'::text, 'clube_primeiro_credito'::text, 'clube_credito_bonus'::text, 'clube_credito_bonus_manual'::text, 'clube_credito_retroativo'::text, 'clube_credito_bonus_retroativo'::text, 'lembrete_downgrade'::text, 'lembrete_milhas_expirando'::text, 'transferencia_titular'::text, 'transferencia_entrada'::text, 'transferencia_bonus'::text, 'bumerangue_retorno'::text, 'outro'::text]))),
  CONSTRAINT atividades_tipo_lembrete_check CHECK ((tipo_lembrete = ANY (ARRAY['downgrade_verificar'::text, 'credito_pontos_conferir'::text, 'milhas_expirando'::text, 'vencimento_clube'::text, 'pagamento_pendente'::text, 'transferencia_conferir'::text, 'outro'::text])))
);

CREATE TABLE IF NOT EXISTS public.cartoes_credito (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cartao text NOT NULL,
  banco_emissor text,
  status text DEFAULT 'ativo'::text,
  dia_fechamento integer,
  dia_vencimento integer,
  valor_mensalidade numeric(10,2),
  limites numeric(10,2),
  limite_emergencial numeric(10,2),
  limite_global numeric(10,2),
  valor_isencao numeric(10,2),
  onde_usar text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  conta_bancaria_id uuid,
  limite_disponivel numeric,
  mes_expiracao integer,
  ano_expiracao integer,
  bandeira text,
  tipo_cartao text DEFAULT 'principal'::text,
  cartao_principal_id uuid,
  PRIMARY KEY (id),
  CONSTRAINT cartoes_credito_ano_expiracao_check CHECK (((ano_expiracao >= 2000) AND (ano_expiracao <= 2099))),
  CONSTRAINT cartoes_credito_bandeira_check CHECK ((bandeira = ANY (ARRAY['Visa'::text, 'Mastercard'::text, 'Amex'::text, 'Elo'::text, 'Hipercard'::text, 'Diners Club'::text, 'Outros'::text]))),
  CONSTRAINT cartoes_credito_dia_fechamento_check CHECK (((dia_fechamento >= 1) AND (dia_fechamento <= 31))),
  CONSTRAINT cartoes_credito_dia_vencimento_check CHECK (((dia_vencimento >= 1) AND (dia_vencimento <= 31))),
  CONSTRAINT cartoes_credito_mes_expiracao_check CHECK (((mes_expiracao >= 1) AND (mes_expiracao <= 12))),
  CONSTRAINT cartoes_credito_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'titular'::text]))),
  CONSTRAINT cartoes_credito_tipo_cartao_check CHECK ((tipo_cartao = ANY (ARRAY['principal'::text, 'adicional'::text, 'virtual'::text])))
);

CREATE TABLE IF NOT EXISTS public.centro_custos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  chave_referencia text NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.classificacao_contabil (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  classificacao text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  chave_referencia text NOT NULL,
  categoria text NOT NULL,
  descricao text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome_cliente text NOT NULL,
  endereco text,
  email text,
  telefone text,
  whatsapp text,
  contato text,
  site text,
  instagram text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  chave_referencia text NOT NULL,
  cnpj_cpf text,
  obs text,
  banco text,
  agencia text,
  tipo_conta text,
  numero_conta text,
  pix text,
  inscricao_municipal text,
  PRIMARY KEY (id),
  CONSTRAINT clientes_chave_referencia_key UNIQUE (chave_referencia)
);

CREATE TABLE IF NOT EXISTS public.compra_bonificada (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid,
  programa_id uuid,
  data_compra date NOT NULL,
  recebimento_produto date,
  recebimento_pontos date NOT NULL,
  produto text NOT NULL,
  loja text,
  pontos_real numeric(10,2),
  destino text DEFAULT 'Uso próprio'::text,
  valor_produto numeric(10,2) NOT NULL,
  frete numeric(10,2),
  seguro_protecao numeric(10,2),
  valor_venda numeric(10,2),
  custo_total numeric(10,2) NOT NULL,
  forma_pagamento text,
  conta text,
  parcelas integer DEFAULT 1,
  quantidade_pontos numeric(10,2) NOT NULL,
  valor_milheiro numeric(10,4),
  observacao text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  chave_referencia text,
  loja_id uuid,
  tipo_pontos_real text,
  cartao_id uuid,
  conta_bancaria_id uuid,
  nota_fiscal_numero text,
  nota_fiscal_arquivo text,
  tipo_compra_id uuid,
  data_vencimento_manual date,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.compras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid,
  programa_id uuid,
  tipo text NOT NULL,
  data_entrada date DEFAULT CURRENT_DATE,
  pontos_milhas numeric(15,2) DEFAULT 0,
  valor_total numeric(15,2),
  valor_milheiro numeric(15,2),
  tipo_valor text,
  saldo_atual numeric(15,2),
  custo_medio numeric(15,2),
  observacao text,
  agendar_entrada boolean,
  agendamento_recorrente boolean,
  periodicidade text,
  quantidade_recorrencia integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  data_limite_bonus date,
  bonus numeric(15,2),
  status text DEFAULT 'Pendente'::text NOT NULL,
  forma_pagamento text,
  quantidade_parcelas integer DEFAULT 1,
  classificacao_contabil_id uuid,
  total_pontos numeric(15,2),
  cartao_id uuid,
  conta_bancaria_id uuid,
  origem_bonus text,
  data_vencimento_manual date,
  PRIMARY KEY (id),
  CONSTRAINT compras_periodicidade_check CHECK ((periodicidade = ANY (ARRAY['Semanal'::text, 'Quinzenal'::text, 'Mensal'::text, 'Bimestral'::text, 'Trimestral'::text, 'Semestral'::text, 'Anual'::text]))),
  CONSTRAINT compras_status_check CHECK ((status = ANY (ARRAY['Pendente'::text, 'Concluído'::text]))),
  CONSTRAINT compras_tipo_valor_check CHECK ((tipo_valor = ANY (ARRAY['VT'::text, 'VM'::text])))
);

CREATE TABLE IF NOT EXISTS public.conta_familia (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  id_conta_familia text NOT NULL,
  nome_conta text NOT NULL,
  parceiro_principal_id uuid,
  programa_id uuid,
  status text DEFAULT 'Ativa'::text NOT NULL,
  obs text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT conta_familia_id_conta_familia_key UNIQUE (id_conta_familia),
  CONSTRAINT conta_familia_parceiro_programa_unique UNIQUE (parceiro_principal_id, programa_id)
);

CREATE TABLE IF NOT EXISTS public.conta_familia_historico (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid NOT NULL,
  programa_id uuid NOT NULL,
  conta_familia_id uuid NOT NULL,
  data_remocao timestamp with time zone DEFAULT now() NOT NULL,
  data_liberacao timestamp with time zone NOT NULL,
  motivo text,
  removido_por text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.conta_familia_membros (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conta_familia_id uuid NOT NULL,
  parceiro_id uuid NOT NULL,
  data_inclusao date DEFAULT CURRENT_DATE,
  data_exclusao date,
  status text DEFAULT 'Ativo'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.contas_a_pagar (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  origem_tipo text NOT NULL,
  origem_id uuid,
  parceiro_id uuid,
  programa_id uuid,
  descricao text NOT NULL,
  data_vencimento date NOT NULL,
  valor_parcela numeric(15,2) NOT NULL,
  numero_parcela integer DEFAULT 1 NOT NULL,
  total_parcelas integer DEFAULT 1 NOT NULL,
  forma_pagamento text,
  cartao_id uuid,
  conta_bancaria_id uuid,
  status_pagamento text DEFAULT 'pendente'::text NOT NULL,
  data_pagamento date,
  valor_pago numeric(15,2),
  observacao text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT contas_a_pagar_check CHECK ((numero_parcela <= total_parcelas)),
  CONSTRAINT contas_a_pagar_numero_parcela_check CHECK ((numero_parcela > 0)),
  CONSTRAINT contas_a_pagar_origem_tipo_check CHECK ((origem_tipo = ANY (ARRAY['compra'::text, 'compra_bonificada'::text, 'clube'::text, 'transferencia_pontos'::text, 'ajuste'::text, 'outro'::text, 'venda'::text]))),
  CONSTRAINT contas_a_pagar_status_pagamento_check CHECK ((status_pagamento = ANY (ARRAY['pendente'::text, 'pago'::text, 'atrasado'::text, 'cancelado'::text]))),
  CONSTRAINT contas_a_pagar_total_parcelas_check CHECK ((total_parcelas > 0)),
  CONSTRAINT contas_a_pagar_valor_parcela_check CHECK ((valor_parcela >= (0)::numeric))
);

CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome_banco text NOT NULL,
  codigo_banco text,
  agencia text,
  numero_conta text,
  chave_pix text,
  saldo_inicial numeric(10,2),
  data_saldo_inicial date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.contas_receber (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  venda_id uuid,
  localizador_id uuid,
  data_vencimento date NOT NULL,
  valor_parcela numeric(15,2) DEFAULT 0 NOT NULL,
  numero_parcela integer DEFAULT 1 NOT NULL,
  total_parcelas integer DEFAULT 1 NOT NULL,
  forma_pagamento text,
  conta_bancaria_id uuid,
  cartao_id uuid,
  status_pagamento text DEFAULT 'pendente'::text,
  data_pagamento date,
  valor_pago numeric(15,2),
  observacao text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  origem_tipo text,
  origem_id uuid,
  parent_conta_id uuid,
  PRIMARY KEY (id),
  CONSTRAINT contas_receber_origem_tipo_check CHECK ((origem_tipo = ANY (ARRAY['venda'::text, 'transferencia_pontos'::text, 'transferencia_pessoas'::text, 'outro'::text]))),
  CONSTRAINT contas_receber_status_pagamento_check CHECK ((status_pagamento = ANY (ARRAY['pendente'::text, 'pago'::text, 'atrasado'::text, 'cancelado'::text, 'parcial'::text])))
);

CREATE TABLE IF NOT EXISTS public.creditos_recorrentes_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  programa_clube_id uuid NOT NULL,
  data_credito date NOT NULL,
  quantidade_pontos integer DEFAULT 0,
  quantidade_bonus integer DEFAULT 0,
  quantidade_total integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT creditos_recorrentes_log_programa_clube_id_data_credito_key UNIQUE (programa_clube_id, data_credito)
);

CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid NOT NULL,
  programa_id uuid NOT NULL,
  tipo text NOT NULL,
  quantidade numeric NOT NULL,
  valor_total numeric DEFAULT 0,
  saldo_anterior numeric NOT NULL,
  saldo_posterior numeric NOT NULL,
  custo_medio_anterior numeric,
  custo_medio_posterior numeric,
  origem text,
  observacao text,
  referencia_id uuid,
  referencia_tabela text,
  data_movimentacao timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  data_operacao date DEFAULT CURRENT_DATE,
  PRIMARY KEY (id),
  CONSTRAINT estoque_movimentacoes_quantidade_check CHECK ((quantidade > (0)::numeric)),
  CONSTRAINT estoque_movimentacoes_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text, 'transferencia_entrada'::text, 'transferencia_saida'::text, 'transferencia_pessoas_entrada'::text, 'transferencia_pessoas_saida'::text, 'transferencia_bonus'::text, 'transferencia_pessoas_bonus'::text, 'bumerangue_retorno'::text])))
);

CREATE TABLE IF NOT EXISTS public.estoque_pontos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid NOT NULL,
  programa_id uuid NOT NULL,
  saldo_atual numeric(15,2) DEFAULT 0 NOT NULL,
  custo_medio numeric(10,4) DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  valor_total numeric(15,2) DEFAULT 0 NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT estoque_pontos_parceiro_id_programa_id_key UNIQUE (parceiro_id, programa_id)
);

CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true NOT NULL,
  registrar_fluxo_caixa boolean DEFAULT true NOT NULL,
  ordem integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT formas_pagamento_nome_key UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS public.localizadores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  venda_id uuid,
  codigo_localizador text NOT NULL,
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
  status text DEFAULT 'emitido'::text,
  observacao text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  valor_total numeric(15,2) DEFAULT 0,
  forma_pagamento text,
  parcelas integer DEFAULT 1,
  valor_pago numeric(15,2) DEFAULT 0,
  saldo_restante numeric(15,2) DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT localizadores_status_check CHECK ((status = ANY (ARRAY['emitido'::text, 'voado'::text, 'cancelado'::text, 'reembolsado'::text]))),
  CONSTRAINT localizadores_codigo_localizador_key UNIQUE (codigo_localizador)
);

CREATE TABLE IF NOT EXISTS public.logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  data_hora timestamp with time zone DEFAULT now(),
  usuario_id uuid,
  usuario_nome text NOT NULL,
  acao text NOT NULL,
  linha_afetada text NOT NULL,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.lojas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  cnpj text,
  telefone text,
  observacoes text,
  PRIMARY KEY (id),
  CONSTRAINT lojas_nome_unique UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS public.migration_validation_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  migration_name text NOT NULL,
  validation_date timestamp with time zone DEFAULT now(),
  status text,
  details jsonb,
  PRIMARY KEY (id),
  CONSTRAINT migration_validation_log_migration_name_key UNIQUE (migration_name)
);

CREATE TABLE IF NOT EXISTS public.parceiro_documentos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid NOT NULL,
  tipo_documento text NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  tamanho_bytes bigint,
  uploaded_at timestamp with time zone DEFAULT now(),
  uploaded_by uuid,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.parceiro_programa_cpfs_controle (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid NOT NULL,
  programa_id uuid NOT NULL,
  ano integer NOT NULL,
  cpfs_emitidos integer DEFAULT 0,
  data_primeiro_cpf date,
  data_ultimo_cpf date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT parceiro_programa_cpfs_controle_parceiro_id_programa_id_ano_key UNIQUE (parceiro_id, programa_id, ano)
);

CREATE TABLE IF NOT EXISTS public.parceiros (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  id_parceiro text NOT NULL,
  nome_parceiro text NOT NULL,
  telefone text NOT NULL,
  dt_nasc date,
  cpf text NOT NULL,
  rg text NOT NULL,
  email text NOT NULL,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  nome_mae text,
  nome_pai text,
  tipo text DEFAULT 'Parceiro'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  obs text,
  PRIMARY KEY (id),
  CONSTRAINT parceiros_tipo_check CHECK ((tipo = ANY (ARRAY['Parceiro'::text, 'Fornecedor'::text])))
);

CREATE TABLE IF NOT EXISTS public.passagens_emitidas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  venda_id uuid NOT NULL,
  data_emissao date NOT NULL,
  cpfs integer DEFAULT 1 NOT NULL,
  milhas numeric(15,2),
  localizador text,
  passageiro text,
  cpf text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.perfil_permissoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  perfil_id uuid NOT NULL,
  recurso text NOT NULL,
  pode_visualizar boolean DEFAULT false,
  pode_editar boolean DEFAULT false,
  pode_deletar boolean DEFAULT false,
  PRIMARY KEY (id),
  CONSTRAINT perfil_permissoes_perfil_id_recurso_key UNIQUE (perfil_id, recurso)
);

CREATE TABLE IF NOT EXISTS public.perfis_usuario (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT perfis_usuario_nome_key UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS public.produtos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  valor_unitario numeric(15,2) DEFAULT 0,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.programas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome_programa text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.programas_clubes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid,
  nome_parceiro text,
  telefone text,
  dt_nasc date,
  cpf text,
  rg text,
  email text,
  idade integer,
  programa_id uuid,
  n_fidelidade text,
  senha text,
  senha_resgate text,
  conta_familia_id uuid,
  data_exclusao_conta_familia date,
  tem_clube boolean DEFAULT false,
  clube_produto_id uuid,
  cartao text,
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric(10,2),
  tempo_clube_mes integer,
  liminar boolean DEFAULT false,
  aparelho text,
  quantidade_pontos integer,
  bonus_porcentagem numeric(5,2),
  sequencia text,
  milhas_expirando text,
  tipo_parceiro_fornecedor text,
  status_conta text,
  status_restricao text,
  conferente text,
  ultima_data_conferencia date,
  grupo_liminar text,
  status_programa_id uuid,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tem_comissao boolean DEFAULT false,
  comissao_tipo text,
  comissao_valor numeric(10,2),
  bonus_quantidade_pontos integer,
  downgrade_upgrade_data date,
  milhas_expirando_data date,
  PRIMARY KEY (id),
  CONSTRAINT programas_clubes_comissao_tipo_check CHECK ((comissao_tipo = ANY (ARRAY['porcentagem'::text, 'real'::text]))),
  CONSTRAINT programas_clubes_sequencia_check CHECK ((sequencia = ANY (ARRAY['mensal'::text, 'trimestral'::text, 'anual'::text]))),
  CONSTRAINT programas_clubes_status_conta_check CHECK ((status_conta = ANY (ARRAY['Aguarda Confirmação'::text, 'Alteração Cadastral'::text, 'Ativo'::text, 'YAHOO - BLOQUEADA'::text, 'Autenticação'::text, 'Bloqueado'::text, 'Cancelado'::text, 'Em Revisão'::text, 'Erro'::text, 'Não Tem'::text, 'Restrito para Emissão'::text]))),
  CONSTRAINT programas_clubes_status_restricao_check CHECK ((status_restricao = ANY (ARRAY['Com Restrição'::text, 'Sem Restrição'::text]))),
  CONSTRAINT programas_clubes_tipo_parceiro_fornecedor_check CHECK ((tipo_parceiro_fornecedor = ANY (ARRAY['Parceiro'::text, 'Fornecedor'::text]))),
  CONSTRAINT programas_clubes_parceiro_programa_unique UNIQUE (parceiro_id, programa_id)
);

CREATE TABLE IF NOT EXISTS public.programas_fidelidade (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  programa text NOT NULL,
  nome text NOT NULL,
  cnpj text,
  site text,
  telefone text,
  whatsapp text,
  email text,
  link_chat text,
  obs text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.programas_membros (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  programa_id uuid NOT NULL,
  parceiro_id uuid NOT NULL,
  numero_fidelidade text NOT NULL,
  senha text,
  conta_familia text,
  data_exclusao_conta_familia date,
  clube_produto_id uuid,
  cartao_id uuid,
  data_ultima_assinatura date,
  dia_cobranca integer,
  valor numeric(10,2),
  tempo_clube_meses integer DEFAULT 0,
  liminar text,
  mudanca_clube text,
  milhas_expirando text,
  observacoes text,
  parceiro_fornecedor text,
  status_conta text DEFAULT 'Aguarda Confirmação'::text,
  status_restricao text DEFAULT 'Sem restrição'::text,
  conferente text,
  ultima_data_conferencia date,
  grupo_liminar text,
  status_programa text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT programas_membros_dia_cobranca_check CHECK (((dia_cobranca >= 1) AND (dia_cobranca <= 31))),
  CONSTRAINT programas_membros_programa_id_parceiro_id_numero_fidelidade_key UNIQUE (programa_id, parceiro_id, numero_fidelidade)
);

CREATE TABLE IF NOT EXISTS public.status_programa (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  chave_referencia text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  limite_cpfs_ano integer DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT status_programa_chave_referencia_key UNIQUE (chave_referencia)
);

CREATE TABLE IF NOT EXISTS public.tipos_compra (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  nao_registrar_estoque boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.transferencia_pessoas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  data_transferencia date NOT NULL,
  programa_id uuid NOT NULL,
  origem_parceiro_id uuid NOT NULL,
  destino_parceiro_id uuid NOT NULL,
  quantidade numeric(15,2) DEFAULT 0 NOT NULL,
  data_recebimento date NOT NULL,
  bonus_percentual numeric(5,2) DEFAULT 0,
  quantidade_bonus numeric(15,2) DEFAULT 0,
  data_recebimento_bonus date,
  custo_transferencia numeric(10,2) DEFAULT 0,
  forma_pagamento text,
  conta_bancaria_id uuid,
  cartao_id uuid,
  parcelas integer DEFAULT 1,
  observacao text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  destino_programa_id uuid,
  status text DEFAULT 'Pendente'::text,
  bonus integer DEFAULT 0,
  bonus_destino integer DEFAULT 0,
  tem_custo boolean DEFAULT false,
  valor_custo numeric(15,2) DEFAULT 0,
  forma_pagamento_id uuid,
  data_vencimento_manual date,
  PRIMARY KEY (id),
  CONSTRAINT check_custo_valido CHECK ((((tem_custo = false) AND ((valor_custo IS NULL) OR (valor_custo = (0)::numeric))) OR ((tem_custo = true) AND (valor_custo > (0)::numeric)))),
  CONSTRAINT check_origem_destino_diferente CHECK ((origem_parceiro_id <> destino_parceiro_id)),
  CONSTRAINT transferencia_pessoas_bonus_check CHECK ((bonus >= 0)),
  CONSTRAINT transferencia_pessoas_bonus_destino_check CHECK ((bonus_destino >= 0))
);

CREATE TABLE IF NOT EXISTS public.transferencia_pontos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid NOT NULL,
  data_transferencia date DEFAULT CURRENT_DATE,
  origem_programa_id uuid NOT NULL,
  origem_quantidade numeric(15,2) DEFAULT 0 NOT NULL,
  origem_paridade numeric(10,2) DEFAULT 1,
  realizar_compra_carrinho boolean DEFAULT false,
  realizar_retorno_bumerangue boolean DEFAULT false,
  compra_quantidade numeric(15,2),
  compra_valor_total numeric(15,2),
  compra_valor_milheiro numeric(10,4),
  compra_forma_pagamento text,
  compra_conta text,
  compra_parcelas integer DEFAULT 1,
  bumerangue_bonus_percentual numeric(5,2) DEFAULT 0,
  bumerangue_quantidade_bonus numeric(15,2) DEFAULT 0,
  bumerangue_data_recebimento date,
  destino_programa_id uuid NOT NULL,
  destino_quantidade numeric(15,2) DEFAULT 0 NOT NULL,
  destino_data_recebimento date NOT NULL,
  destino_bonus_percentual numeric(5,2) DEFAULT 0,
  destino_quantidade_bonus numeric(15,2) DEFAULT 0,
  destino_data_recebimento_bonus date,
  observacao text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  status text DEFAULT 'Pendente'::text,
  status_bonus_destino text DEFAULT 'Pendente'::text,
  status_bonus_bumerangue text DEFAULT 'Pendente'::text,
  compra_custo_medio_final numeric DEFAULT 0,
  compra_cartao_id uuid,
  compra_conta_bancaria_id uuid,
  custo_transferencia numeric DEFAULT 0,
  forma_pagamento_transferencia text,
  cartao_id uuid,
  conta_bancaria_id uuid,
  compra_data_vencimento_manual date,
  taxa_data_vencimento_manual date,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.usuario_permissoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  usuario_id uuid NOT NULL,
  recurso text NOT NULL,
  pode_visualizar boolean DEFAULT false,
  pode_editar boolean DEFAULT false,
  pode_deletar boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT unique_usuario_recurso UNIQUE (usuario_id, recurso)
);

CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  senha text NOT NULL,
  nivel_acesso text DEFAULT 'USER'::text NOT NULL,
  ultima_acao timestamp with time zone DEFAULT now(),
  token text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  perfil_id uuid,
  PRIMARY KEY (id),
  CONSTRAINT usuarios_nivel_acesso_check CHECK ((nivel_acesso = ANY (ARRAY['ADM'::text, 'USER'::text]))),
  CONSTRAINT usuarios_email_key UNIQUE (email),
  CONSTRAINT usuarios_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.venda_lotes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  venda_id uuid NOT NULL,
  compra_id uuid,
  pontos_usados numeric(15,2) NOT NULL,
  valor_milheiro numeric(10,4) NOT NULL,
  data_entrada date,
  created_at timestamp with time zone DEFAULT now(),
  referencia_id uuid,
  referencia_tipo text,
  tipo_origem text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.vendas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parceiro_id uuid,
  programa_id uuid,
  data_venda date DEFAULT CURRENT_DATE,
  quantidade_milhas numeric(15,2) DEFAULT 0 NOT NULL,
  valor_total numeric(15,2) DEFAULT 0 NOT NULL,
  valor_milheiro numeric(15,2),
  tipo_valor text,
  saldo_anterior numeric(15,2),
  custo_medio numeric(15,2),
  lucro_real numeric(15,2),
  lucro_percentual numeric(5,2),
  incluir_taxas_emissao boolean DEFAULT false,
  observacao text,
  status text DEFAULT 'pendente'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  gerar_comissao boolean DEFAULT false,
  tipo_comissao text,
  comissao_percentual numeric(10,2),
  comissao_valor_fixo numeric(15,2),
  comissao_valor_calculado numeric(15,2),
  comissao_forma_pagamento text,
  comissao_conta_bancaria_id uuid,
  localizador_pdf_url text,
  cliente_id uuid,
  tipo_cliente text DEFAULT 'cliente_final'::text,
  ordem_compra text,
  estoque_reservado boolean DEFAULT false,
  quantidade_reservada numeric(15,2) DEFAULT 0,
  cia_parceira text,
  taxa_embarque numeric(15,2) DEFAULT 0,
  taxa_resgate numeric(15,2) DEFAULT 0,
  taxa_bagagem numeric(15,2) DEFAULT 0,
  cartao_taxa_embarque_id uuid,
  cartao_taxa_bagagem_id uuid,
  cartao_taxa_resgate_id uuid,
  data_voo_ida date,
  data_voo_volta date,
  nome_passageiro text,
  quantidade_passageiros integer DEFAULT 1,
  trecho text,
  tarifa_diamante numeric(15,2) DEFAULT 0,
  milhas_bonus numeric(15,2) DEFAULT 0,
  custo_emissao numeric(15,2) DEFAULT 0,
  emissor text,
  cmv numeric(15,2),
  PRIMARY KEY (id),
  CONSTRAINT vendas_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'concluida'::text, 'cancelada'::text]))),
  CONSTRAINT vendas_tipo_cliente_check CHECK ((tipo_cliente = ANY (ARRAY['cliente_final'::text, 'agencia_convencional'::text, 'agencia_grande'::text]))),
  CONSTRAINT vendas_tipo_valor_check CHECK ((tipo_valor = ANY (ARRAY['VT'::text, 'VM'::text])))
);

-- FOREIGN KEYS

ALTER TABLE public.atividades ADD CONSTRAINT atividades_concluido_por_fkey FOREIGN KEY (concluido_por) REFERENCES public.usuarios(id);
ALTER TABLE public.atividades ADD CONSTRAINT atividades_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.atividades ADD CONSTRAINT atividades_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id);
ALTER TABLE public.atividades ADD CONSTRAINT atividades_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.cartoes_credito ADD CONSTRAINT cartoes_credito_cartao_principal_id_fkey FOREIGN KEY (cartao_principal_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.cartoes_credito ADD CONSTRAINT cartoes_credito_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.compra_bonificada ADD CONSTRAINT compra_bonificada_cartao_id_fkey FOREIGN KEY (cartao_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.compra_bonificada ADD CONSTRAINT compra_bonificada_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.compra_bonificada ADD CONSTRAINT compra_bonificada_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES public.lojas(id) ON DELETE SET NULL;
ALTER TABLE public.compra_bonificada ADD CONSTRAINT compra_bonificada_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE RESTRICT;
ALTER TABLE public.compra_bonificada ADD CONSTRAINT compra_bonificada_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE RESTRICT;
ALTER TABLE public.compra_bonificada ADD CONSTRAINT compra_bonificada_tipo_compra_id_fkey FOREIGN KEY (tipo_compra_id) REFERENCES public.tipos_compra(id) ON DELETE SET NULL;
ALTER TABLE public.compras ADD CONSTRAINT compras_cartao_id_fkey FOREIGN KEY (cartao_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.compras ADD CONSTRAINT compras_classificacao_contabil_id_fkey FOREIGN KEY (classificacao_contabil_id) REFERENCES public.classificacao_contabil(id);
ALTER TABLE public.compras ADD CONSTRAINT compras_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.compras ADD CONSTRAINT compras_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.compras ADD CONSTRAINT compras_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE CASCADE;
ALTER TABLE public.conta_familia ADD CONSTRAINT conta_familia_parceiro_principal_id_fkey FOREIGN KEY (parceiro_principal_id) REFERENCES public.parceiros(id);
ALTER TABLE public.conta_familia ADD CONSTRAINT conta_familia_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id);
ALTER TABLE public.conta_familia_historico ADD CONSTRAINT conta_familia_historico_conta_familia_id_fkey FOREIGN KEY (conta_familia_id) REFERENCES public.conta_familia(id) ON DELETE CASCADE;
ALTER TABLE public.conta_familia_historico ADD CONSTRAINT conta_familia_historico_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.conta_familia_historico ADD CONSTRAINT conta_familia_historico_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE CASCADE;
ALTER TABLE public.conta_familia_membros ADD CONSTRAINT conta_familia_membros_conta_familia_id_fkey FOREIGN KEY (conta_familia_id) REFERENCES public.conta_familia(id) ON DELETE CASCADE;
ALTER TABLE public.conta_familia_membros ADD CONSTRAINT conta_familia_membros_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id);
ALTER TABLE public.contas_a_pagar ADD CONSTRAINT contas_a_pagar_cartao_id_fkey FOREIGN KEY (cartao_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.contas_a_pagar ADD CONSTRAINT contas_a_pagar_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.contas_a_pagar ADD CONSTRAINT contas_a_pagar_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.contas_a_pagar ADD CONSTRAINT contas_a_pagar_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE SET NULL;
ALTER TABLE public.contas_a_pagar ADD CONSTRAINT contas_a_pagar_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE SET NULL;
ALTER TABLE public.contas_receber ADD CONSTRAINT contas_receber_cartao_id_fkey FOREIGN KEY (cartao_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.contas_receber ADD CONSTRAINT contas_receber_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.contas_receber ADD CONSTRAINT contas_receber_localizador_id_fkey FOREIGN KEY (localizador_id) REFERENCES public.localizadores(id) ON DELETE CASCADE;
ALTER TABLE public.contas_receber ADD CONSTRAINT contas_receber_parent_conta_id_fkey FOREIGN KEY (parent_conta_id) REFERENCES public.contas_receber(id) ON DELETE SET NULL;
ALTER TABLE public.contas_receber ADD CONSTRAINT contas_receber_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;
ALTER TABLE public.creditos_recorrentes_log ADD CONSTRAINT creditos_recorrentes_log_programa_clube_id_fkey FOREIGN KEY (programa_clube_id) REFERENCES public.programas_clubes(id) ON DELETE CASCADE;
ALTER TABLE public.estoque_movimentacoes ADD CONSTRAINT estoque_movimentacoes_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.estoque_movimentacoes ADD CONSTRAINT estoque_movimentacoes_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE CASCADE;
ALTER TABLE public.estoque_pontos ADD CONSTRAINT estoque_pontos_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.estoque_pontos ADD CONSTRAINT estoque_pontos_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE CASCADE;
ALTER TABLE public.localizadores ADD CONSTRAINT localizadores_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;
ALTER TABLE public.logs ADD CONSTRAINT logs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.parceiro_documentos ADD CONSTRAINT parceiro_documentos_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.parceiro_documentos ADD CONSTRAINT parceiro_documentos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.usuarios(id);
ALTER TABLE public.parceiro_programa_cpfs_controle ADD CONSTRAINT parceiro_programa_cpfs_controle_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.parceiro_programa_cpfs_controle ADD CONSTRAINT parceiro_programa_cpfs_controle_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE CASCADE;
ALTER TABLE public.passagens_emitidas ADD CONSTRAINT passagens_emitidas_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;
ALTER TABLE public.perfil_permissoes ADD CONSTRAINT perfil_permissoes_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfis_usuario(id) ON DELETE CASCADE;
ALTER TABLE public.programas_clubes ADD CONSTRAINT programas_clubes_clube_produto_id_fkey FOREIGN KEY (clube_produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;
ALTER TABLE public.programas_clubes ADD CONSTRAINT programas_clubes_conta_familia_id_fkey FOREIGN KEY (conta_familia_id) REFERENCES public.conta_familia(id) ON DELETE SET NULL;
ALTER TABLE public.programas_clubes ADD CONSTRAINT programas_clubes_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE SET NULL;
ALTER TABLE public.programas_clubes ADD CONSTRAINT programas_clubes_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE SET NULL;
ALTER TABLE public.programas_clubes ADD CONSTRAINT programas_clubes_status_programa_id_fkey FOREIGN KEY (status_programa_id) REFERENCES public.status_programa(id) ON DELETE SET NULL;
ALTER TABLE public.programas_membros ADD CONSTRAINT programas_membros_cartao_id_fkey FOREIGN KEY (cartao_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.programas_membros ADD CONSTRAINT programas_membros_clube_produto_id_fkey FOREIGN KEY (clube_produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;
ALTER TABLE public.programas_membros ADD CONSTRAINT programas_membros_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.programas_membros ADD CONSTRAINT programas_membros_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas(id) ON DELETE CASCADE;
ALTER TABLE public.transferencia_pessoas ADD CONSTRAINT transferencia_pessoas_cartao_id_fkey FOREIGN KEY (cartao_id) REFERENCES public.cartoes_credito(id);
ALTER TABLE public.transferencia_pessoas ADD CONSTRAINT transferencia_pessoas_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id);
ALTER TABLE public.transferencia_pessoas ADD CONSTRAINT transferencia_pessoas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id);
ALTER TABLE public.transferencia_pessoas ADD CONSTRAINT transferencia_pessoas_destino_parceiro_id_fkey FOREIGN KEY (destino_parceiro_id) REFERENCES public.parceiros(id);
ALTER TABLE public.transferencia_pessoas ADD CONSTRAINT transferencia_pessoas_destino_programa_id_fkey FOREIGN KEY (destino_programa_id) REFERENCES public.programas_fidelidade(id);
ALTER TABLE public.transferencia_pessoas ADD CONSTRAINT transferencia_pessoas_forma_pagamento_id_fkey FOREIGN KEY (forma_pagamento_id) REFERENCES public.formas_pagamento(id);
ALTER TABLE public.transferencia_pessoas ADD CONSTRAINT transferencia_pessoas_origem_parceiro_id_fkey FOREIGN KEY (origem_parceiro_id) REFERENCES public.parceiros(id);
ALTER TABLE public.transferencia_pessoas ADD CONSTRAINT transferencia_pessoas_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id);
ALTER TABLE public.transferencia_pontos ADD CONSTRAINT transferencia_pontos_cartao_id_fkey FOREIGN KEY (cartao_id) REFERENCES public.cartoes_credito(id);
ALTER TABLE public.transferencia_pontos ADD CONSTRAINT transferencia_pontos_compra_cartao_id_fkey FOREIGN KEY (compra_cartao_id) REFERENCES public.cartoes_credito(id);
ALTER TABLE public.transferencia_pontos ADD CONSTRAINT transferencia_pontos_compra_conta_bancaria_id_fkey FOREIGN KEY (compra_conta_bancaria_id) REFERENCES public.contas_bancarias(id);
ALTER TABLE public.transferencia_pontos ADD CONSTRAINT transferencia_pontos_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id);
ALTER TABLE public.transferencia_pontos ADD CONSTRAINT transferencia_pontos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.transferencia_pontos ADD CONSTRAINT transferencia_pontos_destino_programa_id_fkey FOREIGN KEY (destino_programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE RESTRICT;
ALTER TABLE public.transferencia_pontos ADD CONSTRAINT transferencia_pontos_origem_programa_id_fkey FOREIGN KEY (origem_programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE RESTRICT;
ALTER TABLE public.transferencia_pontos ADD CONSTRAINT transferencia_pontos_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.usuario_permissoes ADD CONSTRAINT usuario_permissoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfis_usuario(id) ON DELETE SET NULL;
ALTER TABLE public.venda_lotes ADD CONSTRAINT venda_lotes_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;
ALTER TABLE public.venda_lotes ADD CONSTRAINT venda_lotes_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_cartao_taxa_bagagem_id_fkey FOREIGN KEY (cartao_taxa_bagagem_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_cartao_taxa_embarque_id_fkey FOREIGN KEY (cartao_taxa_embarque_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_cartao_taxa_resgate_id_fkey FOREIGN KEY (cartao_taxa_resgate_id) REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.vendas ADD CONSTRAINT vendas_comissao_conta_bancaria_id_fkey FOREIGN KEY (comissao_conta_bancaria_id) REFERENCES public.contas_bancarias(id);
ALTER TABLE public.vendas ADD CONSTRAINT vendas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE CASCADE;

-- INDEXES
CREATE INDEX idx_atividades_data_prevista ON public.atividades USING btree (data_prevista);
CREATE INDEX idx_atividades_parceiro ON public.atividades USING btree (parceiro_id);
CREATE INDEX idx_atividades_prioridade ON public.atividades USING btree (prioridade);
CREATE INDEX idx_atividades_referencia ON public.atividades USING btree (referencia_id, referencia_tabela);
CREATE INDEX idx_atividades_status ON public.atividades USING btree (status);
CREATE INDEX idx_atividades_tipo ON public.atividades USING btree (tipo_atividade);
CREATE INDEX idx_atividades_tipo_lembrete ON public.atividades USING btree (tipo_lembrete);
CREATE INDEX idx_atividades_usuario_status ON public.atividades USING btree (usuario_id, status);
CREATE UNIQUE INDEX cartoes_credito_cartao_unique ON public.cartoes_credito USING btree (cartao) WHERE ((cartao IS NOT NULL) AND (cartao <> ''::text));
CREATE INDEX idx_cartoes_credito_conta_bancaria_id ON public.cartoes_credito USING btree (conta_bancaria_id);
CREATE INDEX idx_cartoes_credito_principal ON public.cartoes_credito USING btree (cartao_principal_id);
CREATE UNIQUE INDEX clientes_cnpj_cpf_unique ON public.clientes USING btree (cnpj_cpf) WHERE ((cnpj_cpf IS NOT NULL) AND (cnpj_cpf <> ''::text));
CREATE INDEX idx_clientes_chave_referencia ON public.clientes USING btree (chave_referencia);
CREATE INDEX idx_clientes_inscricao_municipal ON public.clientes USING btree (inscricao_municipal) WHERE (inscricao_municipal IS NOT NULL);
CREATE INDEX idx_compra_bonificada_cartao ON public.compra_bonificada USING btree (cartao_id);
CREATE INDEX idx_compra_bonificada_cliente ON public.compra_bonificada USING btree (parceiro_id);
CREATE INDEX idx_compra_bonificada_conta_bancaria ON public.compra_bonificada USING btree (conta_bancaria_id);
CREATE INDEX idx_compra_bonificada_data_compra ON public.compra_bonificada USING btree (data_compra);
CREATE INDEX idx_compra_bonificada_loja ON public.compra_bonificada USING btree (loja_id);
CREATE INDEX idx_compra_bonificada_programa ON public.compra_bonificada USING btree (programa_id);
CREATE INDEX idx_compra_bonificada_tipo_compra_id ON public.compra_bonificada USING btree (tipo_compra_id);
CREATE INDEX idx_compras_cartao ON public.compras USING btree (cartao_id);
CREATE INDEX idx_compras_conta_bancaria ON public.compras USING btree (conta_bancaria_id);
CREATE INDEX idx_compras_created_at ON public.compras USING btree (created_at);
CREATE INDEX idx_compras_data_entrada ON public.compras USING btree (data_entrada);
CREATE INDEX idx_compras_parceiro ON public.compras USING btree (parceiro_id);
CREATE INDEX idx_compras_programa ON public.compras USING btree (programa_id);
CREATE INDEX idx_conta_familia_parceiro_principal ON public.conta_familia USING btree (parceiro_principal_id);
CREATE INDEX idx_conta_familia_programa ON public.conta_familia USING btree (programa_id);
CREATE INDEX idx_conta_familia_historico_liberacao ON public.conta_familia_historico USING btree (data_liberacao);
CREATE INDEX idx_conta_familia_historico_parceiro ON public.conta_familia_historico USING btree (parceiro_id);
CREATE INDEX idx_conta_familia_historico_programa ON public.conta_familia_historico USING btree (programa_id);
CREATE INDEX idx_conta_familia_membros_conta ON public.conta_familia_membros USING btree (conta_familia_id);
CREATE INDEX idx_conta_familia_membros_parceiro ON public.conta_familia_membros USING btree (parceiro_id);
CREATE INDEX idx_contas_a_pagar_cartao ON public.contas_a_pagar USING btree (cartao_id) WHERE (cartao_id IS NOT NULL);
CREATE INDEX idx_contas_a_pagar_conta ON public.contas_a_pagar USING btree (conta_bancaria_id) WHERE (conta_bancaria_id IS NOT NULL);
CREATE INDEX idx_contas_a_pagar_origem ON public.contas_a_pagar USING btree (origem_tipo, origem_id);
CREATE INDEX idx_contas_a_pagar_parceiro ON public.contas_a_pagar USING btree (parceiro_id) WHERE (parceiro_id IS NOT NULL);
CREATE INDEX idx_contas_a_pagar_programa ON public.contas_a_pagar USING btree (programa_id) WHERE (programa_id IS NOT NULL);
CREATE INDEX idx_contas_a_pagar_status ON public.contas_a_pagar USING btree (status_pagamento);
CREATE INDEX idx_contas_a_pagar_vencimento ON public.contas_a_pagar USING btree (data_vencimento);
CREATE UNIQUE INDEX contas_bancarias_unique ON public.contas_bancarias USING btree (codigo_banco, agencia, numero_conta) WHERE ((codigo_banco IS NOT NULL) AND (codigo_banco <> ''::text) AND (agencia IS NOT NULL) AND (agencia <> ''::text) AND (numero_conta IS NOT NULL) AND (numero_conta <> ''::text));
CREATE INDEX idx_contas_receber_localizador ON public.contas_receber USING btree (localizador_id);
CREATE INDEX idx_contas_receber_origem ON public.contas_receber USING btree (origem_tipo, origem_id);
CREATE INDEX idx_contas_receber_parent ON public.contas_receber USING btree (parent_conta_id);
CREATE INDEX idx_contas_receber_status ON public.contas_receber USING btree (status_pagamento);
CREATE INDEX idx_contas_receber_vencimento ON public.contas_receber USING btree (data_vencimento);
CREATE INDEX idx_contas_receber_venda ON public.contas_receber USING btree (venda_id);
CREATE INDEX idx_creditos_recorrentes_data ON public.creditos_recorrentes_log USING btree (data_credito);
CREATE INDEX idx_creditos_recorrentes_programa_clube ON public.creditos_recorrentes_log USING btree (programa_clube_id);
CREATE INDEX idx_estoque_movimentacoes_created_at ON public.estoque_movimentacoes USING btree (created_at);
CREATE INDEX idx_estoque_movimentacoes_data ON public.estoque_movimentacoes USING btree (data_movimentacao DESC);
CREATE INDEX idx_estoque_movimentacoes_data_operacao ON public.estoque_movimentacoes USING btree (data_operacao);
CREATE INDEX idx_estoque_movimentacoes_parceiro ON public.estoque_movimentacoes USING btree (parceiro_id);
CREATE INDEX idx_estoque_movimentacoes_programa ON public.estoque_movimentacoes USING btree (programa_id);
CREATE INDEX idx_estoque_movimentacoes_referencia ON public.estoque_movimentacoes USING btree (referencia_id, referencia_tabela);
CREATE INDEX idx_estoque_movimentacoes_tipo ON public.estoque_movimentacoes USING btree (tipo);
CREATE INDEX idx_estoque_pontos_parceiro_programa ON public.estoque_pontos USING btree (parceiro_id, programa_id);
CREATE INDEX idx_formas_pagamento_ativo ON public.formas_pagamento USING btree (ativo);
CREATE INDEX idx_formas_pagamento_ordem ON public.formas_pagamento USING btree (ordem);
CREATE INDEX idx_localizadores_codigo ON public.localizadores USING btree (codigo_localizador);
CREATE INDEX idx_localizadores_status ON public.localizadores USING btree (status);
CREATE INDEX idx_localizadores_venda ON public.localizadores USING btree (venda_id);
CREATE INDEX idx_logs_data_hora ON public.logs USING btree (data_hora DESC);
CREATE UNIQUE INDEX lojas_cnpj_unique ON public.lojas USING btree (cnpj) WHERE (cnpj IS NOT NULL);
CREATE INDEX idx_parceiro_documentos_parceiro_id ON public.parceiro_documentos USING btree (parceiro_id);
CREATE INDEX idx_parceiro_documentos_tipo ON public.parceiro_documentos USING btree (tipo_documento);
CREATE INDEX idx_cpfs_controle_ano ON public.parceiro_programa_cpfs_controle USING btree (ano);
CREATE INDEX idx_cpfs_controle_parceiro_programa_ano ON public.parceiro_programa_cpfs_controle USING btree (parceiro_id, programa_id, ano);
CREATE UNIQUE INDEX idx_parceiros_id_parceiro_unique ON public.parceiros USING btree (id_parceiro) WHERE ((id_parceiro IS NOT NULL) AND (id_parceiro <> ''::text));
CREATE INDEX idx_parceiros_nome ON public.parceiros USING btree (nome_parceiro);
CREATE INDEX idx_parceiros_tipo ON public.parceiros USING btree (tipo);
CREATE UNIQUE INDEX parceiros_cpf_unique ON public.parceiros USING btree (cpf) WHERE ((cpf IS NOT NULL) AND (cpf <> ''::text));
CREATE UNIQUE INDEX parceiros_nome_parceiro_unique ON public.parceiros USING btree (nome_parceiro) WHERE ((nome_parceiro IS NOT NULL) AND (nome_parceiro <> ''::text));
CREATE INDEX idx_passagens_emitidas_venda_id ON public.passagens_emitidas USING btree (venda_id);
CREATE INDEX idx_perfil_permissoes_perfil_id ON public.perfil_permissoes USING btree (perfil_id);
CREATE UNIQUE INDEX produtos_nome_unique ON public.produtos USING btree (nome) WHERE ((nome IS NOT NULL) AND (nome <> ''::text));
CREATE INDEX idx_programas_clubes_clube_produto ON public.programas_clubes USING btree (clube_produto_id);
CREATE INDEX idx_programas_clubes_conta_familia ON public.programas_clubes USING btree (conta_familia_id);
CREATE INDEX idx_programas_clubes_parceiro ON public.programas_clubes USING btree (parceiro_id);
CREATE INDEX idx_programas_clubes_programa ON public.programas_clubes USING btree (programa_id);
CREATE INDEX idx_programas_clubes_status_programa ON public.programas_clubes USING btree (status_programa_id);
CREATE INDEX idx_programas_membros_cartao ON public.programas_membros USING btree (cartao_id);
CREATE INDEX idx_programas_membros_clube ON public.programas_membros USING btree (clube_produto_id);
CREATE INDEX idx_programas_membros_parceiro ON public.programas_membros USING btree (parceiro_id);
CREATE INDEX idx_programas_membros_programa ON public.programas_membros USING btree (programa_id);
CREATE INDEX idx_status_programa_chave ON public.status_programa USING btree (chave_referencia);
CREATE INDEX idx_tipos_compra_ativo ON public.tipos_compra USING btree (ativo);
CREATE INDEX idx_transferencia_pessoas_data ON public.transferencia_pessoas USING btree (data_transferencia);
CREATE INDEX idx_transferencia_pessoas_destino ON public.transferencia_pessoas USING btree (destino_parceiro_id);
CREATE INDEX idx_transferencia_pessoas_destino_programa ON public.transferencia_pessoas USING btree (destino_programa_id);
CREATE INDEX idx_transferencia_pessoas_origem ON public.transferencia_pessoas USING btree (origem_parceiro_id);
CREATE INDEX idx_transferencia_pessoas_programa ON public.transferencia_pessoas USING btree (programa_id);
CREATE INDEX idx_transferencia_pontos_data ON public.transferencia_pontos USING btree (data_transferencia);
CREATE INDEX idx_transferencia_pontos_destino_programa ON public.transferencia_pontos USING btree (destino_programa_id);
CREATE INDEX idx_transferencia_pontos_origem_programa ON public.transferencia_pontos USING btree (origem_programa_id);
CREATE INDEX idx_transferencia_pontos_parceiro ON public.transferencia_pontos USING btree (parceiro_id);
CREATE INDEX idx_usuario_permissoes_recurso ON public.usuario_permissoes USING btree (recurso);
CREATE INDEX idx_usuario_permissoes_usuario_id ON public.usuario_permissoes USING btree (usuario_id);
CREATE INDEX idx_usuarios_perfil_id ON public.usuarios USING btree (perfil_id);
CREATE INDEX idx_venda_lotes_compra_id ON public.venda_lotes USING btree (compra_id);
CREATE INDEX idx_venda_lotes_venda_id ON public.venda_lotes USING btree (venda_id);
CREATE INDEX idx_vendas_cliente_id ON public.vendas USING btree (cliente_id);
CREATE INDEX idx_vendas_comissao_conta ON public.vendas USING btree (comissao_conta_bancaria_id);
CREATE INDEX idx_vendas_data ON public.vendas USING btree (data_venda);
CREATE INDEX idx_vendas_ordem_compra ON public.vendas USING btree (ordem_compra);
CREATE INDEX idx_vendas_parceiro ON public.vendas USING btree (parceiro_id);
CREATE INDEX idx_vendas_programa ON public.vendas USING btree (programa_id);
CREATE INDEX idx_vendas_status ON public.vendas USING btree (status);
CREATE INDEX idx_vendas_tipo_cliente ON public.vendas USING btree (tipo_cliente);

-- FUNÇÕES

CREATE OR REPLACE FUNCTION public.admin_delete_venda(p_venda_id uuid, p_usuario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_nivel_acesso text;
  v_status       text;
BEGIN
  SELECT nivel_acesso INTO v_nivel_acesso
  FROM usuarios WHERE id = p_usuario_id;

  IF v_nivel_acesso IS NULL OR v_nivel_acesso != 'ADM' THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir vendas.';
  END IF;

  PERFORM set_config('app.is_admin', 'true', true);

  SELECT status INTO v_status FROM vendas WHERE id = p_venda_id;

  IF v_status IS DISTINCT FROM 'cancelada' THEN
    UPDATE vendas SET status = 'cancelada', updated_at = now() WHERE id = p_venda_id;
  END IF;

  DELETE FROM vendas WHERE id = p_venda_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_estoque_pontos(p_parceiro_id uuid, p_programa_id uuid, p_quantidade numeric, p_tipo text, p_valor_total numeric DEFAULT 0, p_origem text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text, p_referencia_id uuid DEFAULT NULL::uuid, p_referencia_tabela text DEFAULT NULL::text, p_tipo_movimentacao text DEFAULT NULL::text, p_data_operacao date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_saldo_anterior        numeric;
  v_saldo_posterior       numeric;
  v_valor_anterior        numeric;
  v_valor_posterior       numeric;
  v_custo_medio_anterior  numeric;
  v_custo_medio_posterior numeric;
  v_tipo_movimentacao     text;
  v_valor_movimentacao    numeric;
BEGIN
  INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, valor_total, custo_medio)
  VALUES (p_parceiro_id, p_programa_id, 0, 0, 0)
  ON CONFLICT (parceiro_id, programa_id) DO NOTHING;

  SELECT saldo_atual, valor_total, custo_medio
  INTO v_saldo_anterior, v_valor_anterior, v_custo_medio_anterior
  FROM estoque_pontos
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  IF p_tipo = 'Entrada' OR p_tipo = 'Compra de Pontos/Milhas' THEN
    v_tipo_movimentacao  := COALESCE(p_tipo_movimentacao, 'entrada');
    v_valor_movimentacao := p_valor_total;

    v_saldo_posterior := v_saldo_anterior + p_quantidade;
    v_valor_posterior := v_valor_anterior + p_valor_total;

    IF v_saldo_posterior > 0 THEN
      v_custo_medio_posterior := (v_valor_posterior / v_saldo_posterior) * 1000;
    ELSE
      v_custo_medio_posterior := 0;
    END IF;

  ELSIF p_tipo = 'Saída' THEN
    v_tipo_movimentacao  := COALESCE(p_tipo_movimentacao, 'saida');
    v_valor_movimentacao := (p_quantidade * v_custo_medio_anterior / 1000);

    v_saldo_posterior := v_saldo_anterior - p_quantidade;
    v_valor_posterior := v_valor_anterior - v_valor_movimentacao;

    IF v_saldo_posterior < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para saída. Saldo atual: %, Quantidade solicitada: %, Origem: %',
        v_saldo_anterior, p_quantidade, COALESCE(p_origem, 'não informada');
    END IF;

    IF v_valor_posterior < 0 THEN
      v_valor_posterior := 0;
    END IF;

    IF v_saldo_posterior = 0 THEN
      v_custo_medio_posterior := 0;
      v_valor_posterior := 0;
    ELSE
      v_custo_medio_posterior := v_custo_medio_anterior;
    END IF;

  ELSE
    RAISE EXCEPTION 'Tipo inválido: %. Use "Entrada" ou "Saída"', p_tipo;
  END IF;

  UPDATE estoque_pontos
  SET
    saldo_atual = v_saldo_posterior,
    valor_total = v_valor_posterior,
    custo_medio = v_custo_medio_posterior,
    updated_at  = now()
  WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

  INSERT INTO estoque_movimentacoes (
    parceiro_id,
    programa_id,
    tipo,
    quantidade,
    valor_total,
    saldo_anterior,
    saldo_posterior,
    custo_medio_anterior,
    custo_medio_posterior,
    origem,
    observacao,
    referencia_id,
    referencia_tabela,
    data_operacao
  ) VALUES (
    p_parceiro_id,
    p_programa_id,
    v_tipo_movimentacao,
    p_quantidade,
    v_valor_movimentacao,
    v_saldo_anterior,
    v_saldo_posterior,
    v_custo_medio_anterior,
    v_custo_medio_posterior,
    p_origem,
    p_observacao,
    p_referencia_id,
    p_referencia_tabela,
    COALESCE(p_data_operacao, CURRENT_DATE)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_saldo_localizador()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
-- Atualizar saldo restante e valor pago do localizador
IF NEW.localizador_id IS NOT NULL THEN
UPDATE localizadores
SET 
valor_pago = COALESCE((
SELECT SUM(valor_pago)
FROM contas_receber
WHERE localizador_id = NEW.localizador_id
AND status_pagamento = 'pago'
), 0),
saldo_restante = valor_total - COALESCE((
SELECT SUM(valor_pago)
FROM contas_receber
WHERE localizador_id = NEW.localizador_id
AND status_pagamento = 'pago'
), 0),
updated_at = now()
WHERE id = NEW.localizador_id;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_cpfs_disponiveis(p_parceiro_id uuid, p_programa_id uuid, p_status_programa_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
v_limite integer;
v_emitidos integer;
v_ano_atual integer;
BEGIN
v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);

SELECT limite_cpfs_ano INTO v_limite
FROM status_programa
WHERE id = p_status_programa_id;

IF v_limite IS NULL OR v_limite = 0 THEN
RETURN 999999;
END IF;

SELECT COALESCE(cpfs_emitidos, 0) INTO v_emitidos
FROM parceiro_programa_cpfs_controle
WHERE parceiro_id = p_parceiro_id
AND programa_id = p_programa_id
AND ano = v_ano_atual;

v_emitidos := COALESCE(v_emitidos, 0);

RETURN GREATEST(0, v_limite - v_emitidos);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_custo_total_reais(p_quantidade numeric, p_custo_milheiro numeric)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
BEGIN
-- Custo total = (quantidade / 1000) * custo_por_milheiro
RETURN (p_quantidade / 1000.0) * p_custo_milheiro;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_data_vencimento(p_forma_pagamento text, p_cartao_id uuid, p_data_vencimento_manual date, p_data_base date, p_parcela integer)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_dia_fechamento integer;
  v_dia_vencimento integer;
  v_mes integer;
  v_ano integer;
BEGIN
  -- Dinheiro: usa data_vencimento_manual + offset de parcelas
  IF p_forma_pagamento = 'Dinheiro' THEN
    IF p_data_vencimento_manual IS NOT NULL THEN
      RETURN p_data_vencimento_manual + ((p_parcela - 1) * INTERVAL '1 month');
    ELSE
      RETURN p_data_base + ((p_parcela - 1) * INTERVAL '1 month');
    END IF;
  END IF;

  -- Crédito ou Débito com cartão: usa dia_fechamento e dia_vencimento do cartão
  IF (p_forma_pagamento = 'Crédito' OR p_forma_pagamento = 'Débito') AND p_cartao_id IS NOT NULL THEN
    SELECT dia_fechamento, dia_vencimento
    INTO v_dia_fechamento, v_dia_vencimento
    FROM cartoes_credito
    WHERE id = p_cartao_id;

    IF v_dia_vencimento IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM p_data_base)::integer;
      v_ano := EXTRACT(YEAR FROM p_data_base)::integer;

      -- Se passou do fechamento, avança para o próximo ciclo
      IF v_dia_fechamento IS NOT NULL AND EXTRACT(DAY FROM p_data_base)::integer >= v_dia_fechamento THEN
        v_mes := v_mes + 1;
        IF v_mes > 12 THEN v_mes := 1; v_ano := v_ano + 1; END IF;
      END IF;

      -- Quando dia_vencimento < dia_fechamento, o vencimento cai no mês SEGUINTE ao fechamento
      -- Exemplo: fecha=25, vence=5 → compra em abr fecha em abr, mas vence em mai
      IF v_dia_fechamento IS NOT NULL AND v_dia_vencimento < v_dia_fechamento THEN
        v_mes := v_mes + 1;
        IF v_mes > 12 THEN v_mes := 1; v_ano := v_ano + 1; END IF;
      END IF;

      -- Avança pelos meses das parcelas
      v_mes := v_mes + (p_parcela - 1);
      WHILE v_mes > 12 LOOP
        v_mes := v_mes - 12;
        v_ano := v_ano + 1;
      END LOOP;

      RETURN make_date(
        v_ano,
        v_mes,
        LEAST(
          v_dia_vencimento,
          EXTRACT(DAY FROM (make_date(v_ano, v_mes, 1) + INTERVAL '1 month - 1 day'))::integer
        )
      );
    END IF;
  END IF;

  -- Fallback: data_base + offset de parcelas
  RETURN p_data_base + ((p_parcela - 1) * INTERVAL '1 month');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_proxima_data_credito(p_data_base date, p_frequencia text)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
CASE p_frequencia
WHEN 'mensal' THEN
RETURN p_data_base + INTERVAL '1 month';
WHEN 'trimestral' THEN
RETURN p_data_base + INTERVAL '3 months';
WHEN 'anual' THEN
RETURN p_data_base + INTERVAL '1 year';
ELSE
RETURN NULL;
END CASE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_saldo_parceiro_programa(p_parceiro_id uuid, p_programa_id uuid)
 RETURNS TABLE(saldo numeric, custo_medio numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ep.saldo_atual::numeric AS saldo,
    ep.custo_medio::numeric AS custo_medio
  FROM estoque_pontos ep
  WHERE ep.parceiro_id = p_parceiro_id
    AND ep.programa_id = p_programa_id;

  -- Se não encontrou registro, retorna zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_total_pontos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
NEW.total_pontos := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_membro_nao_e_titular()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
v_membro_count integer;
BEGIN
-- Se não tem programa ou parceiro principal definido, permite
IF NEW.programa_id IS NULL OR NEW.parceiro_principal_id IS NULL THEN
RETURN NEW;
END IF;

-- Só validar se a conta está ATIVA
IF NEW.status != 'Ativa' THEN
RETURN NEW;
END IF;

-- Verifica se o parceiro é membro ativo de alguma conta ATIVA deste programa
SELECT COUNT(*) INTO v_membro_count
FROM conta_familia_membros cfm
JOIN conta_familia cf ON cfm.conta_familia_id = cf.id
WHERE cfm.parceiro_id = NEW.parceiro_principal_id
AND cf.programa_id = NEW.programa_id
AND cf.status = 'Ativa'
AND cfm.status = 'Ativo'
AND cf.id != NEW.id;

IF v_membro_count > 0 THEN
RAISE EXCEPTION 'Este parceiro já é membro ativo de outra conta deste programa e não pode ser titular';
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_membro_programa_duplicado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
v_programa_id uuid;
v_membro_count integer;
BEGIN
-- Só validar se o membro está ATIVO
IF NEW.status != 'Ativo' THEN
RETURN NEW;
END IF;

-- Busca o programa_id da conta família onde está tentando adicionar
SELECT programa_id INTO v_programa_id
FROM conta_familia
WHERE id = NEW.conta_familia_id;

-- Se não tem programa definido, permite
IF v_programa_id IS NULL THEN
RETURN NEW;
END IF;

-- Verifica se o parceiro já é membro ativo de outra conta ATIVA deste mesmo programa
SELECT COUNT(*) INTO v_membro_count
FROM conta_familia_membros cfm
JOIN conta_familia cf ON cfm.conta_familia_id = cf.id
WHERE cfm.parceiro_id = NEW.parceiro_id
AND cf.programa_id = v_programa_id
AND cfm.status = 'Ativo'
AND cf.status = 'Ativa'
AND cfm.conta_familia_id != NEW.conta_familia_id;

IF v_membro_count > 0 THEN
RAISE EXCEPTION 'Este parceiro já é membro ativo de outra conta deste programa';
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_titular_nao_e_membro()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
v_programa_id uuid;
v_conta_count integer;
BEGIN
-- Só validar se o membro está ATIVO
IF NEW.status != 'Ativo' THEN
RETURN NEW;
END IF;

-- Busca o programa_id da conta família
SELECT programa_id INTO v_programa_id
FROM conta_familia
WHERE id = NEW.conta_familia_id;

-- Se não tem programa definido, permite
IF v_programa_id IS NULL THEN
RETURN NEW;
END IF;

-- Verifica se o parceiro é titular de alguma conta ATIVA deste programa
SELECT COUNT(*) INTO v_conta_count
FROM conta_familia
WHERE parceiro_principal_id = NEW.parceiro_id
AND programa_id = v_programa_id
AND status = 'Ativa'
AND id != NEW.conta_familia_id;

IF v_conta_count > 0 THEN
RAISE EXCEPTION 'Este parceiro já é titular de outra conta ativa deste programa e não pode ser membro adicional';
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
DELETE FROM public.logs
WHERE data_hora < NOW() - INTERVAL '90 days';
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_atividade_downgrade_upgrade()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_clube RECORD;
v_data_inicio date;
v_data_fim date;
v_ultima_exclusao timestamptz;
BEGIN
-- Definir período (5 dias antes até 30 dias depois)
v_data_inicio := CURRENT_DATE;
v_data_fim := CURRENT_DATE + INTERVAL '30 days';

-- Buscar clubes com data de downgrade/upgrade próxima
FOR v_clube IN
SELECT 
pc.id,
pc.parceiro_id,
pc.programa_id,
pc.downgrade_upgrade_data,
pa.nome_parceiro,
pf.nome as programa_nome
FROM programas_clubes pc
JOIN parceiros pa ON pa.id = pc.parceiro_id
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.downgrade_upgrade_data IS NOT NULL
AND pc.downgrade_upgrade_data >= v_data_inicio
AND pc.downgrade_upgrade_data <= v_data_fim
AND pc.tem_clube = true
LOOP
-- Verificar se já existe atividade ativa (não excluída)
IF NOT EXISTS (
SELECT 1 FROM atividades
WHERE referencia_id = v_clube.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_downgrade'
AND data_prevista = v_clube.downgrade_upgrade_data
AND status != 'cancelado'
) THEN
-- Verificar se deve criar lembrete (5 dias antes ou já passou)
IF v_clube.downgrade_upgrade_data <= CURRENT_DATE + INTERVAL '5 days' THEN
-- Buscar última vez que foi excluído
SELECT MAX(updated_at) INTO v_ultima_exclusao
FROM atividades
WHERE referencia_id = v_clube.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_downgrade'
AND data_prevista = v_clube.downgrade_upgrade_data
AND status = 'cancelado';

-- Só criar se nunca foi excluído OU se foi excluído há mais de 1 dia
IF v_ultima_exclusao IS NULL OR v_ultima_exclusao < CURRENT_DATE - INTERVAL '1 day' THEN
-- Criar atividade de lembrete
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
data_prevista,
referencia_id,
referencia_tabela,
status,
prioridade,
observacoes,
created_at
) VALUES (
'lembrete_downgrade',
'Lembrete: Downgrade/Upgrade',
'Verificar necessidade de Downgrade/Upgrade para ' || v_clube.nome_parceiro || ' - ' || v_clube.programa_nome,
v_clube.parceiro_id,
v_clube.nome_parceiro,
v_clube.programa_id,
v_clube.programa_nome,
v_clube.downgrade_upgrade_data,
v_clube.id,
'programas_clubes',
'pendente',
'normal',
'Verificar Downgrade/Upgrade agendado para ' || TO_CHAR(v_clube.downgrade_upgrade_data, 'DD/MM/YYYY'),
now()
);
END IF;
END IF;
END IF;
END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_atividade_milhas_expirando()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_clube RECORD;
BEGIN
-- Buscar todos os clubes com milhas_expirando_data definido
FOR v_clube IN
SELECT id
FROM programas_clubes
WHERE milhas_expirando_data IS NOT NULL
AND milhas_expirando_data >= CURRENT_DATE
AND milhas_expirando_data <= CURRENT_DATE + INTERVAL '30 days'
LOOP
-- Criar lembrete individual
PERFORM criar_lembrete_milhas_expirando_individual(v_clube.id);
END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_atividades_clube()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
v_proximo_credito date;
v_mes int;
v_ano int;
v_dias_no_mes int;
BEGIN
IF NEW.tem_clube = true 
AND NEW.dia_cobranca IS NOT NULL 
AND NEW.quantidade_pontos > 0 THEN

v_mes := EXTRACT(MONTH FROM CURRENT_DATE)::int;
v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::int;

-- Tenta criar a data no mês atual
v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::int;

IF NEW.dia_cobranca > v_dias_no_mes THEN
v_proximo_credito := MAKE_DATE(v_ano, v_mes, v_dias_no_mes);
ELSE
v_proximo_credito := MAKE_DATE(v_ano, v_mes, NEW.dia_cobranca);
END IF;

-- Se a data já passou, avança para o próximo mês
IF v_proximo_credito < CURRENT_DATE THEN
IF v_mes = 12 THEN
v_mes := 1;
v_ano := v_ano + 1;
ELSE
v_mes := v_mes + 1;
END IF;

v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::int;

IF NEW.dia_cobranca > v_dias_no_mes THEN
v_proximo_credito := MAKE_DATE(v_ano, v_mes, v_dias_no_mes);
ELSE
v_proximo_credito := MAKE_DATE(v_ano, v_mes, NEW.dia_cobranca);
END IF;
END IF;

-- Criar atividade de crédito mensal
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
quantidade_pontos,
data_prevista,
referencia_id,
referencia_tabela,
prioridade
)
SELECT
'clube_credito_mensal',
'Crédito mensal de clube',
'Crédito mensal de ' || NEW.quantidade_pontos || ' pontos do clube ' || pr.nome,
NEW.parceiro_id,
p.nome_parceiro,
NEW.programa_id,
pf.nome,
NEW.quantidade_pontos,
v_proximo_credito,
NEW.id,
'programas_clubes',
'alta'
FROM parceiros p
LEFT JOIN programas_fidelidade pf ON pf.id = NEW.programa_id
LEFT JOIN produtos pr ON pr.id = NEW.clube_produto_id
WHERE p.id = NEW.parceiro_id;

-- Se tem bônus e é primeira assinatura (hoje), criar atividade de bônus
IF NEW.bonus_quantidade_pontos > 0 AND NEW.data_ultima_assinatura = CURRENT_DATE THEN
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
quantidade_pontos,
data_prevista,
referencia_id,
referencia_tabela,
prioridade
)
SELECT
'clube_credito_bonus',
'Bônus de boas-vindas do clube',
'Bônus de ' || NEW.bonus_quantidade_pontos || ' pontos do clube ' || pr.nome,
NEW.parceiro_id,
p.nome_parceiro,
NEW.programa_id,
pf.nome,
NEW.bonus_quantidade_pontos,
CURRENT_DATE,
NEW.id,
'programas_clubes',
'alta'
FROM parceiros p
LEFT JOIN programas_fidelidade pf ON pf.id = NEW.programa_id
LEFT JOIN produtos pr ON pr.id = NEW.clube_produto_id
WHERE p.id = NEW.parceiro_id;
END IF;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_atividades_transferencia()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
-- Atividade para recebimento principal
IF NEW.destino_data_recebimento > CURRENT_DATE THEN
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
quantidade_pontos,
data_prevista,
referencia_id,
referencia_tabela,
prioridade
)
SELECT
'transferencia_entrada',
'Entrada de pontos agendada',
'Transferência de ' || NEW.destino_quantidade || ' pontos',
NEW.parceiro_id,
p.nome,
NEW.destino_programa_id,
pf.nome,
NEW.destino_quantidade,
NEW.destino_data_recebimento,
NEW.id,
'transferencia_pontos',
'normal'
FROM parceiros p
LEFT JOIN programas_fidelidade pf ON pf.id = NEW.destino_programa_id
WHERE p.id = NEW.parceiro_id;
END IF;

-- Atividade para bônus (se houver)
IF NEW.destino_data_recebimento_bonus IS NOT NULL 
AND NEW.destino_data_recebimento_bonus > CURRENT_DATE 
AND NEW.destino_quantidade_bonus > 0 THEN
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
quantidade_pontos,
data_prevista,
referencia_id,
referencia_tabela,
prioridade
)
SELECT
'transferencia_bonus',
'Bônus de transferência agendado',
'Bônus de ' || NEW.destino_quantidade_bonus || ' pontos (' || NEW.destino_bonus_percentual || '%)',
NEW.parceiro_id,
p.nome,
NEW.destino_programa_id,
pf.nome,
NEW.destino_quantidade_bonus,
NEW.destino_data_recebimento_bonus,
NEW.id,
'transferencia_pontos',
'normal'
FROM parceiros p
LEFT JOIN programas_fidelidade pf ON pf.id = NEW.destino_programa_id
WHERE p.id = NEW.parceiro_id;
END IF;

-- Atividade para bumerangue (se houver)
IF NEW.bumerangue_data_recebimento IS NOT NULL 
AND NEW.bumerangue_data_recebimento > CURRENT_DATE 
AND NEW.bumerangue_quantidade_bonus > 0 THEN
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
quantidade_pontos,
data_prevista,
referencia_id,
referencia_tabela,
prioridade
)
SELECT
'bumerangue_retorno',
'Retorno de bumerangue agendado',
'Retorno de ' || NEW.bumerangue_quantidade_bonus || ' pontos (' || NEW.bumerangue_bonus_percentual || '%)',
NEW.parceiro_id,
p.nome,
NEW.origem_programa_id,
pf.nome,
NEW.bumerangue_quantidade_bonus,
NEW.bumerangue_data_recebimento,
NEW.id,
'transferencia_pontos',
'alta'
FROM parceiros p
LEFT JOIN programas_fidelidade pf ON pf.id = NEW.origem_programa_id
WHERE p.id = NEW.parceiro_id;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_contas_receber_localizador()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
valor_parcela numeric;
data_venc date;
i integer;
BEGIN
-- Só criar contas a receber se valor_total > 0
IF NEW.valor_total > 0 AND NEW.parcelas > 0 THEN
-- Calcular valor de cada parcela
valor_parcela := NEW.valor_total / NEW.parcelas;

-- Criar as contas a receber para cada parcela
FOR i IN 1..NEW.parcelas LOOP
-- Calcular data de vencimento (30 dias para cada parcela)
data_venc := COALESCE(NEW.data_emissao, NEW.created_at::date) + (i * 30);

INSERT INTO contas_receber (
venda_id,
localizador_id,
numero_parcela,
total_parcelas,
valor_parcela,
data_vencimento,
status_pagamento,
forma_pagamento
) VALUES (
NEW.venda_id,
NEW.id,
i,
NEW.parcelas,
valor_parcela,
data_venc,
'pendente',
NEW.forma_pagamento
);
END LOOP;

-- Atualizar saldo restante do localizador
UPDATE localizadores
SET saldo_restante = NEW.valor_total
WHERE id = NEW.id;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_lembrete_downgrade_individual(p_clube_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_clube RECORD;
v_ultima_exclusao timestamptz;
BEGIN
-- Buscar dados do clube
SELECT 
pc.id,
pc.parceiro_id,
pc.programa_id,
pc.downgrade_upgrade_data,
pa.nome_parceiro,
pf.nome as programa_nome
INTO v_clube
FROM programas_clubes pc
JOIN parceiros pa ON pa.id = pc.parceiro_id
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.id = p_clube_id
AND pc.downgrade_upgrade_data IS NOT NULL
AND pc.tem_clube = true;

-- Se não encontrou ou não tem data, retornar
IF NOT FOUND OR v_clube.downgrade_upgrade_data IS NULL THEN
RETURN;
END IF;

-- Verificar se já existe atividade ativa (não excluída)
IF EXISTS (
SELECT 1 FROM atividades
WHERE referencia_id = v_clube.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_downgrade'
AND data_prevista = v_clube.downgrade_upgrade_data
AND status != 'cancelado'
) THEN
RETURN;
END IF;

-- Verificar se deve criar lembrete (5 dias antes ou já passou, mas ainda dentro de 30 dias)
IF v_clube.downgrade_upgrade_data >= CURRENT_DATE 
AND v_clube.downgrade_upgrade_data <= CURRENT_DATE + INTERVAL '30 days'
AND v_clube.downgrade_upgrade_data <= CURRENT_DATE + INTERVAL '5 days' THEN

-- Buscar última vez que foi excluído
SELECT MAX(updated_at) INTO v_ultima_exclusao
FROM atividades
WHERE referencia_id = v_clube.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_downgrade'
AND data_prevista = v_clube.downgrade_upgrade_data
AND status = 'cancelado';

-- Só criar se nunca foi excluído OU se foi excluído há mais de 1 dia
IF v_ultima_exclusao IS NULL OR v_ultima_exclusao < CURRENT_DATE - INTERVAL '1 day' THEN
-- Criar atividade de lembrete
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
data_prevista,
referencia_id,
referencia_tabela,
status,
prioridade,
observacoes,
created_at
) VALUES (
'lembrete_downgrade',
'Lembrete: Downgrade/Upgrade',
'Verificar necessidade de Downgrade/Upgrade para ' || v_clube.nome_parceiro || ' - ' || v_clube.programa_nome,
v_clube.parceiro_id,
v_clube.nome_parceiro,
v_clube.programa_id,
v_clube.programa_nome,
v_clube.downgrade_upgrade_data,
v_clube.id,
'programas_clubes',
'pendente',
'normal',
'Verificar Downgrade/Upgrade agendado para ' || TO_CHAR(v_clube.downgrade_upgrade_data, 'DD/MM/YYYY'),
now()
);
END IF;
END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_lembrete_milhas_expirando_individual(p_clube_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_clube RECORD;
v_ultima_exclusao timestamptz;
BEGIN
-- Buscar dados do clube
SELECT 
pc.id,
pc.parceiro_id,
pc.programa_id,
pc.milhas_expirando_data,
pa.nome_parceiro,
pf.nome as programa_nome
INTO v_clube
FROM programas_clubes pc
JOIN parceiros pa ON pa.id = pc.parceiro_id
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.id = p_clube_id
AND pc.milhas_expirando_data IS NOT NULL;

-- Se não encontrou ou não tem data, retornar
IF NOT FOUND OR v_clube.milhas_expirando_data IS NULL THEN
RETURN;
END IF;

-- Verificar se já existe atividade ativa (não excluída)
IF EXISTS (
SELECT 1 FROM atividades
WHERE referencia_id = v_clube.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_milhas_expirando'
AND data_prevista = v_clube.milhas_expirando_data
AND status != 'cancelado'
) THEN
RETURN;
END IF;

-- Verificar se deve criar lembrete (5 dias antes ou já passou, mas ainda dentro de 30 dias)
IF v_clube.milhas_expirando_data >= CURRENT_DATE 
AND v_clube.milhas_expirando_data <= CURRENT_DATE + INTERVAL '30 days'
AND v_clube.milhas_expirando_data <= CURRENT_DATE + INTERVAL '5 days' THEN

-- Buscar última vez que foi excluído
SELECT MAX(updated_at) INTO v_ultima_exclusao
FROM atividades
WHERE referencia_id = v_clube.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_milhas_expirando'
AND data_prevista = v_clube.milhas_expirando_data
AND status = 'cancelado';

-- Só criar se nunca foi excluído OU se foi excluído há mais de 1 dia
IF v_ultima_exclusao IS NULL OR v_ultima_exclusao < CURRENT_DATE - INTERVAL '1 day' THEN
-- Criar atividade de lembrete
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
data_prevista,
referencia_id,
referencia_tabela,
status,
prioridade,
observacoes,
created_at
) VALUES (
'lembrete_milhas_expirando',
'Lembrete: Milhas Expirando',
'Atenção! Milhas expirando para ' || v_clube.nome_parceiro || ' - ' || v_clube.programa_nome,
v_clube.parceiro_id,
v_clube.nome_parceiro,
v_clube.programa_id,
v_clube.programa_nome,
v_clube.milhas_expirando_data,
v_clube.id,
'programas_clubes',
'pendente',
'alta',
'Milhas com vencimento em ' || TO_CHAR(v_clube.milhas_expirando_data, 'DD/MM/YYYY'),
now()
);
END IF;
END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_lembrete_transferencia_pessoas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_origem_parceiro_nome text;
v_destino_parceiro_nome text;
v_programa_nome text;
v_descricao text;
BEGIN
IF NEW.status = 'Pendente' THEN
SELECT nome_parceiro INTO v_origem_parceiro_nome
FROM parceiros WHERE id = NEW.origem_parceiro_id;

SELECT nome_parceiro INTO v_destino_parceiro_nome
FROM parceiros WHERE id = NEW.destino_parceiro_id;

SELECT nome INTO v_programa_nome
FROM programas_fidelidade WHERE id = NEW.programa_id;

v_descricao := 'Transferência entre pessoas: ' || 
NEW.quantidade::text || ' pontos de ' || 
v_origem_parceiro_nome || ' para ' || 
v_destino_parceiro_nome || ' no programa ' || 
v_programa_nome || '. ' ||
'Entrada programada para ' || TO_CHAR(NEW.data_recebimento, 'DD/MM/YYYY') || '.';

INSERT INTO atividades (
tipo_atividade,
descricao,
data_prevista,
status,
usuario_id
) VALUES (
'outro',
v_descricao,
NEW.data_recebimento,
'pendente',
NEW.created_by
);
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_lembretes_downgrade()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_registro RECORD;
BEGIN
FOR v_registro IN
SELECT 
pc.id,
pc.parceiro_id,
pc.programa_id,
pc.downgrade_upgrade_data,
p.nome_parceiro,
pf.nome as programa_nome
FROM programas_clubes pc
JOIN parceiros p ON p.id = pc.parceiro_id
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.tem_clube = true
AND pc.downgrade_upgrade_data IS NOT NULL
AND pc.downgrade_upgrade_data >= CURRENT_DATE
AND pc.downgrade_upgrade_data <= CURRENT_DATE + INTERVAL '7 days'
AND NOT EXISTS (
SELECT 1 FROM atividades a
WHERE a.tipo_atividade = 'lembrete_downgrade'
AND a.referencia_id = pc.id
AND a.data_prevista = pc.downgrade_upgrade_data
AND a.status = 'pendente'
)
LOOP
INSERT INTO atividades (
tipo_atividade,
tipo_lembrete,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
data_prevista,
status,
prioridade,
referencia_id,
referencia_tabela
) VALUES (
'lembrete_downgrade',
'downgrade_verificar',
'Lembrete de Downgrade',
format('Verificar downgrade do programa %s', v_registro.programa_nome),
v_registro.parceiro_id,
v_registro.nome_parceiro,
v_registro.programa_id,
v_registro.programa_nome,
v_registro.downgrade_upgrade_data,
'pendente',
'alta',
v_registro.id,
'programas_clubes'
);
END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_lembretes_milhas_expirando()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_registro RECORD;
v_dias_aviso integer := 30;
BEGIN
FOR v_registro IN
SELECT 
pc.id,
pc.parceiro_id,
pc.programa_id,
pc.milhas_expirando_data,
p.nome_parceiro,
pf.nome as programa_nome
FROM programas_clubes pc
JOIN parceiros p ON p.id = pc.parceiro_id
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.milhas_expirando_data IS NOT NULL
AND pc.milhas_expirando_data >= CURRENT_DATE
AND pc.milhas_expirando_data <= CURRENT_DATE + v_dias_aviso
AND NOT EXISTS (
SELECT 1 FROM atividades a
WHERE a.tipo_atividade = 'lembrete_milhas_expirando'
AND a.referencia_id = pc.id
AND a.data_prevista = pc.milhas_expirando_data
AND a.status = 'pendente'
)
LOOP
INSERT INTO atividades (
tipo_atividade,
tipo_lembrete,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
data_prevista,
status,
prioridade,
referencia_id,
referencia_tabela
) VALUES (
'lembrete_milhas_expirando',
'milhas_expirando',
'Milhas Expirando',
format('Atenção! Milhas expirando para %s - %s em %s', 
v_registro.nome_parceiro,
v_registro.programa_nome,
TO_CHAR(v_registro.milhas_expirando_data, 'DD/MM/YYYY')
),
v_registro.parceiro_id,
v_registro.nome_parceiro,
v_registro.programa_id,
v_registro.programa_nome,
v_registro.milhas_expirando_data,
'pendente',
'alta',
v_registro.id,
'programas_clubes'
);
END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.decrementar_cpf_venda_deletada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
v_ano integer;
BEGIN
-- Estornar CPF somente se a venda estava concluída (não cancelada, pois cancelamento já estornou)
IF OLD.status = 'concluida' THEN
v_ano := EXTRACT(YEAR FROM OLD.data_venda)::integer;

UPDATE parceiro_programa_cpfs_controle
SET cpfs_emitidos = GREATEST(0, cpfs_emitidos - 1),
updated_at = now()
WHERE parceiro_id = OLD.parceiro_id
AND programa_id = OLD.programa_id
AND ano = v_ano;
END IF;

RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.definir_status_inicial_transferencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
-- Definir status dos pontos principais
IF NEW.destino_data_recebimento <= CURRENT_DATE THEN
NEW.status := 'Concluído';
ELSE
NEW.status := 'Pendente';
END IF;

-- Definir status do bônus de destino
IF NEW.destino_quantidade_bonus > 0 AND NEW.destino_data_recebimento_bonus IS NOT NULL THEN
IF NEW.destino_data_recebimento_bonus <= CURRENT_DATE THEN
NEW.status_bonus_destino := 'Concluído';
ELSE
NEW.status_bonus_destino := 'Pendente';
END IF;
ELSE
NEW.status_bonus_destino := 'N/A';
END IF;

-- Definir status do bônus bumerangue
IF NEW.bumerangue_quantidade_bonus > 0 AND NEW.bumerangue_data_recebimento IS NOT NULL THEN
IF NEW.bumerangue_data_recebimento <= CURRENT_DATE THEN
NEW.status_bonus_bumerangue := 'Concluído';
ELSE
NEW.status_bonus_bumerangue := 'Pendente';
END IF;
ELSE
NEW.status_bonus_bumerangue := 'N/A';
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.definir_status_inicial_transferencia_pessoas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
-- Definir status baseado na data de recebimento
IF NEW.data_recebimento <= CURRENT_DATE THEN
NEW.status := 'Concluído';
ELSE
NEW.status := 'Pendente';
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.deletar_atividades_clube()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
-- Deletar TODAS as atividades relacionadas ao clube que está sendo deletado
DELETE FROM atividades
WHERE referencia_tabela = 'programas_clubes'
AND referencia_id = OLD.id;

RAISE NOTICE 'Atividades do clube % foram removidas', OLD.id;

RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gerar_lembretes_clubes()
 RETURNS TABLE(atividade_id uuid, parceiro_nome text, programa_nome text, data_prevista date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_clube RECORD;
v_dia_credito int;
v_data_prevista date;
v_atividade_id uuid;
v_ja_existe boolean;
v_mes_atual int;
v_ano_atual int;
v_dias_no_mes int;
BEGIN
v_mes_atual := EXTRACT(MONTH FROM CURRENT_DATE)::int;
v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE)::int;

FOR v_clube IN
SELECT 
pc.*,
p.nome_parceiro,
pf.nome as programa_nome,
pr.nome as produto_nome
FROM programas_clubes pc
INNER JOIN parceiros p ON p.id = pc.parceiro_id
LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
WHERE pc.tem_clube = true
AND pc.data_ultima_assinatura IS NOT NULL
AND pc.quantidade_pontos > 0
LOOP
v_dia_credito := EXTRACT(DAY FROM v_clube.data_ultima_assinatura)::int;

v_data_prevista := MAKE_DATE(v_ano_atual, v_mes_atual, v_dia_credito);

IF v_data_prevista < CURRENT_DATE THEN
IF v_mes_atual = 12 THEN
v_mes_atual := 1;
v_ano_atual := v_ano_atual + 1;
ELSE
v_mes_atual := v_mes_atual + 1;
END IF;

v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_ano_atual, v_mes_atual, 1)) + INTERVAL '1 month - 1 day'))::int;

IF v_dia_credito > v_dias_no_mes THEN
v_data_prevista := MAKE_DATE(v_ano_atual, v_mes_atual, v_dias_no_mes);
ELSE
v_data_prevista := MAKE_DATE(v_ano_atual, v_mes_atual, v_dia_credito);
END IF;
END IF;

IF v_data_prevista <= (CURRENT_DATE + INTERVAL '7 days')::date THEN
SELECT EXISTS(
SELECT 1 
FROM atividades 
WHERE parceiro_id = v_clube.parceiro_id
AND programa_id = v_clube.programa_id
AND tipo_atividade = 'clube_credito_mensal'
AND data_prevista = v_data_prevista
) INTO v_ja_existe;

IF NOT v_ja_existe THEN
INSERT INTO atividades (
tipo_atividade,
descricao,
parceiro_id,
programa_id,
data_prevista,
status,
prioridade
) VALUES (
'clube_credito_mensal',
'Crédito mensal de ' || v_clube.quantidade_pontos || ' pontos do clube ' || COALESCE(v_clube.produto_nome, ''),
v_clube.parceiro_id,
v_clube.programa_id,
v_data_prevista,
'pendente',
'alta'
)
RETURNING id INTO v_atividade_id;

RETURN QUERY SELECT 
v_atividade_id,
v_clube.nome_parceiro,
v_clube.programa_nome,
v_data_prevista;
END IF;
END IF;
END LOOP;

RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_parceiros_ativos(dias_limite integer DEFAULT 90)
 RETURNS TABLE(id uuid, nome_parceiro text, cpf text, ultima_movimentacao timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
RETURN QUERY
WITH movimentacoes AS (
SELECT 
parceiro_id,
MAX(created_at) as ultima_data
FROM (
SELECT parceiro_id, created_at FROM compras WHERE parceiro_id IS NOT NULL
UNION ALL
SELECT parceiro_id, created_at FROM compra_bonificada WHERE parceiro_id IS NOT NULL
UNION ALL
SELECT parceiro_id, created_at FROM vendas WHERE parceiro_id IS NOT NULL
UNION ALL
SELECT parceiro_id, created_at FROM transferencia_pontos WHERE parceiro_id IS NOT NULL
UNION ALL
SELECT origem_parceiro_id as parceiro_id, created_at FROM transferencia_pessoas WHERE origem_parceiro_id IS NOT NULL
UNION ALL
SELECT destino_parceiro_id as parceiro_id, created_at FROM transferencia_pessoas WHERE destino_parceiro_id IS NOT NULL
) todas_movimentacoes
WHERE created_at >= NOW() - INTERVAL '1 day' * dias_limite
GROUP BY parceiro_id
)
SELECT 
p.id,
p.nome_parceiro,
p.cpf,
m.ultima_data
FROM parceiros p
INNER JOIN movimentacoes m ON p.id = m.parceiro_id
ORDER BY m.ultima_data DESC, p.nome_parceiro;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.incrementar_cpf_emitido(p_parceiro_id uuid, p_programa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
v_ano_atual integer;
BEGIN
v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);

INSERT INTO parceiro_programa_cpfs_controle (
parceiro_id,
programa_id,
ano,
cpfs_emitidos,
data_primeiro_cpf,
data_ultimo_cpf,
updated_at
)
VALUES (
p_parceiro_id,
p_programa_id,
v_ano_atual,
1,
CURRENT_DATE,
CURRENT_DATE,
now()
)
ON CONFLICT (parceiro_id, programa_id, ano)
DO UPDATE SET
cpfs_emitidos = parceiro_programa_cpfs_controle.cpfs_emitidos + 1,
data_ultimo_cpf = CURRENT_DATE,
updated_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.limpar_movimentacoes(usuario_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_nivel_acesso text;
v_compras_count int;
v_vendas_count int;
v_compra_bonificada_count int;
v_transferencia_pontos_count int;
v_transferencia_pessoas_count int;
v_estoque_count int;
v_result json;
BEGIN
-- Verifica o nível de acesso do usuário
SELECT nivel_acesso INTO v_nivel_acesso
FROM usuarios
WHERE id = usuario_id;

-- Se o usuário não for encontrado ou não for admin, não permite
IF v_nivel_acesso IS NULL OR v_nivel_acesso != 'ADM' THEN
RAISE EXCEPTION 'Apenas administradores podem executar esta operação.';
END IF;

-- Conta registros antes de deletar
SELECT COUNT(*) INTO v_compras_count FROM compras;
SELECT COUNT(*) INTO v_vendas_count FROM vendas;
SELECT COUNT(*) INTO v_compra_bonificada_count FROM compra_bonificada;
SELECT COUNT(*) INTO v_transferencia_pontos_count FROM transferencia_pontos;
SELECT COUNT(*) INTO v_transferencia_pessoas_count FROM transferencia_pessoas;
SELECT COUNT(*) INTO v_estoque_count FROM estoque_pontos;

-- Ativa modo admin para a sessão
PERFORM set_config('app.is_admin', 'true', true);

-- Deleta todos os registros das tabelas (ordem inversa de dependências)
DELETE FROM transferencia_pessoas;
DELETE FROM transferencia_pontos;
DELETE FROM vendas;
DELETE FROM compra_bonificada;
DELETE FROM compras;
DELETE FROM estoque_pontos;

-- Desativa modo admin
PERFORM set_config('app.is_admin', 'false', true);

-- Retorna resumo
v_result := json_build_object(
'sucesso', true,
'registros_removidos', json_build_object(
'compras', v_compras_count,
'vendas', v_vendas_count,
'compra_bonificada', v_compra_bonificada_count,
'transferencia_pontos', v_transferencia_pontos_count,
'transferencia_pessoas', v_transferencia_pessoas_count,
'estoque_pontos', v_estoque_count
)
);

RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_titular_conta_familia(p_parceiro_id uuid, p_programa_id uuid)
 RETURNS TABLE(titular_id uuid, titular_nome text, conta_familia_id uuid, conta_familia_nome text, eh_titular boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_conta_titular RECORD;
v_conta_membro RECORD;
BEGIN
-- Verificar se é titular de conta família ativa no programa
SELECT 
cf.id as conta_id,
cf.nome_conta,
cf.parceiro_principal_id,
p.nome_parceiro as titular_nome
INTO v_conta_titular
FROM conta_familia cf
INNER JOIN parceiros p ON p.id = cf.parceiro_principal_id
WHERE cf.parceiro_principal_id = p_parceiro_id
AND cf.programa_id = p_programa_id
AND cf.status = 'Ativa'
LIMIT 1;

-- Se é titular, retorna ele mesmo
IF FOUND THEN
RETURN QUERY SELECT
p_parceiro_id,
v_conta_titular.titular_nome,
v_conta_titular.conta_id,
v_conta_titular.nome_conta,
true;
RETURN;
END IF;

-- Verificar se é membro (convidado) de conta família ativa
SELECT
cfm.conta_familia_id,
cf.nome_conta,
cf.parceiro_principal_id,
p.nome_parceiro as titular_nome
INTO v_conta_membro
FROM conta_familia_membros cfm
INNER JOIN conta_familia cf ON cf.id = cfm.conta_familia_id
INNER JOIN parceiros p ON p.id = cf.parceiro_principal_id
WHERE cfm.parceiro_id = p_parceiro_id
AND cf.programa_id = p_programa_id
AND cfm.status = 'Ativo'
AND cf.status = 'Ativa'
LIMIT 1;

-- Se é convidado, retorna o titular
IF FOUND THEN
RETURN QUERY SELECT
v_conta_membro.parceiro_principal_id,
v_conta_membro.titular_nome,
v_conta_membro.conta_familia_id,
v_conta_membro.nome_conta,
false;
RETURN;
END IF;

-- Se não está em conta família, retorna o próprio parceiro
SELECT nome_parceiro INTO v_conta_titular.titular_nome
FROM parceiros
WHERE id = p_parceiro_id;

RETURN QUERY SELECT
p_parceiro_id,
v_conta_titular.titular_nome,
NULL::uuid,
NULL::text,
false;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pode_emitir_cpf(p_parceiro_id uuid, p_programa_id uuid, p_status_programa_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
v_disponiveis integer;
BEGIN
v_disponiveis := calcular_cpfs_disponiveis(
p_parceiro_id,
p_programa_id,
p_status_programa_id
);

RETURN v_disponiveis > 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_vendas_modification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_is_admin text;
BEGIN
  BEGIN
    v_is_admin := current_setting('app.is_admin', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_is_admin := 'false';
  END;

  IF v_is_admin = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Operação não permitida: Registros de vendas não podem ser editados ou excluídos. Apenas administradores podem fazer essa operação.';
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_compra_bonificada_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
PERFORM atualizar_estoque_pontos(
NEW.parceiro_id,
NEW.programa_id,
NEW.quantidade_pontos,
'Entrada',
NEW.custo_total,
'compra_bonificada',
'Compra bonificada: ' || COALESCE(NEW.produto, ''),
NEW.id,
'compra_bonificada'
);

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_compra_bonificada_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
PERFORM atualizar_estoque_pontos(
OLD.parceiro_id,
OLD.programa_id,
-OLD.quantidade_pontos,
'Saída',
0,
'ajuste_compra_bonificada',
'Ajuste por atualização de compra bonificada',
OLD.id,
'compra_bonificada'
);

PERFORM atualizar_estoque_pontos(
NEW.parceiro_id,
NEW.programa_id,
NEW.quantidade_pontos,
'Entrada',
NEW.custo_total,
'compra_bonificada',
'Compra bonificada: ' || COALESCE(NEW.produto, ''),
NEW.id,
'compra_bonificada'
);

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_compras_insert_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
IF NEW.status = 'Concluída' THEN
PERFORM atualizar_estoque_pontos(
NEW.parceiro_id,
NEW.programa_id,
NEW.pontos_milhas + COALESCE(NEW.bonus, 0),
'Entrada',
NEW.custo_total,
'compra',
'Compra de pontos/milhas',
NEW.id,
'compras'
);
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_compras_pendentes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
compra_record RECORD;
hoje DATE := CURRENT_DATE;
BEGIN
-- Processar compras com data de entrada que já chegou
FOR compra_record IN
SELECT id, parceiro_id, programa_id, pontos_milhas, bonus, 
data_entrada, data_limite_bonus, valor_total
FROM compras
WHERE status = 'Pendente'
AND data_entrada <= hoje
LOOP
-- Atualizar status para Concluído
UPDATE compras
SET status = 'Concluído',
updated_at = NOW()
WHERE id = compra_record.id;

RAISE NOTICE 'Compra % processada: pontos de entrada liberados', compra_record.id;
END LOOP;

-- Processar bônus com data limite que já chegou
FOR compra_record IN
SELECT id, parceiro_id, programa_id, pontos_milhas, bonus,
data_entrada, data_limite_bonus, valor_total
FROM compras
WHERE status = 'Pendente'
AND bonus > 0
AND data_limite_bonus IS NOT NULL
AND data_limite_bonus <= hoje
LOOP
-- Atualizar status para Concluído
UPDATE compras
SET status = 'Concluído',
updated_at = NOW()
WHERE id = compra_record.id;

RAISE NOTICE 'Compra %: bônus liberado', compra_record.id;
END LOOP;

RAISE NOTICE 'Processamento de compras pendentes concluído';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_compras_update_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
IF OLD.status != 'Concluída' AND NEW.status = 'Concluída' THEN
PERFORM atualizar_estoque_pontos(
NEW.parceiro_id,
NEW.programa_id,
NEW.pontos_milhas + COALESCE(NEW.bonus, 0),
'Entrada',
NEW.custo_total,
'compra',
'Compra de pontos/milhas',
NEW.id,
'compras'
);
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_creditos_automaticos_clubes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_registro RECORD;
v_titular_id uuid;
v_total_credito numeric;
v_clube_id uuid;
BEGIN
FOR v_registro IN
SELECT 
pc.id as clube_id,
pc.parceiro_id,
pc.programa_id,
pc.dia_cobranca,
pc.bonus_mensal,
pc.bonus_produto,
pc.bonus_cashback,
p.nome_parceiro,
pf.nome as programa_nome
FROM programas_clubes pc
JOIN parceiros p ON p.id = pc.parceiro_id
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.tem_clube = true
AND pc.dia_cobranca IS NOT NULL
AND EXTRACT(DAY FROM CURRENT_DATE) = pc.dia_cobranca
AND NOT EXISTS (
SELECT 1 FROM atividades a
WHERE a.tipo_atividade = 'clube_credito_mensal'
AND a.referencia_id = pc.id
AND a.referencia_tabela = 'programas_clubes'
AND DATE(a.created_at) = CURRENT_DATE
)
LOOP
-- Usar quantidade_pontos da tabela correta
v_total_credito := COALESCE(v_registro.quantidade_pontos, 0);

IF v_total_credito > 0 THEN
INSERT INTO atividades (
tipo_atividade,
tipo_lembrete,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
quantidade_pontos,
data_prevista,
status,
prioridade,
referencia_id,
referencia_tabela
) VALUES (
'clube_credito_mensal',
'credito_pontos_conferir',
'Crédito manual do mês atual',
format('Crédito processado manualmente para o mês atual - clube %s', v_registro.programa_nome),
v_titular_id,
v_registro.nome_parceiro,
v_registro.programa_id,
v_registro.programa_nome,
v_total_credito,
CURRENT_DATE,
'pendente',
'alta',
v_registro.clube_id,
'programas_clubes'
);
END IF;
END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_creditos_clubes()
 RETURNS TABLE(parceiro_id uuid, parceiro_nome text, programa_id uuid, programa_nome text, pontos_total numeric, tipo_credito text, processado_em timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clube RECORD;
  v_titular RECORD;
  v_ja_creditado boolean;
  v_data_referencia date;
  v_pontos_total numeric;
  v_tem_bonus boolean;
BEGIN
  v_data_referencia := DATE_TRUNC('month', CURRENT_DATE)::date;

  FOR v_clube IN
    SELECT
      pc.*,
      p.nome_parceiro,
      pf.nome as programa_nome,
      pr.nome as produto_nome
    FROM programas_clubes pc
    INNER JOIN parceiros p ON p.id = pc.parceiro_id
    LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
    LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
    WHERE pc.tem_clube = true
      AND pc.dia_cobranca IS NOT NULL
      AND pc.quantidade_pontos > 0
      AND EXTRACT(DAY FROM CURRENT_DATE)::int = pc.dia_cobranca
  LOOP
    SELECT EXISTS(
      SELECT 1
      FROM atividades a
      WHERE a.parceiro_id = v_clube.parceiro_id
        AND a.programa_id = v_clube.programa_id
        AND a.tipo_atividade = 'clube_credito_mensal'
        AND a.data_prevista >= v_data_referencia
        AND EXTRACT(MONTH FROM a.data_prevista) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM a.data_prevista) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND a.status = 'concluido'
    ) INTO v_ja_creditado;

    IF NOT v_ja_creditado THEN
      SELECT * INTO v_titular
      FROM obter_titular_conta_familia(v_clube.parceiro_id, v_clube.programa_id);

      v_pontos_total := v_clube.quantidade_pontos;
      v_tem_bonus := false;

      -- FIX: passar COALESCE(v_clube.valor, 0) como p_valor_total (antes era 0 fixo)
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        COALESCE(v_clube.valor, 0),   -- valor real da mensalidade para custo médio correto
        'clube_credito_mensal',
        'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, ''),
        v_clube.id,
        'programas_clubes'
      );

      INSERT INTO atividades (
        tipo_atividade,
        titulo,
        descricao,
        parceiro_id,
        parceiro_nome,
        programa_id,
        programa_nome,
        quantidade_pontos,
        data_prevista,
        referencia_id,
        referencia_tabela,
        prioridade,
        status
      ) VALUES (
        'clube_credito_mensal',
        'Crédito mensal de clube',
        CASE
          WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
            'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '') ||
            '. Pontos transferidos automaticamente para titular ' || v_titular.titular_nome
          ELSE
            'Crédito mensal automático do clube ' || COALESCE(v_clube.produto_nome, '')
        END,
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_clube.quantidade_pontos,
        CURRENT_DATE,
        v_clube.id,
        'programas_clubes',
        'alta',
        'concluido'
      );

      -- Bônus: valor=0 é correto (gratuito, dilui custo médio propositalmente)
      IF v_clube.bonus_quantidade_pontos > 0 THEN
        PERFORM atualizar_estoque_pontos(
          v_clube.parceiro_id,
          v_clube.programa_id,
          v_clube.bonus_quantidade_pontos,
          'Entrada',
          0,   -- bônus tem custo zero (dilui custo médio, comportamento correto)
          'clube_credito_bonus',
          'Bônus mensal do clube ' || COALESCE(v_clube.produto_nome, ''),
          v_clube.id,
          'programas_clubes'
        );

        v_pontos_total := v_pontos_total + v_clube.bonus_quantidade_pontos;
        v_tem_bonus := true;
      END IF;

      RETURN QUERY SELECT
        v_clube.parceiro_id,
        v_clube.nome_parceiro,
        v_clube.programa_id,
        v_clube.programa_nome,
        v_pontos_total,
        CASE WHEN v_tem_bonus THEN 'credito_com_bonus' ELSE 'credito_mensal' END::text,
        CURRENT_TIMESTAMP;

    END IF;
  END LOOP;

  RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_creditos_clubes_com_cobranca()
 RETURNS TABLE(parceiro_id uuid, parceiro_nome text, programa_id uuid, programa_nome text, pontos_creditados integer, tipo_credito text, valor_cobrado numeric, processado_em timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_clube RECORD;
v_hoje date := CURRENT_DATE;
v_dia_atual integer := EXTRACT(DAY FROM v_hoje)::int;
BEGIN
-- Loop por todos os clubes ativos
FOR v_clube IN
SELECT 
pc.id as clube_id,
pc.parceiro_id,
p.nome_parceiro,
pc.programa_id,
pf.nome as programa_nome,
pc.quantidade_pontos,
pc.bonus_quantidade_pontos,
pc.valor,
pc.dia_cobranca,
pc.data_ultima_assinatura,
pc.sequencia
FROM programas_clubes pc
JOIN parceiros p ON p.id = pc.parceiro_id
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.tem_clube = true
AND pc.dia_cobranca = v_dia_atual
LOOP
-- Verificar se já foi creditado neste mês
IF NOT EXISTS (
SELECT 1 FROM estoque_movimentacoes
WHERE parceiro_id = v_clube.parceiro_id
AND programa_id = v_clube.programa_id
AND tipo = 'entrada'
AND origem = 'clube_credito_mensal'
AND EXTRACT(YEAR FROM data_movimentacao) = EXTRACT(YEAR FROM v_hoje)
AND EXTRACT(MONTH FROM data_movimentacao) = EXTRACT(MONTH FROM v_hoje)
) THEN
-- Creditar pontos mensais
PERFORM atualizar_estoque_pontos(
v_clube.parceiro_id,
v_clube.programa_id,
v_clube.quantidade_pontos,
'Entrada',
0
);

-- Registrar movimentação
INSERT INTO estoque_movimentacoes (
parceiro_id,
programa_id,
tipo,
quantidade,
valor,
origem,
data,
referencia_id
) VALUES (
v_clube.parceiro_id,
v_clube.programa_id,
'clube_credito_mensal',
v_clube.quantidade_pontos,
v_clube.valor,
format('Crédito mensal clube - %s', v_clube.programa_nome),
v_hoje,
v_clube.clube_id
);

-- Registrar conta a pagar para a mensalidade
PERFORM registrar_conta_pagar_clube(v_clube.clube_id, v_hoje);

-- Retornar registro do crédito
parceiro_id := v_clube.parceiro_id;
parceiro_nome := v_clube.nome_parceiro;
programa_id := v_clube.programa_id;
programa_nome := v_clube.programa_nome;
pontos_creditados := v_clube.quantidade_pontos;
tipo_credito := 'credito_mensal';
valor_cobrado := v_clube.valor;
processado_em := now();
RETURN NEXT;

-- Se tem bônus e é a primeira assinatura (data_ultima_assinatura = hoje)
IF v_clube.bonus_quantidade_pontos > 0 
AND v_clube.data_ultima_assinatura = v_hoje THEN

PERFORM atualizar_estoque_pontos(
v_clube.parceiro_id,
v_clube.programa_id,
v_clube.bonus_quantidade_pontos,
'Entrada',
0
);

INSERT INTO estoque_movimentacoes (
parceiro_id,
programa_id,
tipo,
quantidade,
valor,
origem,
data,
referencia_id
) VALUES (
v_clube.parceiro_id,
v_clube.programa_id,
'clube_credito_bonus',
v_clube.bonus_quantidade_pontos,
0,
format('Bônus inicial clube - %s', v_clube.programa_nome),
v_hoje,
v_clube.clube_id
);

parceiro_id := v_clube.parceiro_id;
parceiro_nome := v_clube.nome_parceiro;
programa_id := v_clube.programa_id;
programa_nome := v_clube.programa_nome;
pontos_creditados := v_clube.bonus_quantidade_pontos;
tipo_credito := 'credito_bonus';
valor_cobrado := 0;
processado_em := now();
RETURN NEXT;
END IF;
END IF;
END LOOP;

RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_creditos_clubes_mensais()
 RETURNS TABLE(parceiro_id uuid, programa_id uuid, pontos_creditados numeric, bonus_creditado numeric, total_creditado numeric, data_credito date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_clube RECORD;
v_bonus numeric;
v_total_pontos numeric;
BEGIN
FOR v_clube IN
SELECT 
pc.id,
pc.parceiro_id,
pc.programa_id,
pc.quantidade_pontos,
pc.bonus_porcentagem,
pc.data_ultima_assinatura,
pc.dia_cobranca,
pf.id as programa_id_check
FROM programas_clubes pc
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.tem_clube = true
AND pc.quantidade_pontos > 0
AND pc.dia_cobranca = EXTRACT(DAY FROM CURRENT_DATE)::int
AND (pc.data_ultima_assinatura IS NULL 
OR pc.data_ultima_assinatura < DATE_TRUNC('month', CURRENT_DATE)::date)
LOOP
-- Calcular bônus se aplicável (apenas no primeiro mês)
v_bonus := 0;
IF v_clube.bonus_porcentagem > 0 
AND (v_clube.data_ultima_assinatura IS NULL 
OR DATE_TRUNC('month', v_clube.data_ultima_assinatura) < DATE_TRUNC('month', CURRENT_DATE)) THEN
v_bonus := FLOOR(v_clube.quantidade_pontos * v_clube.bonus_porcentagem / 100);
END IF;

v_total_pontos := v_clube.quantidade_pontos + v_bonus;

-- Usar a função correta para atualizar estoque
-- Esta função já existe e faz INSERT/UPDATE correto na tabela estoque_pontos
PERFORM atualizar_estoque_pontos(
v_clube.parceiro_id,
v_clube.programa_id,
v_total_pontos,
'crédito_mensal_clube'
);

-- Atualizar data da última assinatura
UPDATE programas_clubes
SET data_ultima_assinatura = CURRENT_DATE,
updated_at = now()
WHERE id = v_clube.id;

-- Marcar atividade como processada (se existir)
UPDATE atividades
SET status = 'processado',
processado_em = now()
WHERE referencia_id = v_clube.id
AND referencia_tabela = 'programas_clubes'
AND data_prevista = CURRENT_DATE
AND status = 'pendente';

-- Retornar resultado
RETURN QUERY SELECT 
v_clube.parceiro_id,
v_clube.programa_id,
v_clube.quantidade_pontos,
v_bonus,
v_total_pontos,
CURRENT_DATE;
END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_creditos_clubes_recorrentes()
 RETURNS TABLE(parceiro_nome text, programa_nome text, quantidade_creditada numeric, data_credito date, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_clube RECORD;
v_dias_desde_assinatura integer;
v_deve_creditar boolean;
v_ultima_data_credito date;
v_proxima_data_credito date;
BEGIN
-- Buscar clubes com bônus recorrente ativo
FOR v_clube IN
SELECT 
pc.id,
pc.parceiro_id,
pc.programa_id,
pc.data_ultima_assinatura,
pc.bonus_quantidade_pontos,
pc.sequencia,
pa.nome_parceiro,
pf.nome as programa_nome
FROM programas_clubes pc
JOIN parceiros pa ON pa.id = pc.parceiro_id
JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.tem_clube = true
AND pc.bonus_quantidade_pontos > 0
AND pc.sequencia IS NOT NULL
AND pc.data_ultima_assinatura IS NOT NULL
LOOP
v_deve_creditar := false;

-- Buscar última data de crédito nas atividades
SELECT MAX(data_atividade) INTO v_ultima_data_credito
FROM atividades
WHERE programa_clube_id = v_clube.id
AND tipo = 'Crédito Clube'
AND observacao LIKE '%Bônus Recorrente%';

-- Se nunca foi creditado, usar data de assinatura como base
IF v_ultima_data_credito IS NULL THEN
v_ultima_data_credito := v_clube.data_ultima_assinatura;
END IF;

-- Calcular tempo desde último crédito
v_dias_desde_assinatura := CURRENT_DATE - v_ultima_data_credito;

-- Verificar se deve creditar baseado na frequência
IF v_clube.sequencia = 'mensal' AND v_dias_desde_assinatura >= 30 THEN
v_deve_creditar := true;
v_proxima_data_credito := v_ultima_data_credito + INTERVAL '30 days';
ELSIF v_clube.sequencia = 'trimestral' AND v_dias_desde_assinatura >= 90 THEN
v_deve_creditar := true;
v_proxima_data_credito := v_ultima_data_credito + INTERVAL '3 months';
ELSIF v_clube.sequencia = 'anual' AND v_dias_desde_assinatura >= 365 THEN
v_deve_creditar := true;
v_proxima_data_credito := v_ultima_data_credito + INTERVAL '1 year';
END IF;

-- Se deve creditar, processar
IF v_deve_creditar THEN
-- Atualizar estoque
PERFORM atualizar_estoque_pontos(
v_clube.parceiro_id,
v_clube.programa_id,
v_clube.bonus_quantidade_pontos,
'Entrada',
0
);

-- Criar atividade
PERFORM criar_atividade_clube(
v_clube.id,
v_clube.parceiro_id,
v_clube.programa_id,
'Crédito Clube',
v_proxima_data_credito::date,
v_clube.bonus_quantidade_pontos,
'Bônus Recorrente ' || INITCAP(v_clube.sequencia) || ' - ' || v_clube.bonus_quantidade_pontos || ' pontos'
);

-- Retornar resultado
RETURN QUERY SELECT 
v_clube.nome_parceiro,
v_clube.programa_nome,
v_clube.bonus_quantidade_pontos,
v_proxima_data_credito::date,
'Creditado'::text;
END IF;
END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_creditos_recorrentes()
 RETURNS TABLE(programa_clube_id uuid, parceiro_nome text, programa_nome text, quantidade_creditada integer, data_credito date, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_record RECORD;
v_ultima_data_credito date;
v_proxima_data_credito date;
v_quantidade_bonus integer;
v_quantidade_total integer;
v_data_atual date := CURRENT_DATE;
v_creditos_processados integer := 0;
BEGIN
-- Loop through all active program clubs with frequency configured
FOR v_record IN 
SELECT 
pc.id,
pc.parceiro_id,
pc.programa_id,
pc.nome_parceiro,
pc.data_ultima_assinatura,
pc.quantidade_pontos,
pc.bonus_porcentagem,
pc.sequencia,
pf.nome as programa_nome
FROM programas_clubes pc
LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
WHERE pc.sequencia IS NOT NULL
AND pc.quantidade_pontos > 0
AND pc.data_ultima_assinatura IS NOT NULL
AND pc.parceiro_id IS NOT NULL
AND pc.programa_id IS NOT NULL
LOOP
-- Get the last credit date
SELECT MAX(data_credito) INTO v_ultima_data_credito
FROM creditos_recorrentes_log
WHERE programa_clube_id = v_record.id;

-- If no previous credit, use the last subscription date
IF v_ultima_data_credito IS NULL THEN
v_ultima_data_credito := v_record.data_ultima_assinatura;
END IF;

-- Calculate next credit date
v_proxima_data_credito := calcular_proxima_data_credito(
v_ultima_data_credito,
v_record.sequencia
);

-- Check if credit is due (next date is today or in the past)
IF v_proxima_data_credito IS NOT NULL AND v_proxima_data_credito <= v_data_atual THEN
-- Calculate bonus points
v_quantidade_bonus := FLOOR(
v_record.quantidade_pontos * COALESCE(v_record.bonus_porcentagem, 0) / 100
);

v_quantidade_total := v_record.quantidade_pontos + v_quantidade_bonus;

-- Insert credit log
BEGIN
INSERT INTO creditos_recorrentes_log (
programa_clube_id,
data_credito,
quantidade_pontos,
quantidade_bonus,
quantidade_total
) VALUES (
v_record.id,
v_proxima_data_credito,
v_record.quantidade_pontos,
v_quantidade_bonus,
v_quantidade_total
);

-- Update stock by calling the existing function
PERFORM atualizar_estoque_pontos(
v_record.parceiro_id,
v_record.programa_id,
v_quantidade_total,
'Entrada',
0
);

-- Return success result
programa_clube_id := v_record.id;
parceiro_nome := v_record.nome_parceiro;
programa_nome := v_record.programa_nome;
quantidade_creditada := v_quantidade_total;
data_credito := v_proxima_data_credito;
status := 'Creditado';

v_creditos_processados := v_creditos_processados + 1;

RETURN NEXT;

EXCEPTION WHEN OTHERS THEN
-- Return error result
programa_clube_id := v_record.id;
parceiro_nome := v_record.nome_parceiro;
programa_nome := v_record.programa_nome;
quantidade_creditada := 0;
data_credito := v_proxima_data_credito;
status := 'Erro: ' || SQLERRM;

RETURN NEXT;
END;
END IF;
END LOOP;

-- If no credits were processed, return a message
IF v_creditos_processados = 0 THEN
programa_clube_id := NULL;
parceiro_nome := NULL;
programa_nome := NULL;
quantidade_creditada := 0;
data_credito := NULL;
status := 'Nenhum crédito pendente para processar';
RETURN NEXT;
END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_emissao_massa(p_venda_id uuid, p_quantidade_emitida numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
v_venda RECORD;
v_quantidade_reservada numeric;
BEGIN
-- Buscar dados da venda
SELECT v.*, v.quantidade_reservada
INTO v_venda
FROM vendas v
WHERE v.id = p_venda_id
AND v.tipo_cliente = 'agencia_grande'
AND v.estoque_reservado = true;

IF NOT FOUND THEN
RAISE EXCEPTION 'Venda não encontrada ou não é de agência grande';
END IF;

-- Validar se quantidade emitida não excede a reservada
IF p_quantidade_emitida > v_venda.quantidade_reservada THEN
RAISE EXCEPTION 'Quantidade emitida (%) excede quantidade reservada (%)', 
p_quantidade_emitida, v_venda.quantidade_reservada;
END IF;

-- Baixar do estoque a quantidade emitida
UPDATE estoque_pontos
SET saldo_atual = saldo_atual - p_quantidade_emitida,
updated_at = now()
WHERE parceiro_id = v_venda.parceiro_id
AND programa_id = v_venda.programa_id;

-- Atualizar quantidade reservada na venda
UPDATE vendas
SET quantidade_reservada = quantidade_reservada - p_quantidade_emitida,
estoque_reservado = CASE 
WHEN (quantidade_reservada - p_quantidade_emitida) <= 0 THEN false 
ELSE true 
END,
updated_at = now()
WHERE id = p_venda_id;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_pontos_clube_retroativos(p_clube_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(mes date, pontos_credito numeric, bonus_credito numeric, atividade_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_clube record;
v_data_corrente date;
v_pontos_mes numeric;
v_bonus_mes numeric;
v_atividade_id uuid;
v_meses_desde_inicio integer;
v_deve_aplicar_bonus boolean;
BEGIN
-- Buscar informações do clube
SELECT 
pc.parceiro_id,
pc.programa_id,
pc.quantidade_pontos,  -- era: pontos_mensais
pc.bonus_quantidade_pontos,  -- era: bonus_pontos
pc.sequencia  -- era: sequencia_bonus
INTO v_clube
FROM programas_clubes pc
WHERE pc.id = p_clube_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Clube não encontrado: %', p_clube_id;
END IF;

-- Processar mês a mês
v_data_corrente := date_trunc('month', p_data_inicio)::date;

WHILE v_data_corrente <= p_data_fim LOOP
-- Calcular quantos meses se passaram desde o início
v_meses_desde_inicio := EXTRACT(YEAR FROM age(v_data_corrente, p_data_inicio)) * 12 
+ EXTRACT(MONTH FROM age(v_data_corrente, p_data_inicio));

-- Determinar se deve aplicar bônus baseado na sequência
v_deve_aplicar_bonus := false;

IF v_clube.sequencia = 'mensal' THEN
v_deve_aplicar_bonus := true;
ELSIF v_clube.sequencia = 'trimestral' THEN
v_deve_aplicar_bonus := (v_meses_desde_inicio > 0 AND v_meses_desde_inicio % 3 = 0);
ELSIF v_clube.sequencia = 'anual' THEN
v_deve_aplicar_bonus := (v_meses_desde_inicio > 0 AND v_meses_desde_inicio % 12 = 0);
END IF;

-- Pontos base do mês
v_pontos_mes := COALESCE(v_clube.quantidade_pontos, 0);

-- Bônus do mês (se aplicável)
IF v_deve_aplicar_bonus THEN
v_bonus_mes := COALESCE(v_clube.bonus_quantidade_pontos, 0);
ELSE
v_bonus_mes := 0;
END IF;

-- Criar atividade com colunas corretas
INSERT INTO atividades (
tipo_atividade,
parceiro_id,
programa_id,
quantidade_pontos,
data_prevista,
referencia_id,
referencia_tabela,
observacoes,
status
) VALUES (
'clube_credito_retroativo',
v_clube.parceiro_id,
v_clube.programa_id,
v_pontos_mes + v_bonus_mes,
v_data_corrente,
p_clube_id,
'programas_clubes',
CASE 
WHEN v_bonus_mes > 0 THEN 
format('Crédito retroativo: %s pontos base + %s bônus (%s)', 
v_pontos_mes, v_bonus_mes, v_clube.sequencia)
ELSE 
format('Crédito retroativo: %s pontos', v_pontos_mes)
END,
'concluido'
)
RETURNING id INTO v_atividade_id;

-- Atualizar estoque via função correta
PERFORM atualizar_estoque_pontos(
v_clube.parceiro_id,
v_clube.programa_id,
v_pontos_mes + v_bonus_mes,
'Entrada',
0,
'clube_credito_retroativo',
format('Crédito retroativo mês %s', TO_CHAR(v_data_corrente, 'MM/YYYY')),
v_atividade_id,
'atividades'
);

-- Retornar linha
RETURN QUERY SELECT 
v_data_corrente,
v_pontos_mes,
v_bonus_mes,
v_atividade_id;

-- Próximo mês
v_data_corrente := (v_data_corrente + interval '1 month')::date;
END LOOP;

RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_pontos_mes_atual(p_clube_id uuid)
 RETURNS TABLE(processado boolean, pontos_creditados numeric, mensagem text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clube RECORD;
  v_titular RECORD;
  v_dia_atual int;
  v_pontos_total numeric := 0;
  v_data_referencia date;
BEGIN
  SELECT
    pc.*,
    p.nome_parceiro,
    pf.nome as programa_nome,
    pr.nome as produto_nome
  INTO v_clube
  FROM programas_clubes pc
  INNER JOIN parceiros p ON p.id = pc.parceiro_id
  LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
  LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
  WHERE pc.id = p_clube_id
    AND pc.tem_clube = true
    AND pc.dia_cobranca IS NOT NULL
    AND pc.quantidade_pontos > 0;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 'Clube não encontrado ou não está configurado corretamente'::text;
    RETURN;
  END IF;

  SELECT * INTO v_titular
  FROM obter_titular_conta_familia(v_clube.parceiro_id, v_clube.programa_id);

  v_dia_atual := EXTRACT(DAY FROM CURRENT_DATE)::int;

  IF v_dia_atual < v_clube.dia_cobranca THEN
    RETURN QUERY SELECT
      false,
      0::numeric,
      'O dia de cobrança (' || v_clube.dia_cobranca || ') ainda não chegou neste mês. Dia atual: ' || v_dia_atual::text;
    RETURN;
  END IF;

  v_data_referencia := DATE_TRUNC('month', CURRENT_DATE)::date;

  IF EXISTS (
    SELECT 1
    FROM atividades
    WHERE parceiro_id = v_clube.parceiro_id
      AND programa_id = v_clube.programa_id
      AND tipo_atividade = 'clube_credito_mensal'
      AND data_prevista >= v_data_referencia
      AND EXTRACT(MONTH FROM data_prevista) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM data_prevista) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND status = 'concluido'
  ) THEN
    RETURN QUERY SELECT false, 0::numeric, 'Os pontos deste mês já foram processados'::text;
    RETURN;
  END IF;

  -- FIX: passar COALESCE(v_clube.valor, 0) como p_valor_total (antes era 0 fixo)
  PERFORM atualizar_estoque_pontos(
    v_clube.parceiro_id,
    v_clube.programa_id,
    v_clube.quantidade_pontos,
    'Entrada',
    COALESCE(v_clube.valor, 0),   -- valor real da mensalidade para custo médio correto
    'clube_credito_manual',
    'Crédito manual do mês atual - clube ' || COALESCE(v_clube.produto_nome, ''),
    v_clube.id,
    'programas_clubes'
  );

  INSERT INTO atividades (
    tipo_atividade,
    titulo,
    descricao,
    parceiro_id,
    parceiro_nome,
    programa_id,
    programa_nome,
    quantidade_pontos,
    data_prevista,
    referencia_id,
    referencia_tabela,
    prioridade,
    status
  ) VALUES (
    'clube_credito_mensal',
    'Crédito manual do mês atual',
    CASE
      WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
        'Crédito processado manualmente para o mês atual - clube ' || COALESCE(v_clube.produto_nome, '') ||
        '. Pontos transferidos automaticamente para titular ' || v_titular.titular_nome
      ELSE
        'Crédito processado manualmente para o mês atual - clube ' || COALESCE(v_clube.produto_nome, '')
    END,
    v_clube.parceiro_id,
    v_clube.nome_parceiro,
    v_clube.programa_id,
    v_clube.programa_nome,
    v_clube.quantidade_pontos,
    CURRENT_DATE,
    v_clube.id,
    'programas_clubes',
    'alta',
    'concluido'
  );

  v_pontos_total := v_clube.quantidade_pontos;

  RETURN QUERY SELECT
    true,
    v_pontos_total,
    'Pontos creditados com sucesso! Total: ' || v_pontos_total::text || ' pontos' ||
    CASE
      WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
        ' (transferidos automaticamente para titular ' || v_titular.titular_nome || ')'
      ELSE ''
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_pontos_retroativos(p_clube_id uuid)
 RETURNS TABLE(meses_processados integer, pontos_regulares_total numeric, pontos_bonus_total numeric, pontos_total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clube RECORD;
  v_titular RECORD;
  v_mes_inicio date;
  v_mes_atual date;
  v_data_credito date;
  v_meses_count int := 0;
  v_pontos_reg_total numeric := 0;
  v_pontos_bonus_total numeric := 0;
  v_bonus_date date;
  v_intervalo interval;
BEGIN
  SELECT
    pc.*,
    p.nome_parceiro,
    pf.nome as programa_nome,
    pr.nome as produto_nome
  INTO v_clube
  FROM programas_clubes pc
  INNER JOIN parceiros p ON p.id = pc.parceiro_id
  LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
  LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
  WHERE pc.id = p_clube_id
    AND pc.tem_clube = true
    AND pc.data_ultima_assinatura IS NOT NULL
    AND pc.dia_cobranca IS NOT NULL
    AND pc.quantidade_pontos > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clube não encontrado ou não está configurado corretamente';
  END IF;

  SELECT * INTO v_titular
  FROM obter_titular_conta_familia(v_clube.parceiro_id, v_clube.programa_id);

  v_mes_inicio := DATE_TRUNC('month', v_clube.data_ultima_assinatura::date)::date;
  v_mes_atual := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date;

  IF v_mes_inicio > v_mes_atual THEN
    RETURN QUERY SELECT 0, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Créditos mensais regulares retroativos
  WHILE v_mes_inicio <= v_mes_atual LOOP
    v_data_credito := MAKE_DATE(
      EXTRACT(YEAR FROM v_mes_inicio)::int,
      EXTRACT(MONTH FROM v_mes_inicio)::int,
      LEAST(v_clube.dia_cobranca, EXTRACT(DAY FROM (v_mes_inicio + INTERVAL '1 month - 1 day'))::int)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM atividades
      WHERE referencia_id = v_clube.id
        AND referencia_tabela = 'programas_clubes'
        AND tipo_atividade IN ('clube_credito_mensal', 'clube_credito_retroativo')
        AND EXTRACT(MONTH FROM data_prevista) = EXTRACT(MONTH FROM v_data_credito)
        AND EXTRACT(YEAR FROM data_prevista) = EXTRACT(YEAR FROM v_data_credito)
        AND status = 'concluido'
    ) THEN
      PERFORM atualizar_estoque_pontos(
        v_clube.parceiro_id,
        v_clube.programa_id,
        v_clube.quantidade_pontos,
        'Entrada',
        COALESCE(v_clube.valor, 0),
        'clube_credito_retroativo',
        'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') ||
        ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY'),
        v_clube.id,
        'programas_clubes',
        NULL,
        v_data_credito
      );

      INSERT INTO atividades (
        tipo_atividade, titulo, descricao,
        parceiro_id, parceiro_nome, programa_id, programa_nome,
        quantidade_pontos, data_prevista, referencia_id, referencia_tabela, prioridade, status
      ) VALUES (
        'clube_credito_mensal', 'Crédito retroativo de clube',
        CASE
          WHEN NOT v_titular.eh_titular AND v_titular.conta_familia_id IS NOT NULL THEN
            'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') ||
            ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY') ||
            '. Pontos transferidos automaticamente para titular ' || v_titular.titular_nome
          ELSE
            'Crédito retroativo do clube ' || COALESCE(v_clube.produto_nome, '') ||
            ' referente a ' || TO_CHAR(v_data_credito, 'MM/YYYY')
        END,
        v_clube.parceiro_id, v_clube.nome_parceiro,
        v_clube.programa_id, v_clube.programa_nome,
        v_clube.quantidade_pontos, v_data_credito,
        v_clube.id, 'programas_clubes', 'alta', 'concluido'
      );

      v_pontos_reg_total := v_pontos_reg_total + v_clube.quantidade_pontos;
      v_meses_count := v_meses_count + 1;
    END IF;

    v_mes_inicio := (v_mes_inicio + INTERVAL '1 month')::date;
  END LOOP;

  -- Bônus recorrente retroativo (mensal, trimestral ou anual)
  IF v_clube.bonus_quantidade_pontos > 0 AND v_clube.sequencia IS NOT NULL THEN
    v_intervalo := CASE v_clube.sequencia
      WHEN 'mensal'     THEN INTERVAL '1 month'
      WHEN 'trimestral' THEN INTERVAL '3 months'
      WHEN 'anual'      THEN INTERVAL '1 year'
      ELSE NULL
    END;

    IF v_intervalo IS NOT NULL THEN
      v_bonus_date := v_clube.data_ultima_assinatura::date + v_intervalo;

      WHILE v_bonus_date < CURRENT_DATE LOOP
        IF NOT EXISTS (
          SELECT 1 FROM atividades
          WHERE referencia_id = v_clube.id
            AND referencia_tabela = 'programas_clubes'
            AND tipo_atividade IN ('clube_credito_bonus', 'clube_credito_bonus_retroativo')
            AND data_prevista = v_bonus_date
            AND status = 'concluido'
        ) THEN
          PERFORM atualizar_estoque_pontos(
            v_clube.parceiro_id,
            v_clube.programa_id,
            v_clube.bonus_quantidade_pontos,
            'Entrada',
            0,
            'clube_credito_bonus_retroativo',
            'Bônus retroativo (' || v_clube.sequencia || ') do clube ' ||
            COALESCE(v_clube.produto_nome, '') ||
            ' referente a ' || TO_CHAR(v_bonus_date, 'MM/YYYY'),
            v_clube.id,
            'programas_clubes',
            NULL,
            v_bonus_date
          );

          INSERT INTO atividades (
            tipo_atividade, titulo, descricao,
            parceiro_id, parceiro_nome, programa_id, programa_nome,
            quantidade_pontos, data_prevista, referencia_id, referencia_tabela, prioridade, status
          ) VALUES (
            'clube_credito_bonus_retroativo',
            'Bônus retroativo de clube',
            'Bônus retroativo (' || v_clube.sequencia || ') do clube ' ||
            COALESCE(v_clube.produto_nome, '') ||
            ' referente a ' || TO_CHAR(v_bonus_date, 'MM/YYYY'),
            v_clube.parceiro_id, v_clube.nome_parceiro,
            v_clube.programa_id, v_clube.programa_nome,
            v_clube.bonus_quantidade_pontos, v_bonus_date,
            v_clube.id, 'programas_clubes', 'alta', 'concluido'
          );

          v_pontos_bonus_total := v_pontos_bonus_total + v_clube.bonus_quantidade_pontos;
          v_meses_count := v_meses_count + 1;
        END IF;

        v_bonus_date := v_bonus_date + v_intervalo;
      END LOOP;
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_meses_count,
    v_pontos_reg_total,
    v_pontos_bonus_total,
    v_pontos_reg_total + v_pontos_bonus_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.excluir_programa_clube(p_clube_id uuid)
 RETURNS TABLE(pontos_revertidos numeric, pontos_ja_consumidos numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clube RECORD;
  v_total_entradas numeric := 0;
  v_estoque RECORD;
  v_revertidos numeric := 0;
  v_consumidos numeric := 0;
  v_novo_saldo numeric;
  v_novo_valor numeric;
  v_novo_custo_medio numeric;
BEGIN
  SELECT * INTO v_clube FROM programas_clubes WHERE id = p_clube_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado: %', p_clube_id;
  END IF;

  -- Soma todas as entradas deste clube no estoque
  SELECT COALESCE(SUM(quantidade), 0) INTO v_total_entradas
  FROM estoque_movimentacoes
  WHERE referencia_id = p_clube_id
    AND referencia_tabela = 'programas_clubes'
    AND tipo = 'entrada';

  IF v_total_entradas > 0 AND v_clube.parceiro_id IS NOT NULL AND v_clube.programa_id IS NOT NULL THEN
    SELECT * INTO v_estoque
    FROM estoque_pontos
    WHERE parceiro_id = v_clube.parceiro_id AND programa_id = v_clube.programa_id;

    IF FOUND THEN
      -- Quanto pode ser revertido sem negativar o saldo
      v_revertidos := LEAST(v_total_entradas, v_estoque.saldo_atual);
      -- Quanto já foi consumido por vendas e não pode ser revertido
      v_consumidos := GREATEST(0, v_total_entradas - v_estoque.saldo_atual);

      v_novo_saldo := v_estoque.saldo_atual - v_revertidos;

      IF v_estoque.saldo_atual > 0 THEN
        v_novo_valor := v_estoque.valor_total * (v_novo_saldo::numeric / v_estoque.saldo_atual::numeric);
      ELSE
        v_novo_valor := 0;
      END IF;

      IF v_novo_saldo > 0 THEN
        v_novo_custo_medio := (v_novo_valor / v_novo_saldo) * 1000;
      ELSE
        v_novo_custo_medio := 0;
        v_novo_valor := 0;
      END IF;

      UPDATE estoque_pontos
      SET saldo_atual  = v_novo_saldo,
          valor_total  = v_novo_valor,
          custo_medio  = v_novo_custo_medio,
          updated_at   = now()
      WHERE parceiro_id = v_clube.parceiro_id AND programa_id = v_clube.programa_id;
    END IF;
  END IF;

  DELETE FROM estoque_movimentacoes
  WHERE referencia_id = p_clube_id AND referencia_tabela = 'programas_clubes';

  DELETE FROM atividades
  WHERE referencia_id = p_clube_id AND referencia_tabela = 'programas_clubes';

  DELETE FROM programas_clubes WHERE id = p_clube_id;

  RETURN QUERY SELECT v_revertidos, v_consumidos;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_primeiro_mes_clube(p_clube_id uuid)
 RETURNS TABLE(processado boolean, pontos_creditados numeric, mensagem text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_clube RECORD;
v_mes_assinatura date;
v_mes_atual date;
v_valor_clube numeric;
BEGIN
-- Buscar informações do clube
SELECT
pc.*,
p.nome_parceiro,
pf.nome as programa_nome,
pr.nome as produto_nome
INTO v_clube
FROM programas_clubes pc
INNER JOIN parceiros p ON p.id = pc.parceiro_id
LEFT JOIN programas_fidelidade pf ON pf.id = pc.programa_id
LEFT JOIN produtos pr ON pr.id = pc.clube_produto_id
WHERE pc.id = p_clube_id
AND pc.tem_clube = true
AND pc.data_ultima_assinatura IS NOT NULL
AND pc.quantidade_pontos > 0;

IF NOT FOUND THEN
RETURN QUERY SELECT false, 0::numeric, 'Clube não encontrado ou não está configurado corretamente'::text;
RETURN;
END IF;

-- Verificar se estamos no mesmo mês da assinatura
v_mes_assinatura := DATE_TRUNC('month', v_clube.data_ultima_assinatura::date)::date;
v_mes_atual := DATE_TRUNC('month', CURRENT_DATE)::date;

IF v_mes_assinatura != v_mes_atual THEN
RETURN QUERY SELECT false, 0::numeric, 'Esta função só deve ser usada no mês da assinatura. Use processar_pontos_mes_atual para outros meses.'::text;
RETURN;
END IF;

-- Verificar se já foi processado
IF EXISTS (
SELECT 1
FROM atividades
WHERE parceiro_id = v_clube.parceiro_id
AND programa_id = v_clube.programa_id
AND tipo_atividade IN ('clube_primeiro_credito', 'clube_credito_mensal', 'clube_credito_manual')
AND EXTRACT(MONTH FROM data_prevista) = EXTRACT(MONTH FROM v_clube.data_ultima_assinatura::date)
AND EXTRACT(YEAR FROM data_prevista) = EXTRACT(YEAR FROM v_clube.data_ultima_assinatura::date)
AND status = 'concluido'
) THEN
RETURN QUERY SELECT false, 0::numeric, 'O primeiro mês já foi processado'::text;
RETURN;
END IF;

-- Usa o valor do clube se disponível, senão usa 0
v_valor_clube := COALESCE(v_clube.valor, 0);

-- Creditar APENAS pontos regulares (SEM BÔNUS) COM VALOR
PERFORM atualizar_estoque_pontos(
v_clube.parceiro_id,
v_clube.programa_id,
v_clube.quantidade_pontos,
'Entrada',
v_valor_clube,
'clube_primeiro_credito',
'Primeiro crédito do clube ' || COALESCE(v_clube.produto_nome, '') || ' (mês da assinatura) - ' || v_clube.quantidade_pontos || ' pontos' ||
CASE WHEN v_valor_clube > 0 THEN ' - ' || TO_CHAR(v_valor_clube, 'FM999G999G990D00') ELSE '' END,
v_clube.id,
'programas_clubes'
);

-- Criar atividade COM VALOR
INSERT INTO atividades (
tipo_atividade,
titulo,
descricao,
parceiro_id,
parceiro_nome,
programa_id,
programa_nome,
quantidade_pontos,
valor,
data_prevista,
referencia_id,
referencia_tabela,
prioridade,
status,
data_conclusao
) VALUES (
'clube_primeiro_credito',
'Primeiro crédito de clube (sem bônus)',
'Primeiro crédito do clube ' || COALESCE(v_clube.produto_nome, '') || ' no mês da assinatura (bônus só a partir dos meses recorrentes)',
v_clube.parceiro_id,
v_clube.nome_parceiro,
v_clube.programa_id,
v_clube.programa_nome,
v_clube.quantidade_pontos,
v_valor_clube,
v_clube.data_ultima_assinatura::date,
v_clube.id,
'programas_clubes',
'alta',
'concluido',
NOW()
);

RETURN QUERY SELECT
true,
v_clube.quantidade_pontos,
'Primeiro mês creditado com sucesso! Pontos: ' || v_clube.quantidade_pontos::text || ' (bônus entrará nos meses recorrentes conforme frequência configurada)'::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_transferencia_automatica_titular()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_titular RECORD;
v_origem_info text;
BEGIN
-- Só processa entradas (tipo salvo em minúsculo pela atualizar_estoque_pontos)
IF NEW.tipo NOT IN ('entrada', 'transferencia_entrada') THEN
RETURN NEW;
END IF;

-- Ignora transferências automáticas para evitar loop
IF NEW.origem IN (
'transferencia_clube_para_titular',
'transferencia_clube_de_convidado',
'transferencia_automatica_para_titular',
'transferencia_automatica_de_convidado'
) THEN
RETURN NEW;
END IF;

-- Verifica se o parceiro é convidado de uma conta família
SELECT * INTO v_titular
FROM obter_titular_conta_familia(NEW.parceiro_id, NEW.programa_id);

-- Se não for convidado ou não tiver conta família, não faz nada
IF v_titular.eh_titular OR v_titular.conta_familia_id IS NULL THEN
RETURN NEW;
END IF;

-- Montar descrição baseada na origem
CASE NEW.origem
WHEN 'compra_bonificada' THEN
v_origem_info := 'Compra Bonificada';
WHEN 'compra' THEN
v_origem_info := 'Compra de Pontos';
WHEN 'transferencia_pontos' THEN
v_origem_info := 'Transferência de Pontos';
WHEN 'transferencia_pessoas' THEN
v_origem_info := 'Transferência entre Pessoas';
WHEN 'clube_credito_mensal' THEN
v_origem_info := 'Crédito Mensal de Clube';
WHEN 'clube_credito_retroativo' THEN
v_origem_info := 'Crédito Retroativo de Clube';
WHEN 'clube_credito_manual' THEN
v_origem_info := 'Crédito Manual de Clube';
WHEN 'clube_credito_bonus' THEN
v_origem_info := 'Bônus de Clube';
ELSE
v_origem_info := COALESCE(NEW.origem, 'Operação');
END CASE;

-- Debitar do convidado (saída)
PERFORM atualizar_estoque_pontos(
NEW.parceiro_id,
NEW.programa_id,
NEW.quantidade,
'Saída',
0,
'transferencia_automatica_para_titular',
'Transferência automática para titular ' || v_titular.titular_nome || ' - ' || v_origem_info,
NEW.referencia_id,
NEW.referencia_tabela
);

-- Creditar no titular (entrada com custo zero)
PERFORM atualizar_estoque_pontos(
v_titular.titular_id,
NEW.programa_id,
NEW.quantidade,
'Entrada',
0,
'transferencia_automatica_de_convidado',
'Recebido de convidado ' || (SELECT nome_parceiro FROM parceiros WHERE id = NEW.parceiro_id) || ' - ' || v_origem_info,
NEW.referencia_id,
NEW.referencia_tabela
);

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_transferencia_destino()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_origem_custo_medio   decimal;
  v_valor_destino        decimal;
  v_origem_programa_nome text;
  v_qtd_estoque          decimal;
BEGIN
  SELECT custo_medio INTO v_origem_custo_medio FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id AND programa_id = NEW.origem_programa_id;

  SELECT nome INTO v_origem_programa_nome FROM programas_fidelidade WHERE id = NEW.origem_programa_id;

  IF NEW.realizar_compra_carrinho = true THEN
    v_qtd_estoque   := COALESCE(NEW.origem_quantidade, 0) - COALESCE(NEW.compra_quantidade, 0);
    v_valor_destino := (GREATEST(v_qtd_estoque, 0) / 1000.0) * COALESCE(v_origem_custo_medio, 0)
                       + COALESCE(NEW.compra_valor_total, 0);
  ELSE
    v_valor_destino := (NEW.destino_quantidade / 1000.0) * COALESCE(v_origem_custo_medio, 0);
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.destino_programa_id, NEW.destino_quantidade,
      'Entrada', v_valor_destino, 'Transferência de Pontos',
      'Recebimento de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id, 'transferencia_pontos', 'transferencia_entrada',
      COALESCE(NEW.data_transferencia, CURRENT_DATE)
    );
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.destino_programa_id, NEW.destino_quantidade_bonus,
      'Entrada', 0, 'Transferência de Pontos',
      'Bônus de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id, 'transferencia_pontos', 'transferencia_bonus',
      COALESCE(NEW.data_transferencia, CURRENT_DATE)
    );
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status_bonus_bumerangue = 'Concluído' AND NEW.bumerangue_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.origem_programa_id, NEW.bumerangue_quantidade_bonus,
      'Entrada', 0, 'Transferência de Pontos', 'Bônus bumerangue',
      NEW.id, 'transferencia_pontos', 'bumerangue_retorno',
      COALESCE(NEW.data_transferencia, CURRENT_DATE)
    );
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.destino_programa_id, NEW.destino_quantidade,
      'Entrada', v_valor_destino, 'Transferência de Pontos',
      'Recebimento de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id, 'transferencia_pontos', 'transferencia_entrada',
      COALESCE(NEW.data_transferencia, CURRENT_DATE)
    );
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.status_bonus_destino = 'Pendente' AND NEW.status_bonus_destino = 'Concluído' AND NEW.destino_quantidade_bonus > 0) THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.destino_programa_id, NEW.destino_quantidade_bonus,
      'Entrada', 0, 'Transferência de Pontos',
      'Bônus de ' || COALESCE(v_origem_programa_nome, 'origem'),
      NEW.id, 'transferencia_pontos', 'transferencia_bonus',
      COALESCE(NEW.data_transferencia, CURRENT_DATE)
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_transferencia_origem()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_destino_programa_nome text;
  v_qtd_estoque           decimal;
BEGIN
  SELECT nome INTO v_destino_programa_nome FROM programas_fidelidade WHERE id = NEW.destino_programa_id;

  IF NEW.realizar_compra_carrinho = true THEN
    v_qtd_estoque := COALESCE(NEW.origem_quantidade, 0) - COALESCE(NEW.compra_quantidade, 0);
    IF v_qtd_estoque <= 0 THEN RETURN NEW; END IF;

    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.origem_programa_id, v_qtd_estoque,
      'Saída', 0, 'Transferência de Pontos',
      'Transferência para ' || COALESCE(v_destino_programa_nome, 'destino'),
      NEW.id, 'transferencia_pontos', 'transferencia_saida',
      COALESCE(NEW.data_transferencia, CURRENT_DATE)
    );
    RETURN NEW;
  END IF;

  PERFORM atualizar_estoque_pontos(
    NEW.parceiro_id, NEW.origem_programa_id, NEW.origem_quantidade,
    'Saída', 0, 'Transferência de Pontos',
    'Transferência para ' || COALESCE(v_destino_programa_nome, 'destino'),
    NEW.id, 'transferencia_pontos', 'transferencia_saida',
    COALESCE(NEW.data_transferencia, CURRENT_DATE)
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_transferencia_origem_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Estorna o débito da origem (devolve pontos que foram debitados)
  PERFORM atualizar_estoque_pontos(
    OLD.parceiro_id,
    OLD.origem_programa_id,
    OLD.origem_quantidade,
    'Entrada',
    0
  );

  -- Estorna o crédito do destino (retira pontos que foram creditados)
  IF OLD.status = 'Concluído' THEN
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.destino_programa_id,
      OLD.destino_quantidade,
      'Saída',
      0
    );
  END IF;

  -- Estorna bônus destino se havia sido creditado
  IF OLD.status_bonus_destino = 'Concluído' AND COALESCE(OLD.destino_quantidade_bonus, 0) > 0 THEN
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.destino_programa_id,
      OLD.destino_quantidade_bonus,
      'Saída',
      0
    );
  END IF;

  -- Estorna bônus bumerangue se havia sido creditado
  IF OLD.status_bonus_bumerangue = 'Concluído' AND COALESCE(OLD.bumerangue_quantidade_bonus, 0) > 0 THEN
    PERFORM atualizar_estoque_pontos(
      OLD.parceiro_id,
      OLD.origem_programa_id,
      OLD.bumerangue_quantidade_bonus,
      'Saída',
      0
    );
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_transferencia_pessoas_completa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_origem_saldo numeric;
  v_origem_custo_medio numeric;
  v_origem_parceiro_nome text;
  v_destino_parceiro_nome text;
  v_valor_recebido numeric;
  v_custo_transferencia numeric;
  v_bonus_destino integer;
BEGIN
  IF (TG_OP = 'INSERT' AND LOWER(NEW.status) = 'concluído') OR
     (TG_OP = 'UPDATE' AND LOWER(OLD.status) != 'concluído' AND LOWER(NEW.status) = 'concluído') THEN

    -- 1. CAPTURAR custo_medio da origem ANTES de qualquer alteração
    SELECT saldo_atual, custo_medio
    INTO v_origem_saldo, v_origem_custo_medio
    FROM estoque_pontos
    WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

    IF v_origem_saldo IS NULL THEN
      RAISE EXCEPTION 'Estoque de origem não encontrado para parceiro_id=% programa_id=%',
        NEW.origem_parceiro_id, NEW.programa_id;
    END IF;

    v_origem_custo_medio := COALESCE(v_origem_custo_medio, 0);

    -- Validar saldo
    IF v_origem_saldo < NEW.quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente no estoque de origem. Disponível: %, Necessário: %',
        v_origem_saldo, NEW.quantidade;
    END IF;

    -- Buscar nomes dos parceiros
    SELECT nome_parceiro INTO v_destino_parceiro_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
    SELECT nome_parceiro INTO v_origem_parceiro_nome FROM parceiros WHERE id = NEW.origem_parceiro_id;

    -- 2. PROCESSAR SAÍDA da origem
    PERFORM atualizar_estoque_pontos(
      NEW.origem_parceiro_id,
      NEW.programa_id,
      NEW.quantidade,
      'Saída',
      0,
      'transferencia_pessoas',
      'Transferência para ' || COALESCE(v_destino_parceiro_nome, 'destino'),
      NEW.id,
      'transferencia_pessoas',
      'transferencia_pessoas_saida'
    );

    -- 3. CALCULAR valor para entrada no destino usando custo_medio capturado ANTES da saída
    v_valor_recebido := (NEW.quantidade * v_origem_custo_medio / 1000);

    IF NEW.tem_custo = true THEN
      v_custo_transferencia := COALESCE(NEW.valor_custo, 0);
    ELSE
      v_custo_transferencia := 0;
    END IF;

    v_bonus_destino := COALESCE(NEW.bonus_destino, 0);

    -- 4. PROCESSAR ENTRADA no destino com o custo correto
    PERFORM atualizar_estoque_pontos(
      NEW.destino_parceiro_id,
      NEW.destino_programa_id,
      NEW.quantidade,
      'Entrada',
      v_valor_recebido + v_custo_transferencia,
      'transferencia_pessoas',
      'Recebido de ' || COALESCE(v_origem_parceiro_nome, 'origem'),
      NEW.id,
      'transferencia_pessoas',
      'transferencia_pessoas_entrada'
    );

    -- 5. PROCESSAR BÔNUS no destino (se houver)
    IF v_bonus_destino > 0 THEN
      PERFORM atualizar_estoque_pontos(
        NEW.destino_parceiro_id,
        NEW.destino_programa_id,
        v_bonus_destino,
        'Entrada',
        0,
        'transferencia_pessoas_bonus',
        'Bônus de transferência de ' || COALESCE(v_origem_parceiro_nome, 'origem'),
        NEW.id,
        'transferencia_pessoas',
        'transferencia_pessoas_entrada'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_transferencia_pessoas_destino()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_origem_custo_medio numeric;
v_origem_parceiro_nome text;
v_valor_recebido numeric;
v_custo_transferencia numeric;
v_bonus_destino integer;
BEGIN
IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
(TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN

-- Buscar custo médio da origem
SELECT custo_medio INTO v_origem_custo_medio
FROM estoque_pontos
WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

v_origem_custo_medio := COALESCE(v_origem_custo_medio, 0);

-- Buscar nome do parceiro de origem
SELECT nome_parceiro INTO v_origem_parceiro_nome
FROM parceiros
WHERE id = NEW.origem_parceiro_id;

v_bonus_destino := COALESCE(NEW.bonus_destino, 0);

-- Calcular valor dos pontos recebidos (baseado no custo da origem)
v_valor_recebido := (NEW.quantidade * v_origem_custo_medio / 1000);

-- Adicionar custo de transferência se houver (quem recebe paga)
IF NEW.tem_custo = true THEN
v_custo_transferencia := COALESCE(NEW.valor_custo, 0);
ELSE
v_custo_transferencia := 0;
END IF;

-- Creditar pontos normais usando atualizar_estoque_pontos
PERFORM atualizar_estoque_pontos(
NEW.destino_parceiro_id,
NEW.destino_programa_id,
NEW.quantidade,
'Entrada',
v_valor_recebido + v_custo_transferencia, -- Valor dos pontos + taxa
'transferencia_pessoas',
'Recebido de ' || v_origem_parceiro_nome,
NEW.id,
'transferencia_pessoas'
);

-- Se houver bônus, creditar separadamente com valor ZERO
IF v_bonus_destino > 0 THEN
PERFORM atualizar_estoque_pontos(
NEW.destino_parceiro_id,
NEW.destino_programa_id,
v_bonus_destino,
'Entrada',
0, -- Bônus não tem custo
'transferencia_pessoas_bonus',
'Bônus de transferência de ' || v_origem_parceiro_nome,
NEW.id,
'transferencia_pessoas'
);
END IF;

END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_transferencia_pessoas_origem()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_origem_estoque_id uuid;
v_origem_saldo numeric;
v_origem_custo_medio numeric;
v_destino_parceiro_nome text;
BEGIN
IF (TG_OP = 'INSERT' AND NEW.status = 'Concluído') OR
(TG_OP = 'UPDATE' AND OLD.status = 'Pendente' AND NEW.status = 'Concluído') THEN

-- Verificar estoque de origem
SELECT id, saldo_atual, custo_medio 
INTO v_origem_estoque_id, v_origem_saldo, v_origem_custo_medio
FROM estoque_pontos
WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

IF v_origem_estoque_id IS NULL THEN
RAISE EXCEPTION 'Estoque de origem não encontrado';
END IF;

-- Verificar saldo suficiente (apenas a quantidade a ser transferida)
IF v_origem_saldo < NEW.quantidade THEN
RAISE EXCEPTION 'Saldo insuficiente no estoque de origem. Disponível: %, Necessário: %', 
v_origem_saldo, NEW.quantidade;
END IF;

SELECT nome_parceiro INTO v_destino_parceiro_nome
FROM parceiros
WHERE id = NEW.destino_parceiro_id;

-- USAR atualizar_estoque_pontos para fazer a SAÍDA corretamente
-- Saída apenas da quantidade de pontos transferida (não inclui custo financeiro)
PERFORM atualizar_estoque_pontos(
NEW.origem_parceiro_id,
NEW.programa_id,
NEW.quantidade,
'Saída',
0, -- Saída não passa valor, é calculado internamente
'transferencia_pessoas',
'Transferência para ' || v_destino_parceiro_nome,
NEW.id,
'transferencia_pessoas'
);

END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_venda()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_saldo_atual numeric;
  v_custo_medio numeric;
  v_cmv         numeric;
BEGIN
  SELECT saldo_atual, custo_medio INTO v_saldo_atual, v_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.parceiro_id AND programa_id = NEW.programa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, valor_total, custo_medio)
    VALUES (NEW.parceiro_id, NEW.programa_id, 0, 0, 0);
    v_saldo_atual := 0;
    v_custo_medio := 0;
  END IF;

  IF v_saldo_atual < NEW.quantidade_milhas THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: %, Quantidade solicitada: %',
      v_saldo_atual, NEW.quantidade_milhas;
  END IF;

  v_cmv := (NEW.quantidade_milhas * v_custo_medio / 1000);
  NEW.saldo_anterior := v_saldo_atual;
  NEW.custo_medio    := v_custo_medio;
  NEW.cmv            := v_cmv;

  IF NEW.tipo_cliente IN ('cliente_final', 'agencia_convencional') THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.programa_id, NEW.quantidade_milhas,
      'Saída', 0, 'venda', 'Venda #' || NEW.id::text,
      NEW.id, 'vendas', NULL,
      COALESCE(NEW.data_venda, CURRENT_DATE)
    );
    NEW.estoque_reservado    := false;
    NEW.quantidade_reservada := 0;
  ELSE
    NEW.estoque_reservado    := true;
    NEW.quantidade_reservada := NEW.quantidade_milhas;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_conta_pagar_clube(p_programa_clube_id uuid, p_data_cobranca date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clube RECORD;
  v_cartao_id uuid;
  v_data_vencimento date;
BEGIN
  -- Buscar dados do clube e o cartao_id via JOIN pelo nome do cartão
  SELECT
    pc.*,
    p.nome_parceiro,
    pf.nome as programa_nome,
    cc.id as cartao_id
  INTO v_clube
  FROM programas_clubes pc
  JOIN parceiros p ON p.id = pc.parceiro_id
  JOIN programas_fidelidade pf ON pf.id = pc.programa_id
  LEFT JOIN cartoes_credito cc ON cc.cartao = pc.cartao
  WHERE pc.id = p_programa_clube_id;

  -- Se não encontrou ou não tem valor, retorna
  IF NOT FOUND OR v_clube.valor IS NULL OR v_clube.valor <= 0 THEN
    RETURN;
  END IF;

  -- Verificar se já existe conta para este mês
  IF EXISTS (
    SELECT 1 FROM contas_a_pagar
    WHERE origem_tipo = 'clube'
      AND origem_id = p_programa_clube_id
      AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM p_data_cobranca)
      AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM p_data_cobranca)
  ) THEN
    RETURN;
  END IF;

  -- Calcular data de vencimento usando o cartão do clube (sempre Crédito, 1 parcela)
  v_data_vencimento := calcular_data_vencimento('Crédito', v_clube.cartao_id, NULL, p_data_cobranca, 1);

  -- Criar conta a pagar para a mensalidade do clube
  INSERT INTO contas_a_pagar (
    origem_tipo,
    origem_id,
    parceiro_id,
    programa_id,
    descricao,
    data_vencimento,
    valor_parcela,
    numero_parcela,
    total_parcelas,
    forma_pagamento,
    cartao_id,
    status_pagamento,
    observacao
  ) VALUES (
    'clube',
    p_programa_clube_id,
    v_clube.parceiro_id,
    v_clube.programa_id,
    format('Mensalidade Clube - %s - %s (%s pontos)', v_clube.nome_parceiro, v_clube.programa_nome, v_clube.quantidade_pontos),
    v_data_vencimento,
    v_clube.valor,
    1,
    1,
    'Crédito',
    v_clube.cartao_id,
    'pendente',
    format('Cobrança automática - %s pontos', v_clube.quantidade_pontos)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_conta_pagar_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_data_vencimento date;
  v_parceiro_nome text;
  v_programa_nome text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM contas_a_pagar
    WHERE origem_tipo = 'venda' AND origem_id = OLD.id AND status_pagamento = 'pendente';
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM contas_a_pagar
    WHERE origem_tipo = 'venda' AND origem_id = NEW.id AND status_pagamento = 'pendente';
  END IF;

  SELECT p.nome_parceiro INTO v_parceiro_nome FROM parceiros p WHERE p.id = NEW.parceiro_id;
  SELECT pf.nome INTO v_programa_nome FROM programas_fidelidade pf WHERE pf.id = NEW.programa_id;

  IF COALESCE(NEW.taxa_embarque, 0) > 0 AND NEW.cartao_taxa_embarque_id IS NOT NULL THEN
    v_data_vencimento := calcular_data_vencimento('Crédito', NEW.cartao_taxa_embarque_id, NULL, NEW.data_venda, 1);
    INSERT INTO contas_a_pagar (
      origem_tipo, origem_id, parceiro_id, programa_id, descricao,
      data_vencimento, valor_parcela, numero_parcela, total_parcelas,
      forma_pagamento, cartao_id, status_pagamento
    ) VALUES (
      'venda', NEW.id, NEW.parceiro_id, NEW.programa_id,
      format('Taxa Embarque - %s / %s', COALESCE(v_parceiro_nome, ''), COALESCE(v_programa_nome, '')),
      v_data_vencimento, NEW.taxa_embarque, 1, 1,
      'Crédito', NEW.cartao_taxa_embarque_id, 'pendente'
    );
  END IF;

  IF COALESCE(NEW.taxa_resgate, 0) > 0 AND NEW.cartao_taxa_resgate_id IS NOT NULL THEN
    v_data_vencimento := calcular_data_vencimento('Crédito', NEW.cartao_taxa_resgate_id, NULL, NEW.data_venda, 1);
    INSERT INTO contas_a_pagar (
      origem_tipo, origem_id, parceiro_id, programa_id, descricao,
      data_vencimento, valor_parcela, numero_parcela, total_parcelas,
      forma_pagamento, cartao_id, status_pagamento
    ) VALUES (
      'venda', NEW.id, NEW.parceiro_id, NEW.programa_id,
      format('Taxa Resgate - %s / %s', COALESCE(v_parceiro_nome, ''), COALESCE(v_programa_nome, '')),
      v_data_vencimento, NEW.taxa_resgate, 1, 1,
      'Crédito', NEW.cartao_taxa_resgate_id, 'pendente'
    );
  END IF;

  IF COALESCE(NEW.taxa_bagagem, 0) > 0 AND NEW.cartao_taxa_bagagem_id IS NOT NULL THEN
    v_data_vencimento := calcular_data_vencimento('Crédito', NEW.cartao_taxa_bagagem_id, NULL, NEW.data_venda, 1);
    INSERT INTO contas_a_pagar (
      origem_tipo, origem_id, parceiro_id, programa_id, descricao,
      data_vencimento, valor_parcela, numero_parcela, total_parcelas,
      forma_pagamento, cartao_id, status_pagamento
    ) VALUES (
      'venda', NEW.id, NEW.parceiro_id, NEW.programa_id,
      format('Taxa Bagagem - %s / %s', COALESCE(v_parceiro_nome, ''), COALESCE(v_programa_nome, '')),
      v_data_vencimento, NEW.taxa_bagagem, 1, 1,
      'Crédito', NEW.cartao_taxa_bagagem_id, 'pendente'
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_conta_pagar_compra()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_parceiro_nome text;
  v_programa_nome text;
BEGIN
  -- DELETE: remover parcelas pendentes
  IF TG_OP = 'DELETE' THEN
    DELETE FROM contas_a_pagar
    WHERE origem_tipo = 'compra'
      AND origem_id = OLD.id
      AND status_pagamento = 'pendente';
    RETURN OLD;
  END IF;

  -- UPDATE: remover parcelas pendentes antigas antes de recriar
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM contas_a_pagar
    WHERE origem_tipo = 'compra'
      AND origem_id = NEW.id
      AND status_pagamento = 'pendente';
  END IF;

  -- INSERT ou UPDATE: criar/recriar parcelas
  IF NEW.forma_pagamento IS NOT NULL
     AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa'
     AND NEW.valor_total IS NOT NULL
     AND NEW.valor_total > 0 THEN

    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;

    v_valor_parcela := NEW.valor_total / COALESCE(NEW.quantidade_parcelas, 1);

    FOR v_parcela IN 1..COALESCE(NEW.quantidade_parcelas, 1) LOOP
      v_data_vencimento := calcular_data_vencimento(NEW.forma_pagamento, NEW.cartao_id, NEW.data_vencimento_manual, NEW.data_entrada::date, v_parcela);

      INSERT INTO contas_a_pagar (
        origem_tipo, origem_id, parceiro_id, programa_id, descricao,
        data_vencimento, valor_parcela, numero_parcela, total_parcelas,
        forma_pagamento, cartao_id, conta_bancaria_id, status_pagamento, created_by
      ) VALUES (
        'compra', NEW.id, NEW.parceiro_id, NEW.programa_id,
        format('Compra de %s pontos/milhas - %s - %s', NEW.pontos_milhas, v_parceiro_nome, v_programa_nome),
        v_data_vencimento, v_valor_parcela, v_parcela,
        COALESCE(NEW.quantidade_parcelas, 1),
        NEW.forma_pagamento, NEW.cartao_id, NEW.conta_bancaria_id, 'pendente', NEW.created_by
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_conta_pagar_compra_bonificada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_parceiro_nome text;
  v_programa_nome text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM contas_a_pagar
    WHERE origem_tipo = 'compra_bonificada'
      AND origem_id = OLD.id
      AND status_pagamento = 'pendente';
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM contas_a_pagar
    WHERE origem_tipo = 'compra_bonificada'
      AND origem_id = NEW.id
      AND status_pagamento = 'pendente';
  END IF;

  IF NEW.forma_pagamento IS NOT NULL
     AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa'
     AND NEW.valor_produto IS NOT NULL
     AND NEW.valor_produto != 0 THEN

    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;

    v_valor_parcela := ABS(NEW.valor_produto) / COALESCE(NEW.parcelas, 1);

    FOR v_parcela IN 1..COALESCE(NEW.parcelas, 1) LOOP
      v_data_vencimento := calcular_data_vencimento(NEW.forma_pagamento, NEW.cartao_id, NEW.data_vencimento_manual, NEW.data_compra::date, v_parcela);

      INSERT INTO contas_a_pagar (
        origem_tipo, origem_id, parceiro_id, programa_id, descricao,
        data_vencimento, valor_parcela, numero_parcela, total_parcelas,
        forma_pagamento, cartao_id, conta_bancaria_id, status_pagamento
      ) VALUES (
        'compra_bonificada', NEW.id, NEW.parceiro_id, NEW.programa_id,
        format('Compra bonificada - %s - %s - Loja: %s', v_parceiro_nome, v_programa_nome, NEW.loja),
        v_data_vencimento, v_valor_parcela, v_parcela,
        COALESCE(NEW.parcelas, 1),
        NEW.forma_pagamento, NEW.cartao_id, NEW.conta_bancaria_id, 'pendente'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_conta_pagar_transferencia_pessoas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_origem_nome text;
  v_destino_nome text;
  v_programa_nome text;
BEGIN
  -- Só registra se houver custo com pagamento
  IF NEW.tem_custo = true
     AND NEW.valor_custo IS NOT NULL
     AND NEW.valor_custo > 0
     AND NEW.forma_pagamento IS NOT NULL
     AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa' THEN

    -- Buscar nomes
    SELECT nome_parceiro INTO v_origem_nome FROM parceiros WHERE id = NEW.origem_parceiro_id;
    SELECT nome_parceiro INTO v_destino_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
    SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;

    -- Calcular valor por parcela
    v_valor_parcela := NEW.valor_custo / COALESCE(NEW.parcelas, 1);

    -- Criar registro para cada parcela
    FOR v_parcela IN 1..COALESCE(NEW.parcelas, 1) LOOP
      v_data_vencimento := calcular_data_vencimento(NEW.forma_pagamento, NEW.cartao_id, NEW.data_vencimento_manual, NEW.data_transferencia::date, v_parcela);

      INSERT INTO contas_a_pagar (
        origem_tipo,
        origem_id,
        parceiro_id,
        programa_id,
        descricao,
        data_vencimento,
        valor_parcela,
        numero_parcela,
        total_parcelas,
        forma_pagamento,
        cartao_id,
        conta_bancaria_id,
        status_pagamento,
        observacao,
        created_by
      ) VALUES (
        'transferencia_pontos',
        NEW.id,
        NEW.origem_parceiro_id,
        NEW.programa_id,
        format('Transferência entre Pessoas - %s → %s - %s', v_origem_nome, v_destino_nome, v_programa_nome),
        v_data_vencimento,
        v_valor_parcela,
        v_parcela,
        COALESCE(NEW.parcelas, 1),
        NEW.forma_pagamento,
        NEW.cartao_id,
        NEW.conta_bancaria_id,
        'pendente',
        NEW.observacao,
        NEW.created_by
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_conta_pagar_transferencia_pontos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_parcela integer;
  v_data_vencimento date;
  v_valor_parcela numeric;
  v_parceiro_nome text;
  v_origem_programa text;
  v_destino_programa text;
  v_cartao_id uuid;
  v_conta_id uuid;
BEGIN
  -- Só registra CONTA A PAGAR se houver compra no carrinho com pagamento
  IF NEW.realizar_compra_carrinho = true
     AND NEW.compra_forma_pagamento IS NOT NULL
     AND NEW.compra_forma_pagamento != 'Não registrar no fluxo de caixa'
     AND NEW.compra_valor_total IS NOT NULL
     AND NEW.compra_valor_total > 0 THEN

    -- Buscar nomes
    SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
    SELECT nome INTO v_origem_programa FROM programas_fidelidade WHERE id = NEW.origem_programa_id;
    SELECT nome INTO v_destino_programa FROM programas_fidelidade WHERE id = NEW.destino_programa_id;

    -- Identificar cartão ou conta
    v_cartao_id := NEW.compra_cartao_id;
    v_conta_id := NEW.compra_conta_bancaria_id;

    -- Calcular valor por parcela
    v_valor_parcela := NEW.compra_valor_total / COALESCE(NEW.compra_parcelas, 1);

    -- Criar registro para cada parcela
    FOR v_parcela IN 1..COALESCE(NEW.compra_parcelas, 1) LOOP
      v_data_vencimento := calcular_data_vencimento(NEW.compra_forma_pagamento, NEW.compra_cartao_id, NEW.compra_data_vencimento_manual, NEW.data_transferencia::date, v_parcela);

      INSERT INTO contas_a_pagar (
        origem_tipo,
        origem_id,
        parceiro_id,
        programa_id,
        descricao,
        data_vencimento,
        valor_parcela,
        numero_parcela,
        total_parcelas,
        forma_pagamento,
        cartao_id,
        conta_bancaria_id,
        status_pagamento,
        created_by
      ) VALUES (
        'transferencia_pontos',
        NEW.id,
        NEW.parceiro_id,
        NEW.origem_programa_id,
        format('Compra no Carrinho - Transferência %s → %s - %s', v_origem_programa, v_destino_programa, v_parceiro_nome),
        v_data_vencimento,
        v_valor_parcela,
        v_parcela,
        COALESCE(NEW.compra_parcelas, 1),
        NEW.compra_forma_pagamento,
        v_cartao_id,
        v_conta_id,
        'pendente',
        NEW.created_by
      );
    END LOOP;
  END IF;

  -- Também registra o custo da transferência (taxa) se houver
  IF NEW.custo_transferencia IS NOT NULL
     AND NEW.custo_transferencia > 0
     AND NEW.forma_pagamento_transferencia IS NOT NULL
     AND NEW.forma_pagamento_transferencia != 'Não registrar no fluxo de caixa' THEN

    INSERT INTO contas_a_pagar (
      origem_tipo,
      origem_id,
      parceiro_id,
      programa_id,
      descricao,
      data_vencimento,
      valor_parcela,
      numero_parcela,
      total_parcelas,
      forma_pagamento,
      cartao_id,
      conta_bancaria_id,
      status_pagamento,
      created_by
    ) VALUES (
      'transferencia_pontos',
      NEW.id,
      NEW.parceiro_id,
      NEW.origem_programa_id,
      format('Taxa de Transferência - %s → %s - %s', v_origem_programa, v_destino_programa, v_parceiro_nome),
      calcular_data_vencimento(NEW.forma_pagamento_transferencia, NEW.cartao_id, NEW.taxa_data_vencimento_manual, NEW.data_transferencia::date, 1),
      NEW.custo_transferencia,
      1,
      1,
      NEW.forma_pagamento_transferencia,
      NEW.cartao_id,
      NEW.conta_bancaria_id,
      'pendente',
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_conta_receber_transferencia_pessoas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_parcela integer;
v_data_vencimento date;
v_valor_parcela numeric;
v_origem_nome text;
v_destino_nome text;
v_programa_nome text;
BEGIN
-- Registra contas a receber se houver custo
IF NEW.tem_custo = true
AND NEW.valor_custo IS NOT NULL 
AND NEW.valor_custo > 0
AND NEW.forma_pagamento IS NOT NULL
AND NEW.forma_pagamento != 'Não registrar no fluxo de caixa' THEN

-- Buscar nomes
SELECT nome_parceiro INTO v_origem_nome FROM parceiros WHERE id = NEW.origem_parceiro_id;
SELECT nome_parceiro INTO v_destino_nome FROM parceiros WHERE id = NEW.destino_parceiro_id;
SELECT nome INTO v_programa_nome FROM programas_fidelidade WHERE id = NEW.programa_id;

-- Calcular valor por parcela
v_valor_parcela := NEW.valor_custo / COALESCE(NEW.parcelas, 1);

-- Criar conta a receber para cada parcela
FOR v_parcela IN 1..COALESCE(NEW.parcelas, 1) LOOP
v_data_vencimento := NEW.data_transferencia + ((v_parcela - 1) * INTERVAL '1 month');

INSERT INTO contas_receber (
origem_tipo,
origem_id,
venda_id,
localizador_id,
data_vencimento,
valor_parcela,
numero_parcela,
total_parcelas,
forma_pagamento,
cartao_id,
conta_bancaria_id,
status_pagamento,
observacao
) VALUES (
'transferencia_pessoas',
NEW.id,
NULL,
NULL,
v_data_vencimento,
v_valor_parcela,
v_parcela,
COALESCE(NEW.parcelas, 1),
NEW.forma_pagamento,
NEW.cartao_id,
NEW.conta_bancaria_id,
'pendente',
format('Taxa transferência entre pessoas - %s → %s - %s', v_origem_nome, v_destino_nome, v_programa_nome)
);
END LOOP;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_conta_receber_transferencia_pontos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_parceiro_nome text;
v_origem_programa text;
v_destino_programa text;
BEGIN
-- Registra conta a receber se houver custo de transferência
IF NEW.custo_transferencia IS NOT NULL 
AND NEW.custo_transferencia > 0
AND NEW.forma_pagamento_transferencia IS NOT NULL
AND NEW.forma_pagamento_transferencia != 'Não registrar no fluxo de caixa' THEN

-- Buscar nomes
SELECT nome_parceiro INTO v_parceiro_nome FROM parceiros WHERE id = NEW.parceiro_id;
SELECT nome INTO v_origem_programa FROM programas_fidelidade WHERE id = NEW.origem_programa_id;
SELECT nome INTO v_destino_programa FROM programas_fidelidade WHERE id = NEW.destino_programa_id;

-- Criar conta a receber (à vista, parcela única)
INSERT INTO contas_receber (
origem_tipo,
origem_id,
venda_id,
localizador_id,
data_vencimento,
valor_parcela,
numero_parcela,
total_parcelas,
forma_pagamento,
cartao_id,
conta_bancaria_id,
status_pagamento,
observacao
) VALUES (
'transferencia_pontos',
NEW.id,
NULL,
NULL,
NEW.data_transferencia,
NEW.custo_transferencia,
1,
1,
NEW.forma_pagamento_transferencia,
NEW.cartao_id,
NEW.conta_bancaria_id,
'pendente',
format('Taxa de transferência - %s → %s - %s', v_origem_programa, v_destino_programa, v_parceiro_nome)
);
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_transferencia(p_parceiro_id uuid, p_programa_id uuid, p_tipo text, p_quantidade numeric, p_valor_total numeric, p_origem_programa_nome text DEFAULT NULL::text, p_destino_programa_nome text DEFAULT NULL::text, p_referencia_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_saldo_anterior decimal;
v_saldo_posterior decimal;
v_custo_medio_anterior decimal;
v_custo_medio_posterior decimal;
v_observacao text;
v_tipo_movimentacao text;
BEGIN
-- Buscar saldos e custos anteriores
SELECT saldo_atual, custo_medio 
INTO v_saldo_anterior, v_custo_medio_anterior
FROM estoque_pontos
WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

-- Calcular saldo posterior
IF p_tipo LIKE '%Saída%' THEN
v_saldo_posterior := COALESCE(v_saldo_anterior, 0) - p_quantidade;
v_tipo_movimentacao := 'transferencia_saida';
ELSE
v_saldo_posterior := COALESCE(v_saldo_anterior, 0) + p_quantidade;
v_tipo_movimentacao := 'transferencia_entrada';
END IF;

-- Buscar custo médio posterior (já foi atualizado pela função atualizar_estoque_pontos)
SELECT custo_medio 
INTO v_custo_medio_posterior
FROM estoque_pontos
WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

-- Construir observação
IF p_tipo LIKE '%Saída%' AND p_destino_programa_nome IS NOT NULL THEN
v_observacao := 'Transferência para ' || p_destino_programa_nome;
ELSIF p_tipo LIKE '%Entrada%' AND p_origem_programa_nome IS NOT NULL THEN
v_observacao := 'Transferência de ' || p_origem_programa_nome;
ELSE
v_observacao := NULL;
END IF;

-- Inserir na tabela de movimentações
INSERT INTO estoque_movimentacoes (
parceiro_id,
programa_id,
tipo,
quantidade,
valor_total,
saldo_anterior,
saldo_posterior,
custo_medio_anterior,
custo_medio_posterior,
origem,
observacao,
referencia_id,
referencia_tabela,
data_movimentacao
) VALUES (
p_parceiro_id,
p_programa_id,
v_tipo_movimentacao,
p_quantidade,
p_valor_total,
COALESCE(v_saldo_anterior, 0),
v_saldo_posterior,
COALESCE(v_custo_medio_anterior, 0),
COALESCE(v_custo_medio_posterior, 0),
'Transferência de Pontos',
v_observacao,
p_referencia_id,
'transferencia_pontos',
now()
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_transferencia_pessoas(p_parceiro_id uuid, p_programa_id uuid, p_tipo text, p_quantidade numeric, p_valor_total numeric, p_outro_parceiro_nome text, p_referencia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_saldo_anterior decimal;
v_saldo_posterior decimal;
v_custo_medio_anterior decimal;
v_custo_medio_posterior decimal;
v_observacao text;
v_tipo_movimentacao text;
BEGIN
-- Buscar saldos e custos anteriores
SELECT saldo_atual, custo_medio 
INTO v_saldo_anterior, v_custo_medio_anterior
FROM estoque_pontos
WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

-- Calcular saldo posterior e determinar tipo
IF p_tipo = 'saida' THEN
v_saldo_posterior := COALESCE(v_saldo_anterior, 0) - p_quantidade;
v_tipo_movimentacao := 'transferencia_pessoas_saida';
v_observacao := 'Transferência para ' || p_outro_parceiro_nome;
ELSE
v_saldo_posterior := COALESCE(v_saldo_anterior, 0) + p_quantidade;
v_tipo_movimentacao := 'transferencia_pessoas_entrada';
v_observacao := 'Transferência de ' || p_outro_parceiro_nome;
END IF;

-- Buscar custo médio posterior (já foi atualizado)
SELECT custo_medio 
INTO v_custo_medio_posterior
FROM estoque_pontos
WHERE parceiro_id = p_parceiro_id AND programa_id = p_programa_id;

-- Inserir na tabela de movimentações
INSERT INTO estoque_movimentacoes (
parceiro_id,
programa_id,
tipo,
quantidade,
valor_total,
saldo_anterior,
saldo_posterior,
custo_medio_anterior,
custo_medio_posterior,
origem,
observacao,
referencia_id,
referencia_tabela,
data_movimentacao
) VALUES (
p_parceiro_id,
p_programa_id,
v_tipo_movimentacao,
p_quantidade,
p_valor_total,
COALESCE(v_saldo_anterior, 0),
v_saldo_posterior,
COALESCE(v_custo_medio_anterior, 0),
COALESCE(v_custo_medio_posterior, 0),
'Transferência entre Pessoas',
v_observacao,
p_referencia_id,
'transferencia_pessoas',
now()
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reverter_transferencia_pontos(p_transfer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transfer          transferencia_pontos%ROWTYPE;
  v_mov               RECORD;
  v_warnings          text[] := ARRAY[]::text[];
  v_origem_nome       text;
  v_destino_nome      text;
  v_saldo_disponivel  numeric;
  v_reverso_qtd       numeric;
BEGIN
  -- Carregar a transferência
  SELECT * INTO v_transfer FROM transferencia_pontos WHERE id = p_transfer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência % não encontrada', p_transfer_id;
  END IF;

  SELECT nome INTO v_origem_nome
  FROM programas_fidelidade WHERE id = v_transfer.origem_programa_id;

  SELECT nome INTO v_destino_nome
  FROM programas_fidelidade WHERE id = v_transfer.destino_programa_id;

  -- Processar cada movimentação ligada a esta transferência (mais antiga primeiro).
  -- Aceita tanto o formato antigo (referencia_tabela IS NULL, tipo 'saida'/'entrada')
  -- quanto o formato novo (referencia_tabela = 'transferencia_pontos',
  -- tipo 'transferencia_saida'/'transferencia_entrada').
  FOR v_mov IN
    SELECT *
    FROM estoque_movimentacoes
    WHERE referencia_id = p_transfer_id
      AND (
        referencia_tabela = 'transferencia_pontos'
        OR referencia_tabela IS NULL
      )
      AND tipo IN (
        'transferencia_saida', 'saida',
        'transferencia_entrada', 'entrada',
        'transferencia_bonus', 'bumerangue_retorno'
      )
    ORDER BY created_at ASC
  LOOP

    IF v_mov.tipo IN ('transferencia_saida', 'saida') THEN
      -- Origem foi debitada → creditar de volta (com o valor original)
      PERFORM atualizar_estoque_pontos(
        v_mov.parceiro_id,
        v_mov.programa_id,
        v_mov.quantidade,
        'Entrada',
        v_mov.valor_total,
        'Estorno de Transferência',
        'Estorno: transferência para ' || COALESCE(v_destino_nome, 'destino'),
        p_transfer_id,
        'estorno_transferencia',
        'transferencia_saida'
      );

    ELSIF v_mov.tipo IN ('transferencia_entrada', 'entrada', 'transferencia_bonus', 'bumerangue_retorno') THEN
      -- Destino/origem foi creditada → reverter debitando (limitado ao saldo disponível)
      SELECT saldo_atual INTO v_saldo_disponivel
      FROM estoque_pontos
      WHERE parceiro_id = v_mov.parceiro_id AND programa_id = v_mov.programa_id;

      v_saldo_disponivel := COALESCE(v_saldo_disponivel, 0);
      v_reverso_qtd := LEAST(v_mov.quantidade, v_saldo_disponivel);

      IF v_reverso_qtd < v_mov.quantidade THEN
        v_warnings := array_append(v_warnings,
          format(
            'Reversão parcial: %s pts disponíveis de %s pts necessários em %s',
            v_reverso_qtd::text,
            v_mov.quantidade::text,
            COALESCE(v_destino_nome, v_mov.programa_id::text)
          )
        );
      END IF;

      IF v_reverso_qtd > 0 THEN
        PERFORM atualizar_estoque_pontos(
          v_mov.parceiro_id,
          v_mov.programa_id,
          v_reverso_qtd,
          'Saída',
          0,
          'Estorno de Transferência',
          'Estorno: transferência de ' || COALESCE(v_origem_nome, 'origem'),
          p_transfer_id,
          'estorno_transferencia',
          'transferencia_entrada'
        );
      END IF;

    END IF;
  END LOOP;

  -- Remover contas_receber geradas por esta transferência
  DELETE FROM contas_receber
  WHERE origem_tipo = 'transferencia_pontos'
    AND origem_id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'warnings', to_jsonb(v_warnings)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reverter_venda()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
v_cmv_original numeric;
v_ano integer;
BEGIN
-- Só reverter se o status mudou para 'cancelada'
IF OLD.status != 'cancelada' AND NEW.status = 'cancelada' THEN

-- Buscar CMV da venda (se não tiver, calcular)
v_cmv_original := COALESCE(OLD.cmv, (OLD.quantidade_milhas * OLD.custo_medio / 1000));

-- Devolver as milhas ao estoque usando atualizar_estoque_pontos
PERFORM atualizar_estoque_pontos(
OLD.parceiro_id,
OLD.programa_id,
OLD.quantidade_milhas,
'Entrada',
v_cmv_original,
'reversao_venda',
'Reversão da venda #' || OLD.id::text,
OLD.id,
'vendas'
);

-- Cancelar todas as contas a receber relacionadas
UPDATE contas_receber
SET status_pagamento = 'cancelado',
updated_at = now()
WHERE venda_id = OLD.id
AND status_pagamento = 'pendente';

-- Estornar CPF: decrementar cpfs_emitidos (mínimo 0)
v_ano := EXTRACT(YEAR FROM OLD.data_venda)::integer;

UPDATE parceiro_programa_cpfs_controle
SET cpfs_emitidos = GREATEST(0, cpfs_emitidos - 1),
updated_at = now()
WHERE parceiro_id = OLD.parceiro_id
AND programa_id = OLD.programa_id
AND ano = v_ano;

END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_admin_mode(usuario_id uuid, is_admin boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_nivel_acesso text;
BEGIN
-- Verifica o nível de acesso do usuário
SELECT nivel_acesso INTO v_nivel_acesso
FROM usuarios
WHERE id = usuario_id;

-- Se o usuário não for encontrado ou não for admin, não permite
IF v_nivel_acesso IS NULL OR v_nivel_acesso != 'ADM' THEN
RAISE EXCEPTION 'Apenas administradores podem executar esta operação.';
END IF;

-- Se passou na verificação e is_admin é true, ativa o modo admin
IF is_admin THEN
PERFORM set_config('app.is_admin', 'true', true);
ELSE
PERFORM set_config('app.is_admin', 'false', true);
END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.transferir_pontos_convidado_para_titular(p_convidado_id uuid, p_titular_id uuid, p_programa_id uuid, p_quantidade numeric, p_clube_id uuid, p_clube_nome text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_convidado_nome text;
v_titular_nome text;
BEGIN
-- Buscar nomes
SELECT nome_parceiro INTO v_convidado_nome FROM parceiros WHERE id = p_convidado_id;
SELECT nome_parceiro INTO v_titular_nome FROM parceiros WHERE id = p_titular_id;

-- Debitar do convidado (saída)
PERFORM atualizar_estoque_pontos(
p_convidado_id,
p_programa_id,
p_quantidade,
'Saída',
0,
'transferencia_clube_para_titular',
'Transferência automática para titular ' || v_titular_nome || ' - Clube ' || p_clube_nome,
p_clube_id,
'programas_clubes'
);

-- Creditar no titular (entrada)
PERFORM atualizar_estoque_pontos(
p_titular_id,
p_programa_id,
p_quantidade,
'Entrada',
0,
'transferencia_clube_de_convidado',
'Recebido de convidado ' || v_convidado_nome || ' - Clube ' || p_clube_nome,
p_clube_id,
'programas_clubes'
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_atualizar_estoque_compra_bonificada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.programa_id, COALESCE(NEW.quantidade_pontos, 0),
      'Entrada', COALESCE(NEW.custo_total, 0),
      'compra_bonificada', 'Compra bonificada: ' || COALESCE(NEW.produto, ''),
      NEW.id, 'compra_bonificada', NULL,
      COALESCE(NEW.data_compra, CURRENT_DATE)
    );

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.quantidade_pontos > 0 THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id, COALESCE(OLD.quantidade_pontos, 0),
        'Saída', 0, 'ajuste_compra_bonificada',
        'Reversão por atualização de compra bonificada',
        OLD.id, 'compra_bonificada', NULL, CURRENT_DATE
      );
    END IF;

    PERFORM atualizar_estoque_pontos(
      NEW.parceiro_id, NEW.programa_id, COALESCE(NEW.quantidade_pontos, 0),
      'Entrada', COALESCE(NEW.custo_total, 0),
      'compra_bonificada', 'Compra bonificada: ' || COALESCE(NEW.produto, ''),
      NEW.id, 'compra_bonificada', NULL,
      COALESCE(NEW.data_compra, CURRENT_DATE)
    );

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.quantidade_pontos > 0 THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id, COALESCE(OLD.quantidade_pontos, 0),
        'Saída', 0, 'exclusao_compra_bonificada',
        'Reversão por exclusão de compra bonificada: ' || COALESCE(OLD.produto, ''),
        OLD.id, 'compra_bonificada', NULL, CURRENT_DATE
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_atualizar_estoque_compras()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Concluído' THEN
      IF NEW.observacao = 'Compra no Carrinho' THEN
        RETURN NEW;
      END IF;

      NEW.saldo_atual := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas', NEW.id, 'compras'
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'Pendente' AND NEW.status = 'Concluído' THEN
      IF NEW.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;
      NEW.saldo_atual := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);
      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas', NEW.id, 'compras'
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Pendente' THEN
      IF OLD.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;
      NEW.saldo_atual := 0;
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída', COALESCE(OLD.valor_total, 0),
        'estorno_compra', 'Estorno de compra de pontos/milhas', OLD.id, 'compras'
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Concluído' AND (
      OLD.pontos_milhas IS DISTINCT FROM NEW.pontos_milhas OR
      OLD.bonus IS DISTINCT FROM NEW.bonus OR
      OLD.valor_total IS DISTINCT FROM NEW.valor_total OR
      OLD.parceiro_id IS DISTINCT FROM NEW.parceiro_id OR
      OLD.programa_id IS DISTINCT FROM NEW.programa_id
    ) THEN
      IF OLD.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;
      NEW.saldo_atual := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);

      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        'Entrada', -COALESCE(OLD.valor_total, 0),
        'ajuste_compra', 'Ajuste de compra - reversão', OLD.id, 'compras'
      );

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas (atualizada)', NEW.id, 'compras'
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'Concluído' AND COALESCE(OLD.observacao, '') != 'Compra no Carrinho' THEN
      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id,
        -(COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        'Entrada', -COALESCE(OLD.valor_total, 0),
        'exclusao_compra', 'Exclusão de compra de pontos/milhas', OLD.id, 'compras'
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_compras_after_estoque()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_saldo_atual       decimal;
  v_custo_medio_atual decimal;
  v_nao_registrar     boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nao_registrar_estoque INTO v_nao_registrar FROM tipos_compra WHERE id = NEW.tipo_compra_id;
    IF COALESCE(v_nao_registrar, false) THEN RETURN NEW; END IF;

    IF NEW.status = 'Concluído' THEN
      IF NEW.observacao = 'Compra no Carrinho' THEN
        SELECT saldo_atual, custo_medio INTO v_saldo_atual, v_custo_medio_atual
        FROM estoque_pontos
        WHERE parceiro_id = NEW.parceiro_id AND programa_id = NEW.programa_id;

        INSERT INTO estoque_movimentacoes (
          parceiro_id, programa_id, tipo, quantidade,
          saldo_anterior, saldo_posterior,
          custo_medio_anterior, custo_medio_posterior,
          valor_total, origem, observacao,
          referencia_id, referencia_tabela,
          data_operacao
        ) VALUES (
          NEW.parceiro_id, NEW.programa_id, 'entrada', NEW.pontos_milhas,
          v_saldo_atual, v_saldo_atual,
          v_custo_medio_atual, v_custo_medio_atual,
          COALESCE(NEW.valor_total, 0), 'compra', 'Compra no Carrinho',
          NEW.id, 'compras',
          COALESCE(NEW.data_entrada, CURRENT_DATE)
        );

        RETURN NEW;
      END IF;

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas',
        NEW.id, 'compras', NULL,
        COALESCE(NEW.data_entrada, CURRENT_DATE)
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT nao_registrar_estoque INTO v_nao_registrar FROM tipos_compra WHERE id = NEW.tipo_compra_id;
    IF COALESCE(v_nao_registrar, false) THEN RETURN NEW; END IF;

    IF OLD.status = 'Pendente' AND NEW.status = 'Concluído' THEN
      IF NEW.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas',
        NEW.id, 'compras', NULL,
        COALESCE(NEW.data_entrada, CURRENT_DATE)
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Pendente' THEN
      IF OLD.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;

      PERFORM atualizar_estoque_pontos(
        OLD.parceiro_id, OLD.programa_id,
        COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0),
        'Saída', COALESCE(OLD.valor_total, 0),
        'estorno_compra', 'Estorno de compra de pontos/milhas',
        OLD.id, 'compras', NULL, CURRENT_DATE
      );

    ELSIF OLD.status = 'Concluído' AND NEW.status = 'Concluído' AND (
      OLD.pontos_milhas IS DISTINCT FROM NEW.pontos_milhas OR
      OLD.bonus IS DISTINCT FROM NEW.bonus OR
      OLD.valor_total IS DISTINCT FROM NEW.valor_total OR
      OLD.parceiro_id IS DISTINCT FROM NEW.parceiro_id OR
      OLD.programa_id IS DISTINCT FROM NEW.programa_id
    ) THEN
      IF OLD.observacao = 'Compra no Carrinho' THEN RETURN NEW; END IF;

      UPDATE estoque_pontos
      SET
        saldo_atual  = saldo_atual  - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        valor_total  = valor_total  - COALESCE(OLD.valor_total, 0),
        custo_medio  = CASE
          WHEN (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0))) > 0
            THEN ((valor_total - COALESCE(OLD.valor_total, 0)) /
                  (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)))) * 1000
          ELSE 0
        END,
        updated_at   = now()
      WHERE parceiro_id = OLD.parceiro_id AND programa_id = OLD.programa_id;

      PERFORM atualizar_estoque_pontos(
        NEW.parceiro_id, NEW.programa_id,
        COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0),
        'Entrada', COALESCE(NEW.valor_total, 0),
        'compra', 'Compra de pontos/milhas (atualizada)',
        NEW.id, 'compras', NULL,
        COALESCE(NEW.data_entrada, CURRENT_DATE)
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT nao_registrar_estoque INTO v_nao_registrar FROM tipos_compra WHERE id = OLD.tipo_compra_id;
    IF COALESCE(v_nao_registrar, false) THEN RETURN OLD; END IF;

    IF OLD.status = 'Concluído' AND COALESCE(OLD.observacao, '') != 'Compra no Carrinho' THEN
      UPDATE estoque_pontos
      SET
        saldo_atual  = saldo_atual  - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)),
        valor_total  = valor_total  - COALESCE(OLD.valor_total, 0),
        custo_medio  = CASE
          WHEN (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0))) > 0
            THEN ((valor_total - COALESCE(OLD.valor_total, 0)) /
                  (saldo_atual - (COALESCE(OLD.pontos_milhas, 0) + COALESCE(OLD.bonus, 0)))) * 1000
          ELSE 0
        END,
        updated_at   = now()
      WHERE parceiro_id = OLD.parceiro_id AND programa_id = OLD.programa_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_compras_before_saldo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_nao_registrar boolean;
BEGIN
SELECT nao_registrar_estoque INTO v_nao_registrar FROM tipos_compra WHERE id = NEW.tipo_compra_id;
IF COALESCE(v_nao_registrar, false) THEN RETURN NEW; END IF;

IF TG_OP = 'INSERT' THEN
IF NEW.status = 'Concluído' THEN
NEW.saldo_atual := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);
END IF;

ELSIF TG_OP = 'UPDATE' THEN
IF OLD.status = 'Pendente' AND NEW.status = 'Concluído' THEN
NEW.saldo_atual := COALESCE(NEW.pontos_milhas, 0) + COALESCE(NEW.bonus, 0);
ELSIF OLD.status = 'Concluído' AND NEW.status = 'Pendente' THEN
NEW.saldo_atual := 0;
END IF;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_criar_lembrete_downgrade()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
-- Só processar se downgrade_upgrade_data foi definido/alterado
IF NEW.downgrade_upgrade_data IS NOT NULL 
AND (TG_OP = 'INSERT' OR OLD.downgrade_upgrade_data IS DISTINCT FROM NEW.downgrade_upgrade_data) THEN

-- Cancelar lembretes antigos se a data mudou
IF TG_OP = 'UPDATE' AND OLD.downgrade_upgrade_data IS DISTINCT FROM NEW.downgrade_upgrade_data THEN
UPDATE atividades
SET status = 'cancelado',
updated_at = now()
WHERE referencia_id = NEW.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_downgrade'
AND status = 'pendente';
END IF;

-- Criar novo lembrete se necessário
PERFORM criar_lembrete_downgrade_individual(NEW.id);
END IF;

-- Se downgrade_upgrade_data foi removido, cancelar lembretes
IF NEW.downgrade_upgrade_data IS NULL AND OLD.downgrade_upgrade_data IS NOT NULL THEN
UPDATE atividades
SET status = 'cancelado',
updated_at = now()
WHERE referencia_id = NEW.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_downgrade'
AND status = 'pendente';
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_criar_lembrete_milhas_expirando()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
-- Só processar se milhas_expirando_data foi definido/alterado
IF NEW.milhas_expirando_data IS NOT NULL 
AND (TG_OP = 'INSERT' OR OLD.milhas_expirando_data IS DISTINCT FROM NEW.milhas_expirando_data) THEN

-- Cancelar lembretes antigos se a data mudou
IF TG_OP = 'UPDATE' AND OLD.milhas_expirando_data IS DISTINCT FROM NEW.milhas_expirando_data THEN
UPDATE atividades
SET status = 'cancelado',
updated_at = now()
WHERE referencia_id = NEW.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_milhas_expirando'
AND status = 'pendente';
END IF;

-- Criar novo lembrete se necessário
PERFORM criar_lembrete_milhas_expirando_individual(NEW.id);
END IF;

-- Se milhas_expirando_data foi removido, cancelar lembretes
IF NEW.milhas_expirando_data IS NULL AND OLD.milhas_expirando_data IS NOT NULL THEN
UPDATE atividades
SET status = 'cancelado',
updated_at = now()
WHERE referencia_id = NEW.id
AND referencia_tabela = 'programas_clubes'
AND tipo_atividade = 'lembrete_milhas_expirando'
AND status = 'pendente';
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_incrementar_cpf()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.tem_clube = false
     AND NEW.status_programa_id IS NOT NULL
     AND NEW.programa_id IS NOT NULL
     AND NEW.parceiro_id IS NOT NULL
  THEN
    PERFORM incrementar_cpf_emitido(NEW.parceiro_id, NEW.programa_id);
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_atividades_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_contas_a_pagar_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_programas_clubes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_transferencia_pessoas_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_vendas_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_clube_quantidade_pontos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
IF NEW.tem_clube = true AND (NEW.quantidade_pontos IS NULL OR NEW.quantidade_pontos <= 0) THEN
RAISE EXCEPTION 'Quantidade de pontos é obrigatória quando tem clube ativo';
END IF;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verificar_contas_atrasadas()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
UPDATE contas_a_pagar
SET status_pagamento = 'atrasado'
WHERE status_pagamento = 'pendente'
AND data_vencimento < CURRENT_DATE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verificar_e_atualizar_status_transferencias()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
transferencia_record RECORD;
BEGIN
-- Atualizar status dos pontos principais
UPDATE transferencia_pontos
SET status = 'Concluído'
WHERE status = 'Pendente'
AND destino_data_recebimento <= CURRENT_DATE;

-- Atualizar status do bônus de destino
UPDATE transferencia_pontos
SET status_bonus_destino = 'Concluído'
WHERE status_bonus_destino = 'Pendente'
AND destino_data_recebimento_bonus IS NOT NULL
AND destino_data_recebimento_bonus <= CURRENT_DATE
AND destino_quantidade_bonus > 0;

-- Atualizar status do bônus bumerangue
UPDATE transferencia_pontos
SET status_bonus_bumerangue = 'Concluído'
WHERE status_bonus_bumerangue = 'Pendente'
AND bumerangue_data_recebimento IS NOT NULL
AND bumerangue_data_recebimento <= CURRENT_DATE
AND bumerangue_quantidade_bonus > 0;

RAISE NOTICE 'Status de transferências atualizado com sucesso';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verificar_e_processar_transferencias_pessoas()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_count integer := 0;
BEGIN
-- Atualizar status das transferências cuja data chegou
UPDATE transferencia_pessoas
SET status = 'Concluído'
WHERE status = 'Pendente'
AND data_recebimento <= CURRENT_DATE;

GET DIAGNOSTICS v_count = ROW_COUNT;

RAISE NOTICE 'Processadas % transferências entre pessoas pendentes', v_count;
END;
$function$
;

-- TRIGGERS

DROP TRIGGER IF EXISTS update_atividades_updated_at ON public.atividades;
CREATE TRIGGER update_atividades_updated_at
  BEFORE UPDATE ON public.atividades
  FOR EACH ROW
  EXECUTE FUNCTION update_atividades_updated_at();

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compra_bonificada_delete ON public.compra_bonificada;
CREATE TRIGGER trigger_atualizar_estoque_compra_bonificada_delete
  AFTER DELETE ON public.compra_bonificada
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compra_bonificada();

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compra_bonificada_insert ON public.compra_bonificada;
CREATE TRIGGER trigger_atualizar_estoque_compra_bonificada_insert
  AFTER INSERT ON public.compra_bonificada
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compra_bonificada();

DROP TRIGGER IF EXISTS trigger_atualizar_estoque_compra_bonificada_update ON public.compra_bonificada;
CREATE TRIGGER trigger_atualizar_estoque_compra_bonificada_update
  AFTER UPDATE ON public.compra_bonificada
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_estoque_compra_bonificada();

DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_compra_bonificada ON public.compra_bonificada;
CREATE TRIGGER trigger_registrar_conta_pagar_compra_bonificada
  AFTER INSERT OR UPDATE OR DELETE ON public.compra_bonificada
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_compra_bonificada();

DROP TRIGGER IF EXISTS trigger_calculate_total_pontos ON public.compras;
CREATE TRIGGER trigger_calculate_total_pontos
  BEFORE INSERT OR UPDATE ON public.compras
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_pontos();

DROP TRIGGER IF EXISTS trigger_compras_after_estoque ON public.compras;
CREATE TRIGGER trigger_compras_after_estoque
  AFTER DELETE OR INSERT OR UPDATE ON public.compras
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compras_after_estoque();

DROP TRIGGER IF EXISTS trigger_compras_before_saldo ON public.compras;
CREATE TRIGGER trigger_compras_before_saldo
  BEFORE INSERT OR UPDATE ON public.compras
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compras_before_saldo();

DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_compra ON public.compras;
CREATE TRIGGER trigger_registrar_conta_pagar_compra
  AFTER INSERT OR UPDATE OR DELETE ON public.compras
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_compra();

DROP TRIGGER IF EXISTS trigger_check_membro_nao_e_titular ON public.conta_familia;
CREATE TRIGGER trigger_check_membro_nao_e_titular
  BEFORE INSERT OR UPDATE ON public.conta_familia
  FOR EACH ROW
  EXECUTE FUNCTION check_membro_nao_e_titular();

DROP TRIGGER IF EXISTS trigger_check_membro_programa_duplicado ON public.conta_familia_membros;
CREATE TRIGGER trigger_check_membro_programa_duplicado
  BEFORE INSERT OR UPDATE ON public.conta_familia_membros
  FOR EACH ROW
  EXECUTE FUNCTION check_membro_programa_duplicado();

DROP TRIGGER IF EXISTS trigger_check_titular_nao_e_membro ON public.conta_familia_membros;
CREATE TRIGGER trigger_check_titular_nao_e_membro
  BEFORE INSERT OR UPDATE ON public.conta_familia_membros
  FOR EACH ROW
  EXECUTE FUNCTION check_titular_nao_e_membro();

DROP TRIGGER IF EXISTS set_contas_a_pagar_updated_at ON public.contas_a_pagar;
CREATE TRIGGER set_contas_a_pagar_updated_at
  BEFORE UPDATE ON public.contas_a_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_a_pagar_updated_at();

DROP TRIGGER IF EXISTS set_contas_receber_updated_at ON public.contas_receber;
CREATE TRIGGER set_contas_receber_updated_at
  BEFORE UPDATE ON public.contas_receber
  FOR EACH ROW
  EXECUTE FUNCTION update_vendas_updated_at();

DROP TRIGGER IF EXISTS trigger_atualizar_saldo_localizador ON public.contas_receber;
CREATE TRIGGER trigger_atualizar_saldo_localizador
  AFTER UPDATE ON public.contas_receber
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_saldo_localizador();

DROP TRIGGER IF EXISTS trigger_transferencia_automatica_titular ON public.estoque_movimentacoes;
CREATE TRIGGER trigger_transferencia_automatica_titular
  AFTER INSERT ON public.estoque_movimentacoes
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_automatica_titular();

DROP TRIGGER IF EXISTS set_localizadores_updated_at ON public.localizadores;
CREATE TRIGGER set_localizadores_updated_at
  BEFORE UPDATE ON public.localizadores
  FOR EACH ROW
  EXECUTE FUNCTION update_vendas_updated_at();

DROP TRIGGER IF EXISTS trigger_criar_contas_receber_localizador ON public.localizadores;
CREATE TRIGGER trigger_criar_contas_receber_localizador
  AFTER INSERT ON public.localizadores
  FOR EACH ROW
  EXECUTE FUNCTION criar_contas_receber_localizador();

DROP TRIGGER IF EXISTS trigger_cleanup_logs ON public.logs;
CREATE TRIGGER trigger_cleanup_logs
  AFTER INSERT ON public.logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_logs();

DROP TRIGGER IF EXISTS programas_clubes_updated_at ON public.programas_clubes;
CREATE TRIGGER programas_clubes_updated_at
  BEFORE UPDATE ON public.programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION update_programas_clubes_updated_at();

DROP TRIGGER IF EXISTS trg_incrementar_cpf_programa ON public.programas_clubes;
CREATE TRIGGER trg_incrementar_cpf_programa
  AFTER INSERT ON public.programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_incrementar_cpf();

DROP TRIGGER IF EXISTS trigger_criar_atividades_clube ON public.programas_clubes;
CREATE TRIGGER trigger_criar_atividades_clube
  AFTER INSERT OR UPDATE ON public.programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION criar_atividades_clube();

DROP TRIGGER IF EXISTS trigger_criar_lembrete_downgrade ON public.programas_clubes;
CREATE TRIGGER trigger_criar_lembrete_downgrade
  AFTER INSERT OR UPDATE ON public.programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_criar_lembrete_downgrade();

DROP TRIGGER IF EXISTS trigger_criar_lembrete_milhas_expirando ON public.programas_clubes;
CREATE TRIGGER trigger_criar_lembrete_milhas_expirando
  AFTER INSERT OR UPDATE ON public.programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_criar_lembrete_milhas_expirando();

DROP TRIGGER IF EXISTS trigger_deletar_atividades_clube ON public.programas_clubes;
CREATE TRIGGER trigger_deletar_atividades_clube
  BEFORE DELETE ON public.programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION deletar_atividades_clube();

DROP TRIGGER IF EXISTS trigger_validar_clube_quantidade_pontos ON public.programas_clubes;
CREATE TRIGGER trigger_validar_clube_quantidade_pontos
  BEFORE INSERT OR UPDATE ON public.programas_clubes
  FOR EACH ROW
  EXECUTE FUNCTION validar_clube_quantidade_pontos();

DROP TRIGGER IF EXISTS trigger_criar_lembrete_transferencia_pessoas ON public.transferencia_pessoas;
CREATE TRIGGER trigger_criar_lembrete_transferencia_pessoas
  AFTER INSERT ON public.transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION criar_lembrete_transferencia_pessoas();

DROP TRIGGER IF EXISTS trigger_definir_status_inicial_transferencia_pessoas ON public.transferencia_pessoas;
CREATE TRIGGER trigger_definir_status_inicial_transferencia_pessoas
  BEFORE INSERT ON public.transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION definir_status_inicial_transferencia_pessoas();

DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_transferencia_pessoas ON public.transferencia_pessoas;
CREATE TRIGGER trigger_registrar_conta_pagar_transferencia_pessoas
  AFTER INSERT ON public.transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_transferencia_pessoas();

DROP TRIGGER IF EXISTS trigger_registrar_conta_receber_transferencia_pessoas ON public.transferencia_pessoas;
CREATE TRIGGER trigger_registrar_conta_receber_transferencia_pessoas
  AFTER INSERT ON public.transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_receber_transferencia_pessoas();

DROP TRIGGER IF EXISTS trigger_transferencia_pessoas_completa ON public.transferencia_pessoas;
CREATE TRIGGER trigger_transferencia_pessoas_completa
  AFTER INSERT OR UPDATE ON public.transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_pessoas_completa();

DROP TRIGGER IF EXISTS trigger_update_transferencia_pessoas_updated_at ON public.transferencia_pessoas;
CREATE TRIGGER trigger_update_transferencia_pessoas_updated_at
  BEFORE UPDATE ON public.transferencia_pessoas
  FOR EACH ROW
  EXECUTE FUNCTION update_transferencia_pessoas_updated_at();

DROP TRIGGER IF EXISTS trigger_criar_atividades_transferencia ON public.transferencia_pontos;
CREATE TRIGGER trigger_criar_atividades_transferencia
  AFTER INSERT ON public.transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION criar_atividades_transferencia();

DROP TRIGGER IF EXISTS trigger_definir_status_inicial ON public.transferencia_pontos;
CREATE TRIGGER trigger_definir_status_inicial
  BEFORE INSERT ON public.transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION definir_status_inicial_transferencia();

DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_transferencia_pontos ON public.transferencia_pontos;
CREATE TRIGGER trigger_registrar_conta_pagar_transferencia_pontos
  AFTER INSERT ON public.transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_pagar_transferencia_pontos();

DROP TRIGGER IF EXISTS trigger_registrar_conta_receber_transferencia_pontos ON public.transferencia_pontos;
CREATE TRIGGER trigger_registrar_conta_receber_transferencia_pontos
  AFTER INSERT ON public.transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_conta_receber_transferencia_pontos();

DROP TRIGGER IF EXISTS trigger_transferencia_creditar_destino_insert ON public.transferencia_pontos;
CREATE TRIGGER trigger_transferencia_creditar_destino_insert
  AFTER INSERT ON public.transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_destino();

DROP TRIGGER IF EXISTS trigger_transferencia_creditar_destino_update ON public.transferencia_pontos;
CREATE TRIGGER trigger_transferencia_creditar_destino_update
  AFTER UPDATE ON public.transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_destino();

DROP TRIGGER IF EXISTS trigger_transferencia_debitar_origem ON public.transferencia_pontos;
CREATE TRIGGER trigger_transferencia_debitar_origem
  AFTER INSERT ON public.transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_origem();

DROP TRIGGER IF EXISTS trigger_transferencia_pontos_delete ON public.transferencia_pontos;
CREATE TRIGGER trigger_transferencia_pontos_delete
  AFTER DELETE ON public.transferencia_pontos
  FOR EACH ROW
  EXECUTE FUNCTION processar_transferencia_origem_delete();

DROP TRIGGER IF EXISTS trigger_registrar_conta_pagar_venda ON public.vendas;
CREATE TRIGGER trigger_registrar_conta_pagar_venda
  AFTER INSERT OR UPDATE OR DELETE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION registrar_conta_pagar_venda();

DROP TRIGGER IF EXISTS decrementar_cpf_ao_deletar_venda ON public.vendas;
CREATE TRIGGER decrementar_cpf_ao_deletar_venda
  BEFORE DELETE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION decrementar_cpf_venda_deletada();

DROP TRIGGER IF EXISTS prevent_vendas_modification ON public.vendas;
CREATE TRIGGER prevent_vendas_modification
  BEFORE DELETE OR UPDATE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION prevent_vendas_modification();

DROP TRIGGER IF EXISTS processar_venda_trigger ON public.vendas;
CREATE TRIGGER processar_venda_trigger
  BEFORE INSERT ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION processar_venda();

DROP TRIGGER IF EXISTS reverter_venda_trigger ON public.vendas;
CREATE TRIGGER reverter_venda_trigger
  AFTER UPDATE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION reverter_venda();

DROP TRIGGER IF EXISTS set_vendas_updated_at ON public.vendas;
CREATE TRIGGER set_vendas_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION update_vendas_updated_at();

-- ROW LEVEL SECURITY

ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centro_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificacao_contabil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_bonificada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_familia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_familia_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_familia_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos_recorrentes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localizadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiro_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiro_programa_cpfs_controle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passagens_emitidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas_clubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas_fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_programa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia_pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- POLICIES

CREATE POLICY "allow_all_atividades" ON public.atividades
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_cartoes_credito" ON public.cartoes_credito
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_centro_custos" ON public.centro_custos
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_classificacao_contabil" ON public.classificacao_contabil
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_clientes" ON public.clientes
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_compra_bonificada" ON public.compra_bonificada
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_compras" ON public.compras
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_conta_familia" ON public.conta_familia
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_conta_familia_historico" ON public.conta_familia_historico
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_conta_familia_membros" ON public.conta_familia_membros
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_contas_a_pagar" ON public.contas_a_pagar
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_contas_bancarias" ON public.contas_bancarias
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_contas_receber" ON public.contas_receber
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_creditos_recorrentes_log" ON public.creditos_recorrentes_log
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_estoque_movimentacoes" ON public.estoque_movimentacoes
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_estoque_pontos" ON public.estoque_pontos
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_formas_pagamento" ON public.formas_pagamento
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_localizadores" ON public.localizadores
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_logs" ON public.logs
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_lojas" ON public.lojas
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_parceiro_documentos" ON public.parceiro_documentos
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_parceiro_programa_cpfs_controle" ON public.parceiro_programa_cpfs_controle
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_parceiros" ON public.parceiros
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_passagens_emitidas" ON public.passagens_emitidas
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_perfil_permissoes" ON public.perfil_permissoes
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_perfis_usuario" ON public.perfis_usuario
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_produtos" ON public.produtos
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_programas" ON public.programas
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_programas_clubes" ON public.programas_clubes
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_programas_fidelidade" ON public.programas_fidelidade
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_programas_membros" ON public.programas_membros
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_status_programa" ON public.status_programa
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_tipos_compra" ON public.tipos_compra
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_transferencia_pessoas" ON public.transferencia_pessoas
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_transferencia_pontos" ON public.transferencia_pontos
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_usuario_permissoes" ON public.usuario_permissoes
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "allow_all_usuarios" ON public.usuarios
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY "Permitir exclusão de venda_lotes" ON public.venda_lotes
  AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (true)
;

CREATE POLICY "Permitir inserção de venda_lotes" ON public.venda_lotes
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true)
;

CREATE POLICY "Permitir leitura de venda_lotes" ON public.venda_lotes
  AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true)
;

CREATE POLICY "allow_all_vendas" ON public.vendas
  AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true)
;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO public.formas_pagamento (nome, descricao, ativo, registrar_fluxo_caixa, ordem) VALUES
  ('PIX',                             'Pagamento via PIX',                       true, true,  1),
  ('Crédito',                         'Cartão de crédito',                       true, true,  2),
  ('Débito',                          'Cartão de débito',                        true, true,  3),
  ('Dinheiro',                        'Pagamento em dinheiro',                   true, true,  4),
  ('Transferência',                   'Transferência bancária (TED/DOC)',        true, true,  5),
  ('Boleto',                          'Pagamento via boleto bancário',           true, true,  6),
  ('Não registrar no fluxo de caixa', 'Não gera lançamento no fluxo de caixa',  true, false, 7)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.tipos_compra (nome, descricao, ativo) VALUES
  ('Compra Direta',     'Compra direta de pontos/milhas',           true),
  ('Compra via Clube',  'Compra através de clube de fidelidade',    true),
  ('Compra Bonificada', 'Compra com bônus incluso',                 true),
  ('Promoção',          'Compra em promoção especial',              true),
  ('Transferência',     'Transferência de pontos entre programas',  true)
ON CONFLICT DO NOTHING;
