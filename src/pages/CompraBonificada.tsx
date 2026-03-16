import { useState, useEffect } from 'react';
import { Gift, Plus, Pencil, Trash2, X, FileSpreadsheet, Upload, Download, Info } from 'lucide-react';
import { FilterBar } from '../components/FilterCombobox';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ParceiroSearch from '../components/ParceiroSearch';
import { formatCurrency, formatDate, formatDecimalInput, parseDecimalInput, formatNumberInput, parseNumberInput } from '../lib/formatters';
import * as XLSX from 'xlsx';

interface Parceiro {
  id: string;
  nome_parceiro: string;
  cpf?: string;
  ultima_movimentacao?: string;
}

interface Programa {
  id: string;
  nome: string;
}

interface Loja {
  id: string;
  nome: string;
}

interface Cartao {
  id: string;
  cartao: string;
  dia_vencimento?: number;
  dia_fechamento?: number;
}

interface ContaBancaria {
  id: string;
  nome_banco: string;
  agencia?: string;
  numero_conta?: string;
}

interface TipoCompra {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

interface CompraBonificada {
  id: string;
  parceiro_id: string;
  programa_id: string;
  data_compra: string;
  recebimento_produto?: string;
  recebimento_pontos: string;
  produto: string;
  loja?: string;
  loja_id?: string;
  tipo_compra_id?: string;
  pontos_real?: number;
  tipo_pontos_real?: string;
  destino: string;
  valor_produto: number;
  frete?: number;
  seguro_protecao?: number;
  valor_venda?: number;
  custo_total: number;
  forma_pagamento?: string;
  conta?: string;
  cartao_id?: string;
  conta_bancaria_id?: string;
  parcelas: number;
  data_vencimento_manual?: string;
  quantidade_pontos: number;
  valor_milheiro?: number;
  observacao?: string;
  nota_fiscal_numero?: string;
  nota_fiscal_arquivo?: string;
}

const DESTINOS = ['Uso próprio', 'Venda', 'Transferência', 'Doação'];

interface FormaPagamento {
  id: string;
  nome: string;
  ativo: boolean;
}

export default function CompraBonificada() {
  const { usuario, isAdmin } = useAuth();
  const [compras, setCompras] = useState<CompraBonificada[]>([]);
  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroPrograma, setFiltroPrograma] = useState('');
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [programasDoParceiro, setProgramasDoParceiro] = useState<Programa[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [tiposCompra, setTiposCompra] = useState<TipoCompra[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CompraBonificada | null>(null);
  const [saldoAtual, setSaldoAtual] = useState<number | null>(null);
  const [custoMedio, setCustoMedio] = useState<number | null>(null);
  const [multipleEntries, setMultipleEntries] = useState(false);
  const [batchParceiroId, setBatchParceiroId] = useState('');
  const [batchProgramaId, setBatchProgramaId] = useState('');
  const [batchProgramasDoParceiro, setBatchProgramasDoParceiro] = useState<Programa[]>([]);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState<Partial<CompraBonificada>>({
    data_compra: new Date().toISOString().split('T')[0],
    recebimento_pontos: new Date().toISOString().split('T')[0],
    destino: 'Uso próprio',
    valor_produto: 0,
    custo_total: 0,
    parcelas: 1,
    quantidade_pontos: 0,
    pontos_real: 4,
    valor_milheiro: 0,
    data_vencimento_manual: '',
  });
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calcularPontos();
  }, [formData.valor_produto, formData.pontos_real]);

  useEffect(() => {
    calcularCustoTotal();
  }, [formData.quantidade_pontos, formData.valor_milheiro]);

  useEffect(() => {
    if (formData.parceiro_id && formData.programa_id) {
      buscarSaldoECusto(formData.parceiro_id, formData.programa_id);
    }
  }, [formData.parceiro_id, formData.programa_id]);

  useEffect(() => {
    if (formData.parceiro_id) {
      buscarProgramasDoParceiro(formData.parceiro_id);
      setFormData(prev => ({ ...prev, programa_id: '' }));
    } else {
      setProgramasDoParceiro([]);
    }
  }, [formData.parceiro_id]);

  useEffect(() => {
    if (batchParceiroId) {
      buscarProgramasDoBatchParceiro(batchParceiroId);
      setBatchProgramaId('');
    } else {
      setBatchProgramasDoParceiro([]);
    }
  }, [batchParceiroId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: parceirosAtivos, error: parceirosError } = await supabase.rpc('get_parceiros_ativos', { dias_limite: 90 });

      const [comprasRes, programasRes, lojasRes, cartoesRes, contasBancariasRes, tiposCompraRes, formasPagRes] = await Promise.all([
        supabase.from('compra_bonificada').select('*').order('data_compra', { ascending: false }),
        supabase.from('programas_fidelidade').select('id, nome').order('nome'),
        supabase.from('lojas').select('id, nome').order('nome'),
        supabase.from('cartoes_credito').select('id, cartao, dia_vencimento, dia_fechamento').order('cartao'),
        supabase.from('contas_bancarias').select('id, nome_banco, agencia, numero_conta').order('nome_banco'),
        supabase.from('tipos_compra').select('*').eq('ativo', true).order('nome'),
        supabase.from('formas_pagamento').select('id, nome, ativo').eq('ativo', true).order('ordem', { ascending: true })
      ]);

      if (parceirosError || !parceirosAtivos || parceirosAtivos.length === 0) {
  const { data: todosParceiros } = await supabase.from('parceiros').select('id, nome_parceiro, cpf').order('nome_parceiro');
  setParceiros(todosParceiros || []);
} else {
  setParceiros(parceirosAtivos || []);
}

      if (comprasRes.data) setCompras(comprasRes.data);
      if (programasRes.data) setProgramas(programasRes.data);
      if (lojasRes.data) setLojas(lojasRes.data);
      if (cartoesRes.data) setCartoes(cartoesRes.data);
      if (contasBancariasRes.data) setContasBancarias(contasBancariasRes.data);
      if (tiposCompraRes.data) setTiposCompra(tiposCompraRes.data);
      if (formasPagRes.data) setFormasPagamento(formasPagRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarProgramasDoParceiro = async (parceiroId: string) => {
    try {
      const { data, error } = await supabase
        .from('programas_clubes')
        .select('programa_id, programas_fidelidade(id, nome)')
        .eq('parceiro_id', parceiroId);

      if (error) {
        console.error('Erro ao buscar programas do parceiro:', error);
        setProgramasDoParceiro([]);
        return;
      }

      if (data) {
        const programasFormatados = data.map((item: any) => ({
          id: item.programas_fidelidade.id,
          nome: item.programas_fidelidade.nome
        }));
        setProgramasDoParceiro(programasFormatados);
      } else {
        setProgramasDoParceiro([]);
      }
    } catch (error) {
      console.error('Erro ao buscar programas do parceiro:', error);
      setProgramasDoParceiro([]);
    }
  };

  const buscarProgramasDoBatchParceiro = async (parceiroId: string) => {
    try {
      const { data, error } = await supabase
        .from('programas_clubes')
        .select('programa_id, programas_fidelidade(id, nome)')
        .eq('parceiro_id', parceiroId);

      if (error) {
        console.error('Erro ao buscar programas do parceiro (batch):', error);
        setBatchProgramasDoParceiro([]);
        return;
      }

      if (data) {
        const programasFormatados = data.map((item: any) => ({
          id: item.programas_fidelidade.id,
          nome: item.programas_fidelidade.nome
        }));
        setBatchProgramasDoParceiro(programasFormatados);
      } else {
        setBatchProgramasDoParceiro([]);
      }
    } catch (error) {
      console.error('Erro ao buscar programas do parceiro (batch):', error);
      setBatchProgramasDoParceiro([]);
    }
  };

  const buscarSaldoECusto = async (parceiroId: string, programaId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('calcular_saldo_parceiro_programa', {
          p_parceiro_id: parceiroId,
          p_programa_id: programaId
        });

      if (error) {
        console.error('Erro ao calcular saldo:', error);
        setSaldoAtual(null);
        setCustoMedio(null);
        return;
      }

      if (data && data.length > 0) {
        setSaldoAtual(Number(data[0].saldo) || 0);
        setCustoMedio(Number(data[0].custo_medio) || 0);
      } else {
        setSaldoAtual(0);
        setCustoMedio(0);
      }
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
      setSaldoAtual(null);
      setCustoMedio(null);
    }
  };

  const calcularPontos = () => {
    const valorProduto = Number(formData.valor_produto) || 0;
    const pontosReal = Number(formData.pontos_real) || 4;
    const pontos = Math.round(valorProduto * pontosReal);
    setFormData(prev => ({ ...prev, quantidade_pontos: pontos }));
  };

  const calcularCustoTotal = () => {
    const quantidadePontos = Number(formData.quantidade_pontos) || 0;
    const valorMilheiro = Number(formData.valor_milheiro) || 0;

    if (quantidadePontos > 0 && valorMilheiro > 0) {
      const custoTotal = (quantidadePontos * valorMilheiro) / 1000;
      setFormData(prev => ({ ...prev, custo_total: Number(custoTotal.toFixed(2)) }));
    } else {
      setFormData(prev => ({ ...prev, custo_total: 0 }));
    }
  };


  const criarAtividadeRecebimentoPontos = async (
    parceiroNome: string,
    programaNome: string,
    quantidade: number,
    dataRecebimento: string,
    produto: string
  ) => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const dataReceb = new Date(dataRecebimento + 'T00:00:00');
      const hojeDate = new Date(hoje + 'T00:00:00');

      if (dataReceb > hojeDate) {
        await supabase.from('atividades').insert([{
          tipo_atividade: 'Recebimento Pendente',
          descricao: `Aguardando ${quantidade.toLocaleString('pt-BR')} pontos de ${programaNome} (${parceiroNome}) - Produto: ${produto}`,
          data_atividade: dataRecebimento,
          status: 'pendente'
        }]);
      } else if (dataReceb.getTime() === hojeDate.getTime()) {
        await supabase.from('atividades').insert([{
          tipo_atividade: 'Recebimento',
          descricao: `Recebidos ${quantidade.toLocaleString('pt-BR')} pontos de ${programaNome} (${parceiroNome}) - Produto: ${produto}`,
          data_atividade: dataRecebimento,
          status: 'concluido'
        }]);
      }
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.parceiro_id || !formData.programa_id || !formData.produto || !formData.quantidade_pontos) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Campos Obrigatórios',
        message: 'Por favor, preencha todos os campos obrigatórios.'
      });
      return;
    }

    const { data: estoqueCheck } = await supabase
      .from('estoque_pontos')
      .select('id')
      .eq('parceiro_id', formData.parceiro_id)
      .eq('programa_id', formData.programa_id)
      .maybeSingle();

    if (!estoqueCheck) {
      const programaSel = programasDoParceiro.find((p: any) => p.id === formData.programa_id);
      const { data: parceiroData } = await supabase
        .from('parceiros')
        .select('nome_parceiro')
        .eq('id', formData.parceiro_id)
        .maybeSingle();
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiro sem conta no programa',
        message: `${parceiroData?.nome_parceiro || 'O parceiro selecionado'} não possui conta cadastrada no programa ${programaSel?.nome || 'selecionado'}.\n\nRegistre uma compra ou movimentação para este parceiro neste programa antes de criar uma compra bonificada.`
      });
      return;
    }

    // Validar forma de pagamento quando há custo
    if (formData.custo_total && formData.custo_total > 0 && !formData.forma_pagamento) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Forma de Pagamento Obrigatória',
        message: 'Selecione a forma de pagamento para esta compra.'
      });
      return;
    }

    // Validar data de vencimento para pagamento em dinheiro
    if (formData.forma_pagamento === 'Dinheiro' && !formData.data_vencimento_manual) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Data de Vencimento Obrigatória',
        message: 'Informe a data de vencimento para pagamento em dinheiro.'
      });
      return;
    }

    // Validar se o custo total é zero
    if (!formData.custo_total || formData.custo_total === 0) {
      setDialogConfig({
        isOpen: true,
        type: 'confirm',
        title: 'Confirmar Custo Zero',
        message: 'O custo total desta compra bonificada é R$ 0,00. Isso significa que não haverá custo financeiro associado a esta entrada de pontos. Tem certeza que deseja continuar?',
        onConfirm: async () => {
          setDialogConfig({ ...dialogConfig, isOpen: false });
          await saveCompraBonificada();
        },
        onCancel: () => {
          setDialogConfig({ ...dialogConfig, isOpen: false });
        }
      });
      return;
    }

    await saveCompraBonificada();
  };

  const saveCompraBonificada = async () => {
    try {
      const dataToSave = {
        ...formData,
        destino: 'Uso próprio',
        updated_at: new Date().toISOString(),
        data_vencimento_manual: formData.data_vencimento_manual || null
      };

      if (editingItem) {
        if (isAdmin && usuario) {
          await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: true });
        }

        const { error } = await supabase
          .from('compra_bonificada')
          .update(dataToSave)
          .eq('id', editingItem.id);

        if (isAdmin && usuario) {
          await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
        }

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('compra_bonificada')
          .insert([dataToSave]);
        if (error) throw error;

        if (formData.recebimento_pontos && formData.quantidade_pontos) {
          const parceiroNome = getParceiroNome(formData.parceiro_id);
          const programaNome = getProgramaNome(formData.programa_id);
          await criarAtividadeRecebimentoPontos(
            parceiroNome,
            programaNome,
            formData.quantidade_pontos,
            formData.recebimento_pontos,
            formData.produto || ''
          );
        }
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({
        data_compra: new Date().toISOString().split('T')[0],
        recebimento_pontos: new Date().toISOString().split('T')[0],
        destino: 'Uso próprio',
        valor_produto: 0,
        custo_total: 0,
        parcelas: 1,
        quantidade_pontos: 0,
      });
      setSaldoAtual(null);
      setCustoMedio(null);
      fetchData();
    } catch (error: any) {
      if (isAdmin && usuario) {
        await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
      }
      console.error('Erro ao salvar:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: error.message || 'Ocorreu um erro ao salvar o registro.'
      });
    }
  };

  const handleEdit = (item: CompraBonificada) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir este registro?\n\nEsta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          if (isAdmin && usuario) {
            await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: true });
          }

          const { error } = await supabase
            .from('compra_bonificada')
            .delete()
            .eq('id', id);

          if (isAdmin && usuario) {
            await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
          }

          if (error) throw error;
          fetchData();
        } catch (error: any) {
          if (isAdmin && usuario) {
            await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
          }
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: error.message || 'Ocorreu um erro ao excluir o registro.'
          });
        }
      }
    });
  };

  const getParceiroNome = (id: string) => {
    return parceiros.find(p => p.id === id)?.nome_parceiro || '-';
  };

  const getProgramaNome = (id: string) => {
    return programas.find(p => p.id === id)?.nome || '-';
  };

  const comprasFiltradas = compras.filter(c =>
    (!filtroParceiro || getParceiroNome(c.parceiro_id).toLowerCase().includes(filtroParceiro.toLowerCase())) &&
    (!filtroPrograma || getProgramaNome(c.programa_id).toLowerCase().includes(filtroPrograma.toLowerCase()))
  );

  const parceirosUnicos = Array.from(new Set(compras.map(c => getParceiroNome(c.parceiro_id)).filter(n => n !== '-'))).sort();
  const programasUnicos = Array.from(new Set(compras.map(c => getProgramaNome(c.programa_id)).filter(n => n !== '-'))).sort();

  const getLojaNome = (id?: string) => {
    if (!id) return '-';
    return lojas.find(l => l.id === id)?.nome || '-';
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Parceiro (Nome)': 'João Silva',
        'Programa (Nome)': 'Smiles',
        'Data Compra': '2025-01-15',
        'Recebimento Produto': '2025-01-20',
        'Recebimento Pontos': '2025-01-25',
        'Produto': 'Notebook Dell',
        'Loja': 'Magazine Luiza',
        'Valor Produto': 3500.00,
        'Forma Pagamento': 'Crédito',
        'Cartão': 'Santander Platinum',
        'Conta Bancária': '',
        'Parcelas': 3,
        'Observação': 'Exemplo 1 - Pontos calculados automaticamente (3500 x 4 = 14000)'
      },
      {
        'Parceiro (Nome)': 'Maria Santos',
        'Programa (Nome)': 'Livelo',
        'Data Compra': '2025-01-16',
        'Recebimento Produto': '',
        'Recebimento Pontos': '2025-02-01',
        'Produto': 'Smartphone Samsung',
        'Loja': 'Americanas',
        'Valor Produto': 2000.00,
        'Forma Pagamento': 'Não contabilizar no fluxo de caixa',
        'Cartão': '',
        'Conta Bancária': 'Conta Corrente BB',
        'Parcelas': 1,
        'Observação': 'Exemplo 2 - Valor Produto = Custo Total'
      }
    ];

    const opcoes = [
      { Campo: 'Parceiro (Nome)', 'Opções Válidas': 'Nome completo do parceiro cadastrado no sistema - Obrigatório' },
      { Campo: 'Programa (Nome)', 'Opções Válidas': 'Nome do programa de fidelidade (Smiles, Livelo, TAP, etc) - Obrigatório' },
      { Campo: 'Data Compra', 'Opções Válidas': 'Formato: AAAA-MM-DD (ex: 2025-01-15) - Obrigatório' },
      { Campo: 'Recebimento Produto', 'Opções Válidas': 'Formato: AAAA-MM-DD (ex: 2025-01-15) - Opcional' },
      { Campo: 'Recebimento Pontos', 'Opções Válidas': 'Formato: AAAA-MM-DD (ex: 2025-01-15) - Obrigatório' },
      { Campo: 'Produto', 'Opções Válidas': 'Descrição do produto - Obrigatório' },
      { Campo: 'Loja', 'Opções Válidas': 'Nome da loja cadastrada no sistema - Opcional' },
      { Campo: 'Valor Produto', 'Opções Válidas': 'Apenas números com ponto decimal (ex: 3500.00) - Obrigatório. Este valor será usado como Custo Total.' },
      { Campo: 'Forma Pagamento', 'Opções Válidas': 'Nome da forma de pagamento cadastrada no sistema - Opcional' },
      { Campo: 'Cartão', 'Opções Válidas': 'Nome do cartão cadastrado no sistema - Opcional (apenas se forma for Crédito)' },
      { Campo: 'Conta Bancária', 'Opções Válidas': 'Nome da conta bancária cadastrada - Opcional' },
      { Campo: 'Parcelas', 'Opções Válidas': 'Apenas números inteiros de 1 a 12 (padrão: 1)' },
      { Campo: 'Quantidade Pontos', 'Opções Válidas': 'Calculado automaticamente (4 pontos para cada R$ 1,00 do valor do produto)' },
      { Campo: 'Custo Total', 'Opções Válidas': 'Será igual ao Valor do Produto' },
      { Campo: 'Observação', 'Opções Válidas': 'Texto livre para notas e comentários (opcional)' }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wsOpcoes = XLSX.utils.json_to_sheet(opcoes);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.utils.book_append_sheet(wb, wsOpcoes, 'Opções Válidas');

    XLSX.writeFile(wb, 'template_compra_bonificada.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const processedData = data.map((row: any) => {
          const lojaId = lojas.find(l => l.nome.toLowerCase() === String(row['Loja'] || '').toLowerCase())?.id;

          const valorProduto = Number(row['Valor Produto'] || 0);
          const custoTotal = valorProduto;

          const quantidadePontos = Math.round(valorProduto * 4);
          const valorMilheiro = quantidadePontos > 0 ? (custoTotal / quantidadePontos) * 1000 : 0;

          return {
            data_compra: row['Data Compra'] || row['data_compra'],
            recebimento_produto: row['Recebimento Produto'] || row['recebimento_produto'] || null,
            recebimento_pontos: row['Recebimento Pontos'] || row['recebimento_pontos'],
            produto: row['Produto'] || row['produto'],
            loja: row['Loja'] || row['loja'],
            loja_id: lojaId,
            destino: 'Uso próprio',
            valor_produto: valorProduto,
            custo_total: Number(custoTotal.toFixed(2)),
            forma_pagamento: row['Forma Pagamento'] || row['forma_pagamento'] || null,
            parcelas: Number(row['Parcelas'] || row['parcelas'] || 1),
            quantidade_pontos: quantidadePontos,
            valor_milheiro: Number(valorMilheiro.toFixed(4)),
            observacao: row['Observação'] || row['Observacao'] || row['observacao'] || ''
          };
        });

        setExcelData(processedData);
        setShowPreview(true);
      } catch (error) {
        console.error('Erro ao processar planilha:', error);
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Processar Planilha',
          message: 'Não foi possível processar a planilha. Verifique o formato.'
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchParceiroId || !batchProgramaId) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Campos Obrigatórios',
        message: 'Por favor, selecione o Parceiro e o Programa.'
      });
      return;
    }

    if (excelData.length === 0) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Dados Necessários',
        message: 'Por favor, faça o upload de uma planilha com os dados.'
      });
      return;
    }

    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Confirmar Importação',
      message: `Tem certeza que deseja importar ${excelData.length} compra(s) bonificada(s)?\n\nParceiro: ${getParceiroNome(batchParceiroId)}\nPrograma: ${getProgramaNome(batchProgramaId)}`,
      onConfirm: async () => {
        try {
          const dataToInsert = excelData.map(item => ({
            ...item,
            parceiro_id: batchParceiroId,
            programa_id: batchProgramaId,
            destino: 'Uso próprio',
            updated_at: new Date().toISOString()
          }));

          const { error } = await supabase
            .from('compra_bonificada')
            .insert(dataToInsert);

          if (error) throw error;

          const parceiroNome = getParceiroNome(batchParceiroId);
          const programaNome = getProgramaNome(batchProgramaId);

          for (const item of excelData) {
            if (item.recebimento_pontos && item.quantidade_pontos) {
              await criarAtividadeRecebimentoPontos(
                parceiroNome,
                programaNome,
                item.quantidade_pontos,
                item.recebimento_pontos,
                item.produto || ''
              );
            }
          }

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: `${excelData.length} compra(s) bonificada(s) importada(s) com sucesso!`
          });

          setIsModalOpen(false);
          setMultipleEntries(false);
          setBatchParceiroId('');
          setBatchProgramaId('');
          setExcelData([]);
          setShowPreview(false);
          fetchData();
        } catch (error: any) {
          console.error('Erro ao importar:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Importar',
            message: error.message || 'Ocorreu um erro ao importar as compras bonificadas.'
          });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Gift className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Compra Bonificada</h1>
            <p className="text-sm text-slate-600">Gerencie as compras com bonificação de pontos</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({
              data_compra: new Date().toISOString().split('T')[0],
              recebimento_pontos: new Date().toISOString().split('T')[0],
              destino: 'Uso próprio',
              valor_produto: 0,
              custo_total: 0,
              parcelas: 1,
              quantidade_pontos: 0,
            });
            setSaldoAtual(null);
            setCustoMedio(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Compra Bonificada
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <FilterBar
            filters={[
              { label: 'Parceiro', options: parceirosUnicos, value: filtroParceiro, onChange: setFiltroParceiro },
              { label: 'Programa', options: programasUnicos, value: filtroPrograma, onChange: setFiltroPrograma },
            ]}
            onClear={() => { setFiltroParceiro(''); setFiltroPrograma(''); }}
          />
        </div>
        <div className="overflow-x-auto max-w-full">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Parceiro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Programa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Data Compra</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Produto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Pontos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Custo Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Valor Milheiro</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {comprasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <Gift className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">Nenhuma compra bonificada cadastrada</p>
                  </td>
                </tr>
              ) : (
                comprasFiltradas.map((compra) => (
                  <tr key={compra.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{getParceiroNome(compra.parceiro_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{getProgramaNome(compra.programa_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatDate(compra.data_compra)}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{compra.produto}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{compra.quantidade_pontos?.toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatCurrency(compra.custo_total)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatCurrency(compra.valor_milheiro || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(compra)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(compra.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => {
        setIsModalOpen(false);
        setMultipleEntries(false);
        setExcelData([]);
        setShowPreview(false);
      }} title={editingItem ? 'Editar Compra Bonificada' : 'Nova Compra Bonificada'}>
        <form onSubmit={multipleEntries ? handleBatchSubmit : handleSubmit} className="space-y-4">
          {!editingItem && (
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={multipleEntries}
                  onChange={(e) => {
                    setMultipleEntries(e.target.checked);
                    setExcelData([]);
                    setShowPreview(false);
                    if (e.target.checked) {
                      setBatchParceiroId('');
                      setBatchProgramaId('');
                    }
                  }}
                  className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">Importar Múltiplas Compras via Excel</span>
                </div>
              </label>
            </div>
          )}

          {multipleEntries ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Parceiro <span className="text-red-500">*</span>
                  </label>
                  <ParceiroSearch
                    parceiros={parceiros}
                    value={batchParceiroId}
                    onChange={(parceiroId) => setBatchParceiroId(parceiroId)}
                    placeholder="Digite para buscar parceiro..."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Mostrando parceiros com movimentação nos últimos 90 dias
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Programa <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={batchProgramaId}
                    onChange={(e) => setBatchProgramaId(e.target.value)}
                    disabled={!batchParceiroId}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">
                      {!batchParceiroId
                        ? 'Selecione um parceiro primeiro'
                        : batchProgramasDoParceiro.length === 0
                          ? 'Parceiro sem programas cadastrados'
                          : 'Selecione um programa'}
                    </option>
                    {batchProgramasDoParceiro.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  {batchParceiroId && batchProgramasDoParceiro.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Este parceiro não possui programas cadastrados. Cadastre em Programas/Clubes primeiro.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                  <Upload className="w-12 h-12 text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700 mb-1">Faça upload da planilha Excel</p>
                    <p className="text-xs text-slate-500">Formatos aceitos: .xlsx, .xls</p>
                  </div>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Selecionar Arquivo
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Template
                    </button>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 w-full">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-semibold mb-1">Atenção: Use as opções exatas do sistema</p>
                        <p className="mb-1">O template contém 2 abas:</p>
                        <ul className="list-disc ml-4 space-y-0.5">
                          <li><strong>Dados:</strong> Exemplos de preenchimento</li>
                          <li><strong>Opções Válidas:</strong> Lista completa de valores aceitos para cada campo</li>
                        </ul>
                        <p className="mt-1 font-medium">Os valores devem ser EXATAMENTE como listados na aba "Opções Válidas".</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {showPreview && excelData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800">Preview dos Dados</h3>
                    <span className="text-sm text-slate-600">{excelData.length} registro(s)</span>
                  </div>
                  <div className="max-h-96 overflow-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Data Compra</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Receb. Pontos</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Produto</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Loja</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Pontos</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Custo Total</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Valor Milheiro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {excelData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2">{formatDate(row.data_compra)}</td>
                            <td className="px-3 py-2">{formatDate(row.recebimento_pontos)}</td>
                            <td className="px-3 py-2">{row.produto}</td>
                            <td className="px-3 py-2">{row.loja || '-'}</td>
                            <td className="px-3 py-2">{row.quantidade_pontos?.toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-2">{formatCurrency(row.custo_total)}</td>
                            <td className="px-3 py-2">{formatCurrency(row.valor_milheiro)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Importar {excelData.length} Compra(s) Bonificada(s)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Parceiro <span className="text-red-500">*</span>
              </label>
              <ParceiroSearch
                parceiros={parceiros}
                value={formData.parceiro_id || ''}
                onChange={(parceiroId) => setFormData({ ...formData, parceiro_id: parceiroId })}
                placeholder="Digite para buscar parceiro..."
              />
              <p className="text-xs text-slate-500 mt-1">
                Mostrando parceiros com movimentação nos últimos 90 dias
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Programa <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.programa_id || ''}
                onChange={(e) => setFormData({ ...formData, programa_id: e.target.value })}
                disabled={!formData.parceiro_id}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">
                  {!formData.parceiro_id
                    ? 'Selecione um parceiro primeiro'
                    : programasDoParceiro.length === 0
                      ? 'Parceiro sem programas cadastrados'
                      : 'Selecione'}
                </option>
                {programasDoParceiro.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              {formData.parceiro_id && programasDoParceiro.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Este parceiro não possui programas cadastrados. Cadastre em Programas/Clubes primeiro.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Atual</label>
              <input
                type="text"
                value={saldoAtual !== null ? saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                disabled
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custo Médio</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">R$</span>
                <input
                  type="text"
                  value={custoMedio !== null ? custoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  disabled
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data Compra <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.data_compra || ''}
                onChange={(e) => setFormData({ ...formData, data_compra: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recebimento Produto</label>
              <input
                type="date"
                value={formData.recebimento_produto || ''}
                onChange={(e) => setFormData({ ...formData, recebimento_produto: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Recebimento Pontos <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.recebimento_pontos || ''}
                onChange={(e) => setFormData({ ...formData, recebimento_pontos: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Produto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.produto || ''}
                onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loja</label>
              <select
                value={formData.loja_id || ''}
                onChange={(e) => setFormData({ ...formData, loja_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Selecione</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>{loja.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Compra</label>
              <select
                value={formData.tipo_compra_id || ''}
                onChange={(e) => setFormData({ ...formData, tipo_compra_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Selecione</option>
                {tiposCompra.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-2 rounded-lg p-4 bg-red-50 border-red-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-700">Pagamento</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Valor Produto <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">R$</span>
                  <input
                    type="text"
                    required
                    value={formatDecimalInput(String(Math.round((formData.valor_produto || 0) * 100)), 2)}
                    onFocus={(e) => {
                      if (formData.valor_produto === 0 || !formData.valor_produto) {
                        e.target.select();
                      }
                    }}
                    onChange={(e) => {
                      const value = parseDecimalInput(e.target.value, 2);
                      setFormData({ ...formData, valor_produto: value });
                    }}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Usado apenas para calcular a quantidade de pontos</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Custo Total <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">R$</span>
                  <input
                    type="text"
                    value={formatDecimalInput(String(Math.round((formData.custo_total || 0) * 100)), 2)}
                    onFocus={(e) => {
                      if (formData.custo_total === 0 || !formData.custo_total) {
                        e.target.select();
                      }
                    }}
                    onChange={(e) => {
                      const value = parseDecimalInput(e.target.value, 2);
                      setFormData({ ...formData, custo_total: value });
                    }}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Calculado automaticamente: Quantidade × Valor Milheiro ÷ 1000</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento</label>
                <select
                  value={formData.forma_pagamento || ''}
                  onChange={(e) => {
                    const forma = e.target.value;
                    const usaCartao = forma === 'Crédito' || forma === 'Débito';
                    const usaBanco = forma === 'PIX' || forma === 'Transferência' || forma === 'Dinheiro';

                    setFormData({
                      ...formData,
                      forma_pagamento: forma,
                      cartao_id: usaCartao ? formData.cartao_id : undefined,
                      conta_bancaria_id: usaBanco ? formData.conta_bancaria_id : undefined
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione</option>
                  {formasPagamento.map((forma) => (
                    <option key={forma.id} value={forma.nome}>{forma.nome}</option>
                  ))}
                </select>
              </div>

              {formData.forma_pagamento !== 'Não registrar no fluxo de caixa' && (
                <>
                  {(formData.forma_pagamento === 'Crédito' || formData.forma_pagamento === 'Débito') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cartão</label>
                      <select
                        value={formData.cartao_id || ''}
                        onChange={(e) => setFormData({ ...formData, cartao_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Selecione</option>
                        {cartoes.map((cartao) => (
                          <option key={cartao.id} value={cartao.id}>{cartao.cartao}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(formData.forma_pagamento === 'PIX' || formData.forma_pagamento === 'Transferência' || formData.forma_pagamento === 'Dinheiro') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Banco Emissor</label>
                      <select
                        value={formData.conta_bancaria_id || ''}
                        onChange={(e) => setFormData({ ...formData, conta_bancaria_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Selecione</option>
                        {contasBancarias.map((conta) => (
                          <option key={conta.id} value={conta.id}>
                            {conta.nome_banco}
                            {conta.agencia && conta.numero_conta ? ` - Ag: ${conta.agencia} / CC: ${conta.numero_conta}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {formData.forma_pagamento === 'Dinheiro' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data de Vencimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.data_vencimento_manual || ''}
                    onChange={(e) => setFormData({ ...formData, data_vencimento_manual: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={formData.parcelas || 1}
                  onChange={(e) => setFormData({ ...formData, parcelas: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pontos por Real <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.pontos_real !== undefined ? formatNumberInput(String(formData.pontos_real)) : '4'}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const value = parseNumberInput(e.target.value);
                  setFormData(prev => ({ ...prev, pontos_real: value }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-slate-500">Quantos pontos por R$ 1,00</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quantidade Pontos/Milhas <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.quantidade_pontos ? formatNumberInput(String(formData.quantidade_pontos)) : '0'}
                onFocus={(e) => {
                  if (formData.quantidade_pontos === 0 || !formData.quantidade_pontos) {
                    e.target.select();
                  }
                }}
                onChange={(e) => {
                  const parsed = parseNumberInput(e.target.value);
                  setFormData(prev => ({ ...prev, quantidade_pontos: parsed }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-slate-500">Calculado automaticamente (Valor Produto × Pontos por Real)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valor Milheiro
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">R$</span>
                <input
                  type="text"
                  value={formatDecimalInput(String(Math.round((formData.valor_milheiro || 0) * 100)), 2)}
                  onFocus={(e) => {
                    if (formData.valor_milheiro === 0 || !formData.valor_milheiro) {
                      e.target.select();
                    }
                  }}
                  onChange={(e) => {
                    const value = parseDecimalInput(e.target.value, 2);
                    setFormData(prev => ({ ...prev, valor_milheiro: value }));
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Insira manualmente o valor do milheiro de pontos. Ao alterar, o Custo Total será recalculado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número da Nota Fiscal</label>
              <input
                type="text"
                value={formData.nota_fiscal_numero || ''}
                onChange={(e) => setFormData({ ...formData, nota_fiscal_numero: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Ex: 12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Arquivo da Nota Fiscal (URL)</label>
              <input
                type="text"
                value={formData.nota_fiscal_arquivo || ''}
                onChange={(e) => setFormData({ ...formData, nota_fiscal_arquivo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Cole o link do arquivo"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <textarea
              value={formData.observacao || ''}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          </>
          )}

          {!multipleEntries && (
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setMultipleEntries(false);
                  setExcelData([]);
                  setShowPreview(false);
                }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Salvar
              </button>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
        onConfirm={dialogConfig.onConfirm}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
      />
    </div>
  );
}
