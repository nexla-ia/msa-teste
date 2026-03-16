export const formatCPF = (cpf: string | null | undefined): string => {
  if (!cpf) return '-';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const formatCNPJ = (cnpj: string | null | undefined): string => {
  if (!cnpj) return '-';
  const cleaned = cnpj.replace(/\D/g, '');

  if (cleaned.length === 0) return '';
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 5) return cleaned.replace(/(\d{2})(\d{1,3})/, '$1.$2');
  if (cleaned.length <= 8) return cleaned.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (cleaned.length <= 12) return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');

  return cleaned.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
};

export const formatCurrency = (value: number | null | undefined): string => {
  const val = value || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);
};

export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  const parts = date.split('T')[0].split('-');
  if (parts.length !== 3) return '-';
  const [year, month, day] = parts;
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
};

export const calcularIdade = (dtNasc: string | null | undefined): string | number => {
  if (!dtNasc) return '-';
  const hoje = new Date();
  const [year, month, day] = dtNasc.split('T')[0].split('-');
  const nascimento = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
};

export const formatCPFCNPJ = (value: string | null | undefined): string => {
  if (!value || typeof value !== 'string') return '-';
  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return formatCPF(value);
  } else if (cleaned.length === 14) {
    return formatCNPJ(value);
  }

  return value || '-';
};

export const formatCurrencyInput = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  const number = parseFloat(cleaned) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(number);
};

export const parseCurrencyInput = (value: string): number => {
  const cleaned = value.replace(/\D/g, '');
  return parseFloat(cleaned) / 100;
};

export const formatCPFCNPJInput = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length <= 11) {
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  } else {
    return cleaned
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
};

export const formatTelefone = (value: string | null | undefined): string => {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length === 0) return '';
  if (cleaned.length <= 10) {
    return cleaned
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    return cleaned
      .slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
};

export const formatCEP = (value: string | null | undefined): string => {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  return cleaned
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0;

  const [year, month, day] = birthDate.split('T')[0].split('-');
  const birth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

export const formatNumberInput = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return '';
  const number = parseInt(cleaned, 10);
  return number.toLocaleString('pt-BR');
};

export const parseNumberInput = (value: string): number => {
  const cleaned = value.replace(/\D/g, '');
  return parseInt(cleaned, 10) || 0;
};

export const formatDecimalInput = (value: string, decimals: number = 2): string => {
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return '';
  const number = parseFloat(cleaned) / Math.pow(10, decimals);
  return number.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const parseDecimalInput = (value: string, decimals: number = 2): number => {
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return 0;
  return parseFloat(cleaned) / Math.pow(10, decimals);
};

export const formatNumberDisplay = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
