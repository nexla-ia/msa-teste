/*
  # Remove constraint rígida do campo tipo em compras
  
  1. Alterações
    - Remove a constraint `compras_tipo_check` que limitava os valores do campo `tipo`
    - Permite que o campo `tipo` aceite qualquer valor texto vindo da tabela `tipos_compra`
    - Isso torna o sistema mais flexível para aceitar novos tipos de compra
  
  2. Motivo
    - A tabela `tipos_compra` foi criada para gerenciar dinamicamente os tipos de compra
    - A constraint antiga impedia o uso dos tipos cadastrados na tabela `tipos_compra`
    - Com essa mudança, o sistema passa a usar os tipos cadastrados em `tipos_compra`
*/

-- Remove a constraint que limita os valores do campo tipo
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_tipo_check;

-- Adiciona uma constraint simples que apenas garante que o campo não seja vazio
ALTER TABLE compras ADD CONSTRAINT compras_tipo_not_empty CHECK (tipo IS NOT NULL AND tipo <> '');
