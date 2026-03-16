import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Info } from 'lucide-react';
import { FilterBar } from '../components/FilterCombobox';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ParceiroSearch from '../components/ParceiroSearch';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/formatters';

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

interface ProgramaClube {
  id: string;
  programa_id: string;
  programas_fidelidade: {
    id: string;
    nome: string;
  };
}

interface EstoquePontos {
  programa_id: string;
  saldo_atual: number;
  custo_medio: number;
  programas_fidelidade: {
    id: string;
    nome: string;
  };
}

interface ContaBancaria {
  id: string;
  nome_banco: string;
}

interface CartaoCredito {
  id: string;
  cartao: string;
  dia_vencimento?: number;
  dia_fechamento?: number;
}

interface TipoCompra {
  id: string;
  nome: string;
}

interface FormaPagamento {
  id: string;
  nome: string;
  ativo: boolean;
}

interface TransferenciaPessoa {
  id: string;
  data_transferencia: string;
  programa_id: string;
  origem_parceiro_id: string;
  destino_parceiro_id: string;
  destino_programa_id?: string;
  quantidade: number;
  bonus?: number;
  bonus_destino?: number;
  data_recebimento: string;
  bonus_percentual?: number;
  quantidade_bonus?: number;
  data_recebimento_bonus?: string;
  tem_custo?: boolean;
  valor_custo?: number;
  forma_pagamento_id?: string;
  custo_transferencia?: number;
  forma_pagamento?: string;
  conta_bancaria_id?: string;
  cartao_id?: string;
  parcelas?: number;
  data_vencimento_manual?: string;
  observacao?: string;
  status?: string;
  created_at: string;
  origem_parceiro?: { nome_parceiro: string };
  destino_parceiro?: { nome_parceiro: string };
  programa?: { nome: string };
  destino_programa?: { nome: string };
}

export default function TransferenciaPessoas() {
  const { usuario } = useAuth();
  const [transferencias, setTransferencias] = useState<TransferenciaPessoa[]>([]);
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [filtroDestino, setFiltroDestino] = useState('');
  const [filtroPrograma, setFiltroPrograma] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [tiposCompra, setTiposCompra] = useState<TipoCompra[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransferenciaPessoa | null>(null);

  const [programasOrigem, setProgramasOrigem] = useState<EstoquePontos[]>([]);
  const [programasDestino, setProgramasDestino] = useState<ProgramaClube[]>([]);
  const [origemSaldo, setOrigemSaldo] = useState<number | null>(null);
  const [origemCustoMedio, setOrigemCustoMedio] = useState<number | null>(null);
  const [destinoSaldo, setDestinoSaldo] = useState<number | null>(null);
  const [destinoCustoMedio, setDestinoCustoMedio] = useState<number | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<Partial<TransferenciaPessoa>>({
    data_transferencia: today,
    data_recebimento: today,
    quantidade: 0,
    bonus: 0,
    bonus_destino: 0,
    tem_custo: false,
    valor_custo: 0,
    forma_pagamento: undefined,
    forma_pagamento_id: undefined,
    cartao_id: undefined,
    conta_bancaria_id: undefined,
    custo_transferencia: 0,
    data_vencimento_manual: '',
    parcelas: 1,
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
    if (formData.origem_parceiro_id) {
      buscarProgramasOrigem(formData.origem_parceiro_id);
    } else {
      setProgramasOrigem([]);
      setOrigemSaldo(null);
      setOrigemCustoMedio(null);
    }
  }, [formData.origem_parceiro_id]);

  useEffect(() => {
    if (formData.destino_parceiro_id) {
      buscarProgramasDestino(formData.destino_parceiro_id);
    } else {
      setProgramasDestino([]);
      setDestinoSaldo(null);
      setDestinoCustoMedio(null);
    }
  }, [formData.destino_parceiro_id]);

  useEffect(() => {
    if (formData.origem_parceiro_id && formData.programa_id) {
      buscarSaldoOrigem(formData.origem_parceiro_id, formData.programa_id);
    }
  }, [formData.origem_parceiro_id, formData.programa_id]);

  useEffect(() => {
    if (formData.destino_parceiro_id && formData.destino_programa_id) {
      buscarSaldoDestino(formData.destino_parceiro_id, formData.destino_programa_id);
    }
  }, [formData.destino_parceiro_id, formData.destino_programa_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTransferencias(),
        fetchParceiros(),
        fetchTiposCompra(),
        fetchContasBancarias(),
        fetchCartoes(),
        fetchFormasPagamento()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransferencias = async () => {
    const { data, error } = await supabase
      .from('transferencia_pessoas')
      .select(`
        *,
        origem_parceiro:parceiros!transferencia_pessoas_origem_parceiro_id_fkey(nome_parceiro),
        destino_parceiro:parceiros!transferencia_pessoas_destino_parceiro_id_fkey(nome_parceiro),
        programa:programas_fidelidade!transferencia_pessoas_programa_id_fkey(nome),
        destino_programa:programas_fidelidade!transferencia_pessoas_destino_programa_id_fkey(nome)
      `)
      .order('data_transferencia', { ascending: false });

    if (error) {
      console.error('Erro ao buscar transferências:', error);
      return;
    }
    setTransferencias(data || []);
  };

  const fetchParceiros = async () => {
  const { data, error } = await supabase
    .from('parceiros')
    .select('id, nome_parceiro, cpf')
    .order('nome_parceiro');

  if (!error) setParceiros(data || []);
};



  const fetchTiposCompra = async () => {
    const { data, error } = await supabase
      .from('tipos_compra')
      .select('id, nome')
      .order('nome');

    if (error) {
      console.error('Erro ao buscar tipos de compra:', error);
      return;
    }
    setTiposCompra(data || []);
  };

  const fetchContasBancarias = async () => {
    const { data, error } = await supabase
      .from('contas_bancarias')
      .select('id, nome_banco')
      .order('nome_banco');

    if (error) {
      console.error('Erro ao buscar contas bancárias:', error);
      return;
    }
    setContasBancarias(data || []);
  };

  const fetchCartoes = async () => {
    const { data, error } = await supabase
      .from('cartoes_credito')
      .select('id, cartao, dia_vencimento, dia_fechamento')
      .order('cartao');

    if (error) {
      console.error('Erro ao buscar cartões:', error);
      return;
    }
    setCartoes(data || []);
  };

  const fetchFormasPagamento = async () => {
    const { data, error } = await supabase
      .from('formas_pagamento')
      .select('id, nome, ativo')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) {
      console.error('Erro ao buscar formas de pagamento:', error);
      return;
    }
    setFormasPagamento(data || []);
  };

  const buscarProgramasOrigem = async (parceiroId: string) => {
    const { data, error } = await supabase
      .from('estoque_pontos')
      .select(`
        programa_id,
        saldo_atual,
        custo_medio,
        programas_fidelidade(id, nome)
      `)
      .eq('parceiro_id', parceiroId)
      .gt('saldo_atual', 0)
      .order('programas_fidelidade(nome)');

    if (error) {
      console.error('Erro ao buscar programas de origem:', error);
      setProgramasOrigem([]);
      return;
    }
    setProgramasOrigem(data || []);
  };

  const buscarProgramasDestino = async (parceiroId: string) => {
    const { data: estoqueProgramas, error: estoqueError } = await supabase
      .from('estoque_pontos')
      .select(`
        programa_id,
        programas_fidelidade(id, nome)
      `)
      .eq('parceiro_id', parceiroId)
      .order('programas_fidelidade(nome)');

    if (estoqueError) {
      console.error('Erro ao buscar programas de destino do estoque:', estoqueError);
    }

    const { data: clubesProgramas, error: clubesError } = await supabase
      .from('programas_clubes')
      .select(`
        programa_id,
        programas_fidelidade(id, nome)
      `)
      .eq('parceiro_id', parceiroId)
      .order('programas_fidelidade(nome)');

    if (clubesError) {
      console.error('Erro ao buscar programas de destino dos clubes:', clubesError);
    }

    const programasMap = new Map();

    [...(estoqueProgramas || []), ...(clubesProgramas || [])].forEach((item: any) => {
      if (item.programas_fidelidade && !programasMap.has(item.programa_id)) {
        programasMap.set(item.programa_id, {
          id: item.programa_id,
          programa_id: item.programa_id,
          programas_fidelidade: item.programas_fidelidade
        });
      }
    });

    const programasUnicos = Array.from(programasMap.values());
    setProgramasDestino(programasUnicos as ProgramaClube[]);
  };

  const buscarSaldoOrigem = async (parceiroId: string, programaId: string) => {
    const { data, error } = await supabase
      .from('estoque_pontos')
      .select('saldo_atual, custo_medio')
      .eq('parceiro_id', parceiroId)
      .eq('programa_id', programaId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar saldo origem:', error);
      setOrigemSaldo(null);
      setOrigemCustoMedio(null);
      return;
    }

    if (data) {
      setOrigemSaldo(Number(data.saldo_atual) || 0);
      setOrigemCustoMedio(Number(data.custo_medio) || 0);
    } else {
      setOrigemSaldo(0);
      setOrigemCustoMedio(0);
    }
  };

  const buscarSaldoDestino = async (parceiroId: string, programaId: string) => {
    const { data, error } = await supabase
      .from('estoque_pontos')
      .select('saldo_atual, custo_medio')
      .eq('parceiro_id', parceiroId)
      .eq('programa_id', programaId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar saldo destino:', error);
      setDestinoSaldo(null);
      setDestinoCustoMedio(null);
      return;
    }

    if (data) {
      setDestinoSaldo(Number(data.saldo_atual) || 0);
      setDestinoCustoMedio(Number(data.custo_medio) || 0);
    } else {
      setDestinoSaldo(0);
      setDestinoCustoMedio(0);
    }
  };

  const parseDecimalInput = (value: string): number => {
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    const numValue = parseFloat(cleanValue) || 0;
    return numValue;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.programa_id || !formData.origem_parceiro_id || !formData.destino_parceiro_id || !formData.destino_programa_id) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Campos Obrigatórios',
        message: 'Por favor, preencha todos os campos obrigatórios.'
      });
      return;
    }

    if (formData.origem_parceiro_id === formData.destino_parceiro_id) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiros Iguais',
        message: 'Não é possível transferir pontos para o mesmo parceiro. Selecione parceiros diferentes para origem e destino.'
      });
      return;
    }

    const [{ data: estoqueOrigem }, { data: clubeDestino }] = await Promise.all([
      supabase
        .from('estoque_pontos')
        .select('id')
        .eq('parceiro_id', formData.origem_parceiro_id)
        .eq('programa_id', formData.programa_id)
        .maybeSingle(),
      supabase
        .from('programas_clubes')
        .select('id')
        .eq('parceiro_id', formData.destino_parceiro_id)
        .eq('programa_id', formData.destino_programa_id)
        .maybeSingle()
    ]);

    if (!estoqueOrigem) {
      const { data: parceiroData } = await supabase.from('parceiros').select('nome_parceiro').eq('id', formData.origem_parceiro_id).maybeSingle();
      const programaNome = programasOrigem.find((p: any) => p.programa_id === formData.programa_id)?.programas_fidelidade?.nome || 'selecionado';
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiro origem sem conta no programa',
        message: `${parceiroData?.nome_parceiro || 'O parceiro de origem'} não possui conta cadastrada no programa ${programaNome}.\n\nRegistre uma movimentação para este parceiro neste programa antes de realizar a transferência.`
      });
      return;
    }

    if (!clubeDestino) {
      const { data: parceiroData } = await supabase.from('parceiros').select('nome_parceiro').eq('id', formData.destino_parceiro_id).maybeSingle();
      const programaNome = programasDestino.find((p: any) => p.programa_id === formData.destino_programa_id)?.programas_fidelidade?.nome || 'selecionado';
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiro destino sem conta no programa',
        message: `${parceiroData?.nome_parceiro || 'O parceiro de destino'} não possui conta cadastrada no programa ${programaNome}.\n\nRegistre uma movimentação para este parceiro neste programa antes de realizar a transferência.`
      });
      return;
    }

    if (formData.programa_id !== formData.destino_programa_id) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Programas Diferentes',
        message: 'Só é possível transferir pontos entre o mesmo programa. Selecione o mesmo programa para origem e destino.'
      });
      return;
    }

    const quantidade = Number(formData.quantidade) || 0;
    const bonusDestino = Number(formData.bonus_destino) || 0;
    const totalEnviar = quantidade + bonusDestino;
    const saldoOrigem = origemSaldo || 0;

    if (quantidade <= 0) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Quantidade Inválida',
        message: 'A quantidade deve ser maior que zero.'
      });
      return;
    }

    if (saldoOrigem <= 0) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Sem Pontos Disponíveis',
        message: 'Não há pontos disponíveis para realizar a transferência.'
      });
      return;
    }

    if (totalEnviar > saldoOrigem) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Saldo Insuficiente',
        message: `Saldo insuficiente. Disponível: ${saldoOrigem.toLocaleString('pt-BR')}, necessário: ${totalEnviar.toLocaleString('pt-BR')} (${quantidade.toLocaleString('pt-BR')} + ${bonusDestino.toLocaleString('pt-BR')} bônus)`
      });
      return;
    }

    if (formData.tem_custo) {
      if (!formData.valor_custo || formData.valor_custo <= 0) {
        setDialogConfig({
          isOpen: true,
          type: 'warning',
          title: 'Custo Inválido',
          message: 'Se a transferência tem custo, o valor deve ser maior que zero.'
        });
        return;
      }

      if (!formData.forma_pagamento) {
        setDialogConfig({
          isOpen: true,
          type: 'warning',
          title: 'Forma de Pagamento Obrigatória',
          message: 'Por favor, selecione a forma de pagamento.'
        });
        return;
      }

      if (formData.forma_pagamento !== 'Não registrar no fluxo de caixa') {
        if ((formData.forma_pagamento === 'Crédito' || formData.forma_pagamento === 'Débito') && !formData.cartao_id) {
          setDialogConfig({
            isOpen: true,
            type: 'warning',
            title: 'Cartão Obrigatório',
            message: 'Por favor, selecione o cartão para pagamento.'
          });
          return;
        }

        if (formData.forma_pagamento !== 'Crédito' && formData.forma_pagamento !== 'Débito' && !formData.conta_bancaria_id) {
          setDialogConfig({
            isOpen: true,
            type: 'warning',
            title: 'Banco Emissor Obrigatório',
            message: 'Por favor, selecione o banco emissor.'
          });
          return;
        }
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
    }

    try {
      const dataToSave: any = {
        ...formData,
        created_by: usuario?.id,
        data_vencimento_manual: formData.data_vencimento_manual || null
      };

      if (!dataToSave.tem_custo) {
        delete dataToSave.valor_custo;
        delete dataToSave.forma_pagamento_id;
        delete dataToSave.forma_pagamento;
        delete dataToSave.cartao_id;
        delete dataToSave.conta_bancaria_id;
        delete dataToSave.parcelas;
      } else {
        if (dataToSave.forma_pagamento !== 'Crédito' && dataToSave.forma_pagamento !== 'Débito') {
          delete dataToSave.cartao_id;
          delete dataToSave.parcelas;
        }
        if (dataToSave.forma_pagamento === 'Crédito' || dataToSave.forma_pagamento === 'Débito') {
          delete dataToSave.conta_bancaria_id;
        }
        if (dataToSave.forma_pagamento !== 'Crédito') {
          delete dataToSave.parcelas;
        }
      }

      const { error } = await supabase
        .from('transferencia_pessoas')
        .insert([dataToSave]);

      if (error) throw error;

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'Transferência realizada com sucesso!'
      });

      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: error.message || 'Erro ao salvar transferência.'
      });
    }
  };

  const handleDelete = (id: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir esta transferência?',
      onConfirm: () => confirmDelete(id)
    });
  };

  const confirmDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transferencia_pessoas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'Transferência excluída com sucesso!'
      });
      fetchData();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: error.message || 'Erro ao excluir transferência.'
      });
    }
  };

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      data_transferencia: today,
      data_recebimento: today,
      quantidade: 0,
      bonus: 0,
      bonus_destino: 0,
      tem_custo: false,
      valor_custo: 0,
      forma_pagamento: undefined,
      forma_pagamento_id: undefined,
      cartao_id: undefined,
      conta_bancaria_id: undefined,
      custo_transferencia: 0,
      parcelas: 1,
    });
    setProgramasOrigem([]);
    setProgramasDestino([]);
    setOrigemSaldo(null);
    setOrigemCustoMedio(null);
    setDestinoSaldo(null);
    setDestinoCustoMedio(null);
  };

  const transferenciasFiltradas = transferencias.filter(t =>
    (!filtroOrigem || (t.origem_parceiro?.nome_parceiro || '').toLowerCase().includes(filtroOrigem.toLowerCase())) &&
    (!filtroDestino || (t.destino_parceiro?.nome_parceiro || '').toLowerCase().includes(filtroDestino.toLowerCase())) &&
    (!filtroPrograma || (t.programa?.nome || '').toLowerCase().includes(filtroPrograma.toLowerCase())) &&
    (!filtroStatus || (t.status || 'Pendente') === filtroStatus)
  );

  const origensUnicas = Array.from(new Set(transferencias.map(t => t.origem_parceiro?.nome_parceiro).filter(Boolean))).sort() as string[];
  const destinosUnicos = Array.from(new Set(transferencias.map(t => t.destino_parceiro?.nome_parceiro).filter(Boolean))).sort() as string[];
  const programasUnicos = Array.from(new Set(transferencias.map(t => t.programa?.nome).filter(Boolean))).sort() as string[];
  const statusUnicos = Array.from(new Set(transferencias.map(t => t.status || 'Pendente'))).sort();

  if (loading) {
    return <div className="flex justify-center items-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Users className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Transferência entre Pessoas</h1>
            <p className="text-sm text-slate-600">Gerencie as transferências entre pessoas</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Transferência
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <FilterBar
            filters={[
              { label: 'Origem', options: origensUnicas, value: filtroOrigem, onChange: setFiltroOrigem },
              { label: 'Destino', options: destinosUnicos, value: filtroDestino, onChange: setFiltroDestino },
              { label: 'Programa', options: programasUnicos, value: filtroPrograma, onChange: setFiltroPrograma },
              { label: 'Status', options: statusUnicos, value: filtroStatus, onChange: setFiltroStatus },
            ]}
            onClear={() => { setFiltroOrigem(''); setFiltroDestino(''); setFiltroPrograma(''); setFiltroStatus(''); }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Programa Origem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">De (Origem)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Para (Destino)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Programa Destino</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Quantidade</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Custo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transferenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma transferência cadastrada
                  </td>
                </tr>
              ) : (
                transferenciasFiltradas.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {formatDate(item.data_transferencia)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {item.programa?.nome || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {item.origem_parceiro?.nome_parceiro || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {item.destino_parceiro?.nome_parceiro || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {item.destino_programa?.nome || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'Concluído'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status || 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">
                      {item.quantidade.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">
                      {item.tem_custo && item.valor_custo ? formatCurrency(Number(item.valor_custo)) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Excluir"
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        title="Nova Transferência"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-6">Origem</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Parceiro <span className="text-red-500">*</span>
                </label>
                <ParceiroSearch
                  parceiros={parceiros}
                  value={formData.origem_parceiro_id || ''}
                  onChange={(parceiroId) => {
                    setFormData({
                      ...formData,
                      origem_parceiro_id: parceiroId,
                      programa_id: ''
                    });
                  }}
                  placeholder="Digite para buscar parceiro..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Programa <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.programa_id || ''}
                  onChange={(e) => setFormData({ ...formData, programa_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  disabled={!formData.origem_parceiro_id || programasOrigem.length === 0}
                >
                  <option value="">Selecione</option>
                  {programasOrigem.map((p) => (
                    <option key={p.programa_id} value={p.programa_id}>
                      {p.programas_fidelidade.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {origemSaldo !== null && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Atual</label>
                  <p className="text-lg font-semibold text-slate-900">{origemSaldo.toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custo Médio</label>
                  <p className="text-lg font-semibold text-slate-900">{formatCurrency(origemCustoMedio || 0)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-700 mb-6">Destino</h3>

            {formData.origem_parceiro_id && formData.destino_parceiro_id && formData.origem_parceiro_id === formData.destino_parceiro_id && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                <Info className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  <strong>Atenção:</strong> Não é possível transferir pontos para o mesmo parceiro. Selecione parceiros diferentes.
                </p>
              </div>
            )}

            {origemSaldo !== null && origemSaldo <= 0 && formData.origem_parceiro_id && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                <Info className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  <strong>Atenção:</strong> Não há pontos disponíveis para transferência.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Parceiro <span className="text-red-500">*</span>
                </label>
                <ParceiroSearch
                  parceiros={parceiros}
                  value={formData.destino_parceiro_id || ''}
                  onChange={(parceiroId) => {
                    setFormData({
                      ...formData,
                      destino_parceiro_id: parceiroId,
                      destino_programa_id: ''
                    });
                  }}
                  placeholder="Digite para buscar parceiro..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Programa <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.destino_programa_id || ''}
                  onChange={(e) => setFormData({ ...formData, destino_programa_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  disabled={!formData.destino_parceiro_id || programasDestino.length === 0}
                >
                  <option value="">Selecione</option>
                  {programasDestino
                    .filter((p) => p.programa_id === formData.programa_id)
                    .map((p) => (
                      <option key={p.programa_id} value={p.programa_id}>
                        {p.programas_fidelidade.nome}
                      </option>
                    ))}
                </select>
              </div>

              {destinoSaldo !== null && (
                <>
                  <div className="bg-white rounded-lg p-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Atual (Destino)</label>
                    <p className="text-lg font-semibold text-slate-900">{destinoSaldo.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Custo Médio (Destino)</label>
                    <p className="text-lg font-semibold text-slate-900">{formatCurrency(destinoCustoMedio || 0)}</p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data da Transferência <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.data_transferencia || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    data_transferencia: e.target.value,
                    data_recebimento: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantidade a ser Transferida <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.quantidade ? formData.quantidade.toLocaleString('pt-BR') : '0'}
                  onChange={(e) => {
                    const value = parseDecimalInput(e.target.value);
                    setFormData({ ...formData, quantidade: value });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  disabled={!formData.programa_id || !formData.destino_programa_id}
                />
                {origemSaldo !== null && (formData.quantidade ?? 0) > 0 && ((formData.quantidade ?? 0) + (formData.bonus_destino ?? 0)) > (origemSaldo ?? 0) && (
                  <p className="text-xs text-red-600 mt-1">Saldo insuficiente na origem (disponível: {origemSaldo.toLocaleString('pt-BR')}, necessário: {((formData.quantidade ?? 0) + (formData.bonus_destino ?? 0)).toLocaleString('pt-BR')})</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Bônus a Enviar
                </label>
                <input
                  type="text"
                  value={formData.bonus_destino ? formData.bonus_destino.toLocaleString('pt-BR') : '0'}
                  onChange={(e) => {
                    const value = parseDecimalInput(e.target.value);
                    setFormData({ ...formData, bonus_destino: value });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="0"
                  disabled={!formData.programa_id || !formData.destino_programa_id}
                />
                {origemSaldo !== null && (formData.bonus_destino ?? 0) > 0 && ((formData.quantidade ?? 0) + (formData.bonus_destino ?? 0)) > (origemSaldo ?? 0) && (
                  <p className="text-xs text-red-600 mt-1">Total (quantidade + bônus) excede o saldo disponível</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-6">Pagamento</h3>

            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.tem_custo || false}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      tem_custo: e.target.checked,
                      valor_custo: e.target.checked ? formData.valor_custo : 0,
                      forma_pagamento_id: e.target.checked ? formData.forma_pagamento_id : undefined
                    });
                  }}
                  className="w-5 h-5 text-sky-600 border-slate-300 rounded focus:ring-2 focus:ring-sky-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Esta transferência tem custo financeiro
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Marque se houver custo para realizar a transferência (quem recebe paga)
                  </p>
                </div>
              </label>
            </div>

            {formData.tem_custo && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Custo da Transferência <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required={formData.tem_custo}
                        value={formData.valor_custo || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setFormData({ ...formData, valor_custo: value });
                        }}
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Este valor será adicionado ao custo médio de quem recebe
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Forma de Pagamento <span className="text-red-500">*</span>
                    </label>
                    <select
                      required={formData.tem_custo}
                      value={formData.forma_pagamento || ''}
                      onChange={(e) => {
                        const forma = e.target.value;
                        const formaObj = formasPagamento.find(f => f.nome === forma);
                        setFormData({
                          ...formData,
                          forma_pagamento: forma,
                          forma_pagamento_id: formaObj?.id,
                          cartao_id: undefined,
                          conta_bancaria_id: undefined,
                          parcelas: forma === 'Crédito' ? (formData.parcelas || 1) : 1
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">Selecione</option>
                      {formasPagamento.map((forma) => (
                        <option key={forma.id} value={forma.nome}>{forma.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.forma_pagamento !== 'Não registrar no fluxo de caixa' && (
                  <>
                    {(formData.forma_pagamento === 'Crédito' || formData.forma_pagamento === 'Débito') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Cartão <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={formData.cartao_id || ''}
                            onChange={(e) => setFormData({ ...formData, cartao_id: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="">Selecione</option>
                            {cartoes.map((c) => (
                              <option key={c.id} value={c.id}>{c.cartao}</option>
                            ))}
                          </select>
                        </div>

                        {formData.forma_pagamento === 'Crédito' && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Parcelas
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formData.parcelas || 1}
                              onChange={(e) => setFormData({ ...formData, parcelas: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {formData.forma_pagamento &&
                     formData.forma_pagamento !== 'Crédito' &&
                     formData.forma_pagamento !== 'Débito' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Banco Emissor <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={formData.conta_bancaria_id || ''}
                            onChange={(e) => setFormData({ ...formData, conta_bancaria_id: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="">Selecione</option>
                            {contasBancarias.map((c) => (
                              <option key={c.id} value={c.id}>{c.nome_banco}</option>
                            ))}
                          </select>
                        </div>
                      </div>
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
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          required
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              value={formData.observacao || ''}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Observações adicionais..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                formData.origem_parceiro_id === formData.destino_parceiro_id ||
                (origemSaldo !== null && origemSaldo <= 0)
              }
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {editingItem ? 'Atualizar' : 'Transferir'}
            </button>
          </div>
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
