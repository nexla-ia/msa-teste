export const getErrorMessage = (error: any, tableName?: string): string => {
  if (!error) return 'Erro desconhecido';

  const errorMsg = error.message || '';

  if (errorMsg.includes('duplicate key')) {
    if (errorMsg.includes('_unique') || errorMsg.includes('_key')) {
      const fieldMatch = errorMsg.match(/Key \(([^)]+)\)/);
      const field = fieldMatch ? fieldMatch[1] : '';

      const fieldNames: Record<string, string> = {
        'cpf': 'CPF',
        'cnpj_cpf': 'CPF/CNPJ',
        'chave_referencia': 'Chave de Referência',
        'id_parceiro': 'ID Referência',
        'nome_parceiro': 'Nome do Parceiro',
        'nome_cliente': 'Nome do Cliente',
        'codigo_banco': 'Código do Banco',
        'nome_banco': 'Nome do Banco',
        'numero_cartao': 'Número do Cartão',
        'email': 'E-mail'
      };

      const friendlyField = fieldNames[field] || field || 'este valor';

      return `Já existe um registro cadastrado com ${friendlyField} igual.\n\nPor favor, utilize um valor diferente.`;
    }
  }

  if (errorMsg.includes('foreign key constraint')) {
    return 'Este registro não pode ser alterado pois está vinculado a outros dados no sistema.\n\nPara excluir ou alterar, remova primeiro os vínculos existentes.';
  }

  if (errorMsg.includes('violates check constraint')) {
    return 'Os dados informados não atendem aos critérios de validação.\n\nVerifique se todos os campos estão preenchidos corretamente.';
  }

  if (errorMsg.includes('not null constraint')) {
    return 'Existem campos obrigatórios que não foram preenchidos.\n\nPor favor, preencha todos os campos necessários.';
  }

  if (errorMsg.includes('violates row-level security policy')) {
    return 'Você não tem permissão para realizar esta operação.\n\nEntre em contato com o administrador do sistema.';
  }

  return errorMsg;
};
