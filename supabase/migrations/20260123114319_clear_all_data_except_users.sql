/*
  # Limpar todos os dados do banco exceto usuarios

  1. Objetivo
    - Remover todos os dados de todas as tabelas EXCETO 'usuarios'
    - Preservar estrutura das tabelas
    - Respeitar constraints com TRUNCATE CASCADE

  2. Tabelas que serão limpas
    - Todas exceto: usuarios, auth.users
*/

TRUNCATE TABLE accor_membros CASCADE;
TRUNCATE TABLE atividades CASCADE;
TRUNCATE TABLE azul_membros CASCADE;
TRUNCATE TABLE cartoes_credito CASCADE;
TRUNCATE TABLE centro_custos CASCADE;
TRUNCATE TABLE classificacao_contabil CASCADE;
TRUNCATE TABLE clientes CASCADE;
TRUNCATE TABLE compra_bonificada CASCADE;
TRUNCATE TABLE compras CASCADE;
TRUNCATE TABLE conta_familia CASCADE;
TRUNCATE TABLE conta_familia_historico CASCADE;
TRUNCATE TABLE conta_familia_membros CASCADE;
TRUNCATE TABLE contas_bancarias CASCADE;
TRUNCATE TABLE contas_receber CASCADE;
TRUNCATE TABLE coopera_membros CASCADE;
TRUNCATE TABLE creditos_recorrentes_log CASCADE;
TRUNCATE TABLE esfera_membros CASCADE;
TRUNCATE TABLE estoque_movimentacoes CASCADE;
TRUNCATE TABLE estoque_pontos CASCADE;
TRUNCATE TABLE gov_membros CASCADE;
TRUNCATE TABLE hotmilhas_membros CASCADE;
TRUNCATE TABLE km_membros CASCADE;
TRUNCATE TABLE livelo_membros CASCADE;
TRUNCATE TABLE localizadores CASCADE;
TRUNCATE TABLE logs CASCADE;
TRUNCATE TABLE lojas CASCADE;
TRUNCATE TABLE pagol_membros CASCADE;
TRUNCATE TABLE parceiro_documentos CASCADE;
TRUNCATE TABLE parceiro_programa_cpfs_controle CASCADE;
TRUNCATE TABLE parceiros CASCADE;
TRUNCATE TABLE passagens_emitidas CASCADE;
TRUNCATE TABLE perfil_permissoes CASCADE;
TRUNCATE TABLE perfis_usuario CASCADE;
TRUNCATE TABLE produtos CASCADE;
TRUNCATE TABLE programas CASCADE;
TRUNCATE TABLE programas_clubes CASCADE;
TRUNCATE TABLE programas_fidelidade CASCADE;
TRUNCATE TABLE programas_membros CASCADE;
TRUNCATE TABLE status_programa CASCADE;
TRUNCATE TABLE tap_membros CASCADE;
TRUNCATE TABLE tipos_compra CASCADE;
TRUNCATE TABLE transferencia_pessoas CASCADE;
TRUNCATE TABLE transferencia_pontos CASCADE;
TRUNCATE TABLE usuario_permissoes CASCADE;
TRUNCATE TABLE vendas CASCADE;