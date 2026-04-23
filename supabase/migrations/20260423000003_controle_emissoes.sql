/*
  # Tabela controle_emissoes
  Armazena emissões de passagens (Venda Direta e Venda por Upload).
*/

CREATE TABLE IF NOT EXISTS public.controle_emissoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_venda            text NOT NULL DEFAULT 'direta' CHECK (tipo_venda IN ('direta', 'upload')),
  data                  date NOT NULL,
  data_embarque         date,
  programa_id           uuid REFERENCES programas_fidelidade(id) ON DELETE SET NULL,
  parceiro_id           uuid REFERENCES parceiros(id) ON DELETE SET NULL,
  passageiro            text,
  origem                text,
  destino               text,
  localizacao           text,
  quantidade_milhas     numeric NOT NULL DEFAULT 0,
  quantidade_passageiros integer DEFAULT 1,
  status                text DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  observacao            text,
  arquivo_origem        text,
  created_by            uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_controle_emissoes_data        ON controle_emissoes(data);
CREATE INDEX IF NOT EXISTS idx_controle_emissoes_parceiro    ON controle_emissoes(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_controle_emissoes_programa    ON controle_emissoes(programa_id);
CREATE INDEX IF NOT EXISTS idx_controle_emissoes_tipo        ON controle_emissoes(tipo_venda);

ALTER TABLE public.controle_emissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access controle_emissoes"
  ON public.controle_emissoes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
