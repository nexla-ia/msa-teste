/*
  # Adicionar coluna status_programa à tabela azul_membros

  1. Alterações
    - Adiciona coluna `status_programa` à tabela `azul_membros`
    - A coluna será do tipo TEXT com valor padrão 'Ativo'

  2. Notas
    - Esta coluna permite rastrear o status do membro no programa
    - Valores comuns: 'Ativo', 'Inativo', 'Suspenso', 'Cancelado'
*/

-- Adicionar status_programa à tabela azul_membros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'azul_membros' AND column_name = 'status_programa'
  ) THEN
    ALTER TABLE azul_membros ADD COLUMN status_programa TEXT DEFAULT 'Ativo';
  END IF;
END $$;
