/*
  # Reestruturação da tabela classificacao_contabil

  1. Alterações na Estrutura
    - Remove dados existentes da tabela
    - Adiciona coluna `categoria` (text) - Categorias principais como "Intermediação de Milhas", "Capital", "Estorno", etc.
    - Renomeia coluna `nome` para `classificacao` (text) - Classificação específica como "Cartão Roberto", "Sócios", etc.
    - Adiciona coluna `descricao` (text) - Descrição detalhada da classificação

  2. Estrutura Final
    - `id` (uuid, primary key)
    - `chave_referencia` (text) - Código de referência único
    - `categoria` (text) - Categoria principal
    - `classificacao` (text) - Nome da classificação
    - `descricao` (text) - Descrição detalhada
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Dados Inseridos
    - Todas as classificações organizadas por categoria
    - Categorias: Intermediação de Milhas, Capital, Estorno, Operação, Recursos Humanos, Prestadores de Serviço
*/

-- Remove dados existentes
DELETE FROM classificacao_contabil;

-- Adiciona coluna categoria se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classificacao_contabil' AND column_name = 'categoria'
  ) THEN
    ALTER TABLE classificacao_contabil ADD COLUMN categoria text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Renomeia coluna nome para classificacao se ainda não foi renomeada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classificacao_contabil' AND column_name = 'nome'
  ) THEN
    ALTER TABLE classificacao_contabil RENAME COLUMN nome TO classificacao;
  END IF;
END $$;

-- Adiciona coluna descricao se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classificacao_contabil' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE classificacao_contabil ADD COLUMN descricao text DEFAULT '';
  END IF;
END $$;

-- Insere os novos dados
INSERT INTO classificacao_contabil (chave_referencia, categoria, classificacao, descricao) VALUES
  -- Intermediação de Milhas
  ('IM-001', 'Intermediação de Milhas', 'Cartão Roberto', 'Todos os pagamentos de fatura de cartão ou transferencia bancária para antecipação de cartão'),
  
  -- Capital
  ('CAP-001', 'Capital', 'Sócios', 'Todos os pagamentos de fatura de cartão ou transferência bancária para Sócios, a título de distribuição de dividendos'),
  ('CAP-002', 'Capital', 'Empréstimo', 'Pagamento de juros e principal de empréstimos bancários e privados'),
  ('CAP-003', 'Capital', 'Impostos Empresa', 'Todos os impostos sobre a receita da empresa, e taxas municipais (PIS, COFINS, IR sobre Empresa, ISS, CSLL, Taxa de Fiscalização)'),
  ('CAP-004', 'Capital', 'Plano de Saúde Sócios', 'Valor do plano de saúde dos sócios'),
  
  -- Estorno
  ('EST-001', 'Estorno', 'Erro', ''),
  ('EST-002', 'Estorno', 'Taxa de Embarque', ''),
  ('EST-003', 'Estorno', 'Recebimento a Maior', ''),
  
  -- Operação
  ('OPE-001', 'Operação', 'Titulares', ''),
  ('OPE-002', 'Operação', 'Indicadores', ''),
  ('OPE-003', 'Operação', 'Clientes', ''),
  ('OPE-004', 'Operação', 'Cadastros', ''),
  ('OPE-005', 'Operação', 'Liminares', ''),
  
  -- Recursos Humanos
  ('RH-001', 'Recursos Humanos', 'Salários', 'Valor de salário, 13º, férieas e rescisões aos funcionários'),
  ('RH-002', 'Recursos Humanos', 'Beneficios', 'Valor do beneficios mensal'),
  ('RH-003', 'Recursos Humanos', 'Transporte', 'Valor do ticket para transporte'),
  ('RH-004', 'Recursos Humanos', 'Alimentação', 'Valor do ticket para alimentação'),
  ('RH-005', 'Recursos Humanos', 'Ressarcimento', 'Reembolso a funcionários'),
  ('RH-006', 'Recursos Humanos', 'Impostos Funcionários', 'Valor de IR, INSS e FGTS relativo aos funcionários'),
  ('RH-007', 'Recursos Humanos', 'Pró-labore', 'Pagamento aos sócios a titulo de pro-labore'),
  ('RH-008', 'Recursos Humanos', 'Celebrações', 'Bolo de aniversário ou HH'),
  ('RH-009', 'Recursos Humanos', 'Administrativo', 'Exame admissional'),
  ('RH-010', 'Recursos Humanos', 'Plano de Saúde Funcionários', 'Valor do plano de saúde dos funcionários'),
  
  -- Prestadores de Serviço
  ('PS-001', 'Prestadores de Serviço', 'Telefonia', 'Custa das linhas telefonicas'),
  ('PS-002', 'Prestadores de Serviço', 'Tarifa Banco', 'Tarifas bancárias'),
  ('PS-003', 'Prestadores de Serviço', 'Certificado Digital', 'Custo dos certificados digitais'),
  ('PS-004', 'Prestadores de Serviço', 'Documentos', 'Custo assinaturas eletronicas'),
  ('PS-005', 'Prestadores de Serviço', 'Escritório Aluguel', 'Aluguel do escritório'),
  ('PS-006', 'Prestadores de Serviço', 'Escritório/Serviços', 'Serviços cobrados no escritório'),
  ('PS-007', 'Prestadores de Serviço', 'Honorários Advocaticios', 'Pagamentos a advogados'),
  ('PS-008', 'Prestadores de Serviço', 'Sistema', 'Valor pago dos sistemas'),
  ('PS-009', 'Prestadores de Serviço', 'Desenvolvedores', 'Valor pago aos desenvolvedores'),
  ('PS-010', 'Prestadores de Serviço', 'Consultores', 'Valor pago aos consultores'),
  ('PS-011', 'Prestadores de Serviço', 'Equipamentos', 'Compra de equipamentos'),
  ('PS-012', 'Prestadores de Serviço', 'Contabilidade', 'Papyrus')
ON CONFLICT DO NOTHING;
