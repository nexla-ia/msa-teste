/*
  # Adicionar campos completos para Vendas
  
  1. Novos Campos
    - cia_parceira: Companhia aérea parceira
    - taxa_embarque: Taxa de embarque em R$
    - taxa_resgate: Taxa de resgate da companhia aérea em R$
    - taxa_bagagem: Bagagem/Taxa de cancelamento/Assentos em R$
    - cartao_taxa_embarque_id: Referência ao cartão usado para taxa de embarque
    - cartao_taxa_bagagem_id: Referência ao cartão usado para taxa de bagagem
    - cartao_taxa_resgate_id: Referência ao cartão usado para taxa de resgate
    - data_voo_ida: Data do voo de ida
    - data_voo_volta: Data do voo de volta
    - nome_passageiro: Nome do passageiro
    - quantidade_passageiros: Quantidade de passageiros
    - trecho: Trecho do voo
    - tarifa_diamante: Valor da tarifa diamante
    - milhas_bonus: Quantidade de milhas bônus
    - custo_emissao: Custo de emissão
    - emissor: Nome do emissor
  
  2. Observações
    - Todos os campos são opcionais exceto os já existentes que são obrigatórios
    - Campos de cartão referenciam a tabela cartoes_credito
*/

-- Adicionar campo cia_parceira
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'cia_parceira'
  ) THEN
    ALTER TABLE vendas ADD COLUMN cia_parceira text;
  END IF;
END $$;

-- Adicionar campo taxa_embarque
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'taxa_embarque'
  ) THEN
    ALTER TABLE vendas ADD COLUMN taxa_embarque numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo taxa_resgate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'taxa_resgate'
  ) THEN
    ALTER TABLE vendas ADD COLUMN taxa_resgate numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo taxa_bagagem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'taxa_bagagem'
  ) THEN
    ALTER TABLE vendas ADD COLUMN taxa_bagagem numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo cartao_taxa_embarque_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'cartao_taxa_embarque_id'
  ) THEN
    ALTER TABLE vendas ADD COLUMN cartao_taxa_embarque_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar campo cartao_taxa_bagagem_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'cartao_taxa_bagagem_id'
  ) THEN
    ALTER TABLE vendas ADD COLUMN cartao_taxa_bagagem_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar campo cartao_taxa_resgate_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'cartao_taxa_resgate_id'
  ) THEN
    ALTER TABLE vendas ADD COLUMN cartao_taxa_resgate_id uuid REFERENCES cartoes_credito(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar campo data_voo_ida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'data_voo_ida'
  ) THEN
    ALTER TABLE vendas ADD COLUMN data_voo_ida date;
  END IF;
END $$;

-- Adicionar campo data_voo_volta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'data_voo_volta'
  ) THEN
    ALTER TABLE vendas ADD COLUMN data_voo_volta date;
  END IF;
END $$;

-- Adicionar campo nome_passageiro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'nome_passageiro'
  ) THEN
    ALTER TABLE vendas ADD COLUMN nome_passageiro text;
  END IF;
END $$;

-- Adicionar campo quantidade_passageiros (já existe no localizador, mas agora será na venda)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'quantidade_passageiros'
  ) THEN
    ALTER TABLE vendas ADD COLUMN quantidade_passageiros integer DEFAULT 1;
  END IF;
END $$;

-- Adicionar campo trecho
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'trecho'
  ) THEN
    ALTER TABLE vendas ADD COLUMN trecho text;
  END IF;
END $$;

-- Adicionar campo tarifa_diamante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'tarifa_diamante'
  ) THEN
    ALTER TABLE vendas ADD COLUMN tarifa_diamante numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo milhas_bonus
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'milhas_bonus'
  ) THEN
    ALTER TABLE vendas ADD COLUMN milhas_bonus numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo custo_emissao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'custo_emissao'
  ) THEN
    ALTER TABLE vendas ADD COLUMN custo_emissao numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo emissor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendas' AND column_name = 'emissor'
  ) THEN
    ALTER TABLE vendas ADD COLUMN emissor text;
  END IF;
END $$;