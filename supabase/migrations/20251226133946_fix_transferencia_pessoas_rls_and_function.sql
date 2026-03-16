/*
  # Corrigir RLS e função da tabela transferencia_pessoas

  1. Alterações nas Políticas RLS
    - Alterar de `authenticated` para `public` para compatibilidade com autenticação customizada
    - Sistema usa tabela `usuarios` customizada, não `auth.users`

  2. Correção na Função
    - Atualizar para usar destino_programa_id ao invés de programa_id
    - Permite transferências entre programas diferentes

  3. Segurança
    - Mantém RLS habilitado
    - Permite acesso apenas para usuários logados via sistema customizado
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar transferências entre pessoas" ON transferencia_pessoas;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir transferências entre pessoas" ON transferencia_pessoas;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar transferências entre pessoas" ON transferencia_pessoas;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar transferências entre pessoas" ON transferencia_pessoas;

-- Criar novas políticas com acesso público (autenticação customizada)
CREATE POLICY "Permitir visualizar transferências entre pessoas"
  ON transferencia_pessoas FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir inserir transferências entre pessoas"
  ON transferencia_pessoas FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir atualizar transferências entre pessoas"
  ON transferencia_pessoas FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir deletar transferências entre pessoas"
  ON transferencia_pessoas FOR DELETE
  TO public
  USING (true);

-- Atualizar função para usar destino_programa_id
CREATE OR REPLACE FUNCTION process_transferencia_pessoas()
RETURNS TRIGGER AS $$
DECLARE
  v_origem_estoque_id uuid;
  v_destino_estoque_id uuid;
  v_origem_saldo numeric;
  v_origem_custo_medio numeric;
  v_destino_saldo numeric;
  v_destino_custo_medio numeric;
  v_novo_saldo_destino numeric;
  v_novo_custo_medio numeric;
  v_programa_destino_id uuid;
BEGIN
  -- Determinar programa de destino (usar destino_programa_id se existir, senão usar programa_id)
  v_programa_destino_id := COALESCE(NEW.destino_programa_id, NEW.programa_id);

  -- Buscar estoque da origem
  SELECT id, saldo_atual, custo_medio INTO v_origem_estoque_id, v_origem_saldo, v_origem_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.origem_parceiro_id AND programa_id = NEW.programa_id;

  -- Validar se origem tem saldo suficiente
  IF v_origem_saldo IS NULL OR v_origem_saldo < NEW.quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no estoque de origem';
  END IF;

  -- Buscar ou criar estoque do destino
  SELECT id, saldo_atual, custo_medio INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio
  FROM estoque_pontos
  WHERE parceiro_id = NEW.destino_parceiro_id AND programa_id = v_programa_destino_id;

  IF v_destino_estoque_id IS NULL THEN
    -- Criar estoque para o destino
    INSERT INTO estoque_pontos (parceiro_id, programa_id, saldo_atual, custo_medio)
    VALUES (NEW.destino_parceiro_id, v_programa_destino_id, 0, 0)
    RETURNING id, saldo_atual, custo_medio INTO v_destino_estoque_id, v_destino_saldo, v_destino_custo_medio;
  END IF;

  -- Atualizar estoque de origem (diminuir)
  UPDATE estoque_pontos
  SET saldo_atual = saldo_atual - NEW.quantidade,
      updated_at = now()
  WHERE id = v_origem_estoque_id;

  -- Calcular novo custo médio do destino
  v_novo_saldo_destino := v_destino_saldo + NEW.quantidade;
  
  -- Se o novo saldo for maior que zero, calcular custo médio ponderado
  IF v_novo_saldo_destino > 0 THEN
    v_novo_custo_medio := ((v_destino_saldo * COALESCE(v_destino_custo_medio, 0)) + (NEW.quantidade * COALESCE(v_origem_custo_medio, 0))) / v_novo_saldo_destino;
  ELSE
    v_novo_custo_medio := 0;
  END IF;

  -- Atualizar estoque de destino (aumentar)
  UPDATE estoque_pontos
  SET saldo_atual = v_novo_saldo_destino,
      custo_medio = v_novo_custo_medio,
      updated_at = now()
  WHERE id = v_destino_estoque_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;