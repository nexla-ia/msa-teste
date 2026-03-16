import { useState, useEffect } from 'react';
import { ArrowRightLeft, Plus, Pencil, Trash2, Info } from 'lucide-react';
import { FilterBar } from '../components/FilterCombobox';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ParceiroSearch from '../components/ParceiroSearch';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, formatNumberDisplay } from '../lib/formatters';

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
  parceiro_id: string;
  programa_id: string;
  quantidade_pontos: number;
  programas_fidelidade?: {
    nome: string;
  };
}

interface Transferencia {
  id: string;
  parceiro_id: string;
  data_transferencia: string;
  origem_programa_id: string;
  origem_quantidade: number;
  origem_paridade: number;
  realizar_compra_carrinho: boolean;
  realizar_retorno_bumerangue: boolean;
  compra_quantidade?: number;
  compra_valor_total?: number;
  compra_valor_milheiro?: number;
  compra_custo_medio_final?: number;
  compra_forma_pagamento?: string;
  compra_conta?: string;
  compra_parcelas?: number;
  compra_cartao_id?: string;
  compra_conta_bancaria_id?: string;
  bumerangue_bonus_percentual?: number;
  bumerangue_quantidade_bonus?: number;
  bumerangue_data_recebimento?: string;
  destino_programa_id: string;
  destino_quantidade: number;
  destino_data_recebimento: string;
  destino_bonus_percentual?: number;
  destino_quantidade_bonus?: number;
  destino_data_recebimento_bonus?: string;
  observacao?: string;
  created_at: string;
  custo_transferencia?: number;
  forma_pagamento_transferencia?: string;
  cartao_id?: string;
  conta_bancaria_id?: string;
  compra_data_vencimento_manual?: string;
  taxa_data_vencimento_manual?: string;
}

interface Cartao {
  id: string;
  cartao: string;
  banco_emissor?: string;
  tipo_cartao?: string;
  dia_vencimento?: number;
  dia_fechamento?: number;
}

interface ContaBancaria {
  id: string;
  nome_banco: string;
  numero_conta?: string;
  agencia?: string;
  codigo_banco?: string;
}


interface FormaPagamento {
  id: string;
  nome: string;
  ativo: boolean;
}

export default function TransferenciaPontos() {
  const { usuario } = useAuth();
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [filtroDestino, setFiltroDestino] = useState('');
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [programasOrigem, setProgramasOrigem] = useState<ProgramaClube[]>([]);
  const [programasDestino, setProgramasDestino] = useState<ProgramaClube[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Transferencia | null>(null);

  const [origemSaldo, setOrigemSaldo] = useState<number | null>(null);
  const [origemCustoMedio, setOrigemCustoMedio] = useState<number | null>(null);
  const [origemProgramaClubeId, setOrigemProgramaClubeId] = useState<string | null>(null);
  const [destinoProgramaClubeId, setDestinoProgramaClubeId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Transferencia>>({
    data_transferencia: new Date().toISOString().split('T')[0],
    origem_paridade: 1,
    realizar_compra_carrinho: false,
    realizar_retorno_bumerangue: false,
    compra_parcelas: 1,
    destino_data_recebimento: new Date().toISOString().split('T')[0],
    bumerangue_bonus_percentual: 0,
    origem_quantidade: 0,
    destino_quantidade: 0,
    destino_quantidade_bonus: 0,
    compra_data_vencimento_manual: '',
    taxa_data_vencimento_manual: '',
  });

  const [temPagamento, setTemPagamento] = useState(false);

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
    if (formData.parceiro_id) {
      buscarProgramasParceiro(formData.parceiro_id);
    } else {
      setProgramasOrigem([]);
      setProgramasDestino([]);
      setOrigemSaldo(null);
      setOrigemCustoMedio(null);
    }
  }, [formData.parceiro_id]);

  useEffect(() => {
    if (formData.origem_programa_id && formData.parceiro_id) {
      buscarSaldoOrigem(formData.parceiro_id, formData.origem_programa_id);
    }
  }, [formData.origem_programa_id, formData.parceiro_id]);

  useEffect(() => {
    if (formData.destino_programa_id && formData.parceiro_id) {
      buscarProgramaClubeDestino(formData.parceiro_id, formData.destino_programa_id);
    }
  }, [formData.destino_programa_id, formData.parceiro_id]);




  useEffect(() => {
    if (formData.bumerangue_bonus_percentual) {
      calcularBumerangueBonus();
    }
  }, [formData.origem_quantidade, formData.bumerangue_bonus_percentual]);

  useEffect(() => {
    const destQtd = Number(formData.destino_quantidade) || 0;
    const paridade = Number(formData.origem_paridade) || 1;
    const origemQtd = destQtd / paridade;
    if (origemQtd !== formData.origem_quantidade) {
      setFormData(prev => ({ ...prev, origem_quantidade: origemQtd }));
    }
  }, [formData.destino_quantidade, formData.origem_paridade, formData.origem_quantidade]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [parceirosRes, transferenciasRes, programasRes, cartoesRes, contasRes, formasPagRes] = await Promise.all([
        supabase.from('parceiros').select('id, nome_parceiro, cpf').order('nome_parceiro'),
        supabase
          .from('transferencia_pontos')
          .select('*')
          .order('data_transferencia', { ascending: false }),
        supabase
          .from('programas_fidelidade')
          .select('id, nome')
          .order('nome'),
        supabase
          .from('cartoes_credito')
          .select('id, cartao, banco_emissor, bandeira, tipo_cartao, dia_vencimento, dia_fechamento')
          .eq('status', 'ativo')
          .order('cartao'),
        supabase
          .from('contas_bancarias')
          .select('id, nome_banco, numero_conta, agencia, codigo_banco')
          .order('nome_banco'),
        supabase
          .from('formas_pagamento')
          .select('id, nome, ativo')
          .eq('ativo', true)
          .order('ordem', { ascending: true })
      ]);

      if (parceirosRes.data) setParceiros(parceirosRes.data);

      if (transferenciasRes.data) setTransferencias(transferenciasRes.data);
      if (programasRes.data) setProgramas(programasRes.data);
      if (cartoesRes.data) setCartoes(cartoesRes.data);
      if (contasRes.data) setContasBancarias(contasRes.data);
      if (formasPagRes.data) setFormasPagamento(formasPagRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarProgramasParceiro = async (parceiroId: string) => {
    try {
      const [programasOrigemResult, programasDestinoResult] = await Promise.all([
        supabase
          .from('estoque_pontos')
          .select(`
            programa_id,
            saldo_atual,
            programas_fidelidade:programa_id (
              id,
              nome
            )
          `)
          .eq('parceiro_id', parceiroId)
          .gt('saldo_atual', 0),
        supabase
          .from('programas_clubes')
          .select(`
            id,
            parceiro_id,
            programa_id,
            quantidade_pontos,
            programas_fidelidade:programa_id (
              id,
              nome
            )
          `)
          .eq('parceiro_id', parceiroId)
      ]);

      if (programasOrigemResult.data) {
        const programasComSaldo = programasOrigemResult.data.map((item: any) => ({
          id: item.programa_id,
          parceiro_id: parceiroId,
          programa_id: item.programa_id,
          quantidade_pontos: item.saldo_atual,
          programas_fidelidade: item.programas_fidelidade
        }));
        setProgramasOrigem(programasComSaldo);
      } else {
        setProgramasOrigem([]);
      }

      if (programasDestinoResult.data) {
        setProgramasDestino(programasDestinoResult.data as any);
      } else {
        setProgramasDestino([]);
      }
    } catch (error) {
      console.error('Erro ao buscar programas do parceiro:', error);
      setProgramasOrigem([]);
      setProgramasDestino([]);
    }
  };

  const buscarSaldoOrigem = async (parceiroId: string, programaId: string) => {
    try {
      const [estoqueData, programaClubeData] = await Promise.all([
        supabase
          .from('estoque_pontos')
          .select('saldo_atual, custo_medio')
          .eq('parceiro_id', parceiroId)
          .eq('programa_id', programaId)
          .maybeSingle(),
        supabase
          .from('programas_clubes')
          .select('id')
          .eq('parceiro_id', parceiroId)
          .eq('programa_id', programaId)
          .maybeSingle()
      ]);

      if (estoqueData.data) {
        setOrigemSaldo(Number(estoqueData.data.saldo_atual) || 0);
        setOrigemCustoMedio(Number(estoqueData.data.custo_medio) || 0);
      } else {
        setOrigemSaldo(0);
        setOrigemCustoMedio(0);
      }

      if (programaClubeData.data) {
        setOrigemProgramaClubeId(programaClubeData.data.id);
      } else {
        setOrigemProgramaClubeId(null);
      }
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
      setOrigemSaldo(0);
      setOrigemProgramaClubeId(null);
      setOrigemCustoMedio(0);
    }
  };

  const buscarProgramaClubeDestino = async (parceiroId: string, programaId: string) => {
    try {
      const { data, error } = await supabase
        .from('programas_clubes')
        .select('id')
        .eq('parceiro_id', parceiroId)
        .eq('programa_id', programaId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDestinoProgramaClubeId(data.id);
      } else {
        setDestinoProgramaClubeId(null);
      }
    } catch (error) {
      console.error('Erro ao buscar programa clube destino:', error);
      setDestinoProgramaClubeId(null);
    }
  };



  const calcularBumerangueBonus = () => {
    const origemQtd = Number(formData.origem_quantidade) || 0;
    const bonusPerc = Number(formData.bumerangue_bonus_percentual) || 0;
    const bonusQtd = (origemQtd * bonusPerc) / 100;
    setFormData(prev => ({ ...prev, bumerangue_quantidade_bonus: Number(bonusQtd.toFixed(2)) }));
  };

  const formatDecimalInput = (value: string, decimals: number = 2): string => {
    const numValue = parseFloat(value) / Math.pow(10, decimals);
    return numValue.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const parseDecimalInput = (value: string, decimals: number = 2): number => {
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    const numValue = parseFloat(cleanValue) || 0;
    return numValue;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.parceiro_id || !formData.origem_programa_id || !formData.destino_programa_id) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Campos Obrigatórios',
        message: 'Por favor, preencha todos os campos obrigatórios.'
      });
      return;
    }

    if (!origemProgramaClubeId || !destinoProgramaClubeId) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Parceiro não está vinculado aos programas selecionados.'
      });
      return;
    }

    if (formData.origem_programa_id === formData.destino_programa_id) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Programas Iguais',
        message: 'Não é possível transferir pontos para o mesmo programa. Selecione programas diferentes para origem e destino.'
      });
      return;
    }

    const quantidadeOrigem = Number(formData.origem_quantidade) || 0;
    const saldoOrigem = origemSaldo || 0;
    const compraQuantidade = Number(formData.compra_quantidade) || 0;
    const saldoAposCompra = saldoOrigem + compraQuantidade;

    if (!formData.realizar_compra_carrinho && saldoOrigem <= 0) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Sem Pontos Disponíveis',
        message: 'Não há pontos disponíveis no programa de origem para realizar a transferência.'
      });
      return;
    }

    if (!formData.realizar_compra_carrinho && quantidadeOrigem > saldoOrigem) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Saldo Insuficiente',
        message: `Saldo insuficiente no programa de origem. Disponível: ${saldoOrigem.toLocaleString('pt-BR')}`
      });
      return;
    }

    if (formData.realizar_compra_carrinho) {
      if (!formData.compra_quantidade || formData.compra_quantidade <= 0) {
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Quantidade Inválida',
          message: 'Informe a quantidade de pontos a ser comprada.'
        });
        return;
      }

      if (!formData.compra_valor_total || formData.compra_valor_total <= 0) {
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Valor Inválido',
          message: 'Informe o valor total da compra.'
        });
        return;
      }

      if (formData.compra_forma_pagamento && formData.compra_forma_pagamento !== 'Não registrar no fluxo de caixa') {
        if ((formData.compra_forma_pagamento === 'Crédito' || formData.compra_forma_pagamento === 'Débito') && !formData.compra_cartao_id) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Cartão não selecionado',
            message: 'Selecione o cartão para realizar o pagamento da compra.'
          });
          return;
        }

        if ((formData.compra_forma_pagamento === 'PIX' || formData.compra_forma_pagamento === 'Dinheiro' || formData.compra_forma_pagamento === 'Transferência') && !formData.compra_conta_bancaria_id) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Banco Emissor não selecionado',
            message: 'Selecione o banco emissor para realizar o pagamento.'
          });
          return;
        }

        if (formData.compra_forma_pagamento === 'Dinheiro' && !formData.compra_data_vencimento_manual) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Data de Vencimento Obrigatória',
            message: 'Informe a data de vencimento para pagamento em dinheiro da compra.'
          });
          return;
        }
      }

      if (quantidadeOrigem > saldoAposCompra) {
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Saldo Insuficiente',
          message: `Mesmo com a compra de ${compraQuantidade.toLocaleString('pt-BR')} pontos, o saldo não será suficiente. Saldo final: ${saldoAposCompra.toLocaleString('pt-BR')}, necessário: ${quantidadeOrigem.toLocaleString('pt-BR')}`
        });
        return;
      }
    }

    // Validar data de vencimento para taxa em dinheiro
    if (formData.forma_pagamento_transferencia === 'Dinheiro' && !formData.taxa_data_vencimento_manual) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Data de Vencimento Obrigatória',
        message: 'Informe a data de vencimento para pagamento da taxa em dinheiro.'
      });
      return;
    }

    try {
      if (formData.realizar_compra_carrinho && !editingItem) {
        const compraData: any = {
          parceiro_id: formData.parceiro_id,
          programa_id: formData.origem_programa_id,
          tipo: 'Compra de Pontos/Milhas',
          data_entrada: formData.data_transferencia,
          pontos_milhas: formData.compra_quantidade,
          bonus: 0,
          valor_total: formData.compra_valor_total,
          valor_milheiro: formData.compra_valor_milheiro,
          forma_pagamento: formData.compra_forma_pagamento || 'Não informado',
          quantidade_parcelas: formData.compra_parcelas || 1,
          observacao: `Compra para transferência${formData.compra_conta ? ' - ' + formData.compra_conta : ''}`,
          status: 'Concluído',
          created_by: usuario?.id
        };

        if (formData.compra_cartao_id && formData.compra_cartao_id !== '') {
          compraData.cartao_id = formData.compra_cartao_id;
        }

        if (formData.compra_conta_bancaria_id && formData.compra_conta_bancaria_id !== '') {
          compraData.conta_bancaria_id = formData.compra_conta_bancaria_id;
        }

        const { error: compraError } = await supabase
          .from('compras')
          .insert([compraData]);

        if (compraError) {
          throw new Error(`Erro ao criar compra: ${compraError.message}`);
        }
      }

      const dataToSave: any = {
        ...formData,
        created_by: usuario?.id,
        updated_at: new Date().toISOString(),
        compra_data_vencimento_manual: formData.compra_data_vencimento_manual || null,
        taxa_data_vencimento_manual: formData.taxa_data_vencimento_manual || null
      };

      // Bônus destino usa a mesma data de recebimento das milhas
      if (dataToSave.destino_quantidade_bonus && dataToSave.destino_quantidade_bonus > 0) {
        dataToSave.destino_data_recebimento_bonus = dataToSave.destino_data_recebimento;
      }

      delete dataToSave.compra_quantidade;
      delete dataToSave.compra_valor_total;
      delete dataToSave.compra_valor_milheiro;
      delete dataToSave.compra_custo_medio_final;
      delete dataToSave.compra_forma_pagamento;
      delete dataToSave.compra_conta;
      delete dataToSave.compra_parcelas;
      delete dataToSave.compra_cartao_id;
      delete dataToSave.compra_conta_bancaria_id;

      if (!dataToSave.cartao_id) {
        delete dataToSave.cartao_id;
      }
      if (!dataToSave.conta_bancaria_id) {
        delete dataToSave.conta_bancaria_id;
      }
      if (!dataToSave.forma_pagamento_transferencia || dataToSave.forma_pagamento_transferencia === 'Não registrar no fluxo de caixa') {
        delete dataToSave.cartao_id;
        delete dataToSave.conta_bancaria_id;
        delete dataToSave.forma_pagamento_transferencia;
      }

      if (editingItem) {
        const { error } = await supabase
          .from('transferencia_pontos')
          .update(dataToSave)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error: insertError } = await supabase
          .from('transferencia_pontos')
          .insert([dataToSave]);
        if (insertError) throw insertError;

        // Os triggers do banco cuidarão de:
        // 1. Debitar origem imediatamente
        // 2. Creditar destino baseado no status (hoje = imediato, futuro = pendente)
        // 3. Creditar bônus baseado nas datas
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({
        data_transferencia: new Date().toISOString().split('T')[0],
        origem_paridade: 1,
        realizar_compra_carrinho: false,
        realizar_retorno_bumerangue: false,
        compra_parcelas: 1,
        destino_data_recebimento: new Date().toISOString().split('T')[0],
        bumerangue_bonus_percentual: 0,
        origem_quantidade: 0,
        destino_quantidade: 0,
        destino_quantidade_bonus: 0,
      });
      setTemPagamento(false);
      setOrigemSaldo(null);
      setOrigemCustoMedio(null);
      setOrigemProgramaClubeId(null);
      setDestinoProgramaClubeId(null);
      setProgramasOrigem([]);
      setProgramasDestino([]);
      fetchData();

      const mensagemSucesso = editingItem
        ? 'Transferência atualizada com sucesso!'
        : formData.realizar_compra_carrinho
          ? `Compra de ${formData.compra_quantidade?.toLocaleString('pt-BR')} pontos e transferência criadas com sucesso!`
          : 'Transferência criada com sucesso!';

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: mensagemSucesso
      });
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

  const handleEdit = (item: Transferencia) => {
    setEditingItem(item);
    setFormData(item);
    setTemPagamento(!!(item.custo_transferencia && item.custo_transferencia > 0));
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir esta transferência?',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('transferencia_pontos')
            .delete()
            .eq('id', id);

          if (error) throw error;

          fetchData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Transferência excluída com sucesso!'
          });
        } catch (error: any) {
          console.error('Erro ao excluir:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: error.message || 'Erro ao excluir transferência.'
          });
        }
      }
    });
  };

  const getParceiroNome = (id?: string) => {
    return parceiros.find(p => p.id === id)?.nome_parceiro || '-';
  };

  const getProgramaNome = (id?: string) => {
    return programas.find(p => p.id === id)?.nome || '-';
  };

  const transferenciasFiltradas = transferencias.filter(t =>
    (!filtroParceiro || getParceiroNome(t.parceiro_id).toLowerCase().includes(filtroParceiro.toLowerCase())) &&
    (!filtroOrigem || getProgramaNome(t.origem_programa_id).toLowerCase().includes(filtroOrigem.toLowerCase())) &&
    (!filtroDestino || getProgramaNome(t.destino_programa_id).toLowerCase().includes(filtroDestino.toLowerCase()))
  );

  const parceirosUnicos = Array.from(new Set(transferencias.map(t => getParceiroNome(t.parceiro_id)).filter(n => n !== '-'))).sort();
  const origensUnicas = Array.from(new Set(transferencias.map(t => getProgramaNome(t.origem_programa_id)).filter(n => n !== '-'))).sort();
  const destinosUnicos = Array.from(new Set(transferencias.map(t => getProgramaNome(t.destino_programa_id)).filter(n => n !== '-'))).sort();

  const calcularQuantidadeTotal = () => {
    const destinoQtd = Number(formData.destino_quantidade) || 0;
    const bonusQtd = Number(formData.destino_quantidade_bonus) || 0;
    return destinoQtd + bonusQtd;
  };

  const getCustoMedioFinalCalculado = () => {
    const compraQtd = Number(formData.compra_quantidade) || 0;
    const compraValor = Number(formData.compra_valor_total) || 0;
    const saldoAtual = origemSaldo || 0;
    const custoMedioAtual = origemCustoMedio || 0;

    if (compraQtd > 0 && compraValor > 0) {
      const custoTotalAcumulado = (saldoAtual * custoMedioAtual / 1000) + compraValor;
      const saldoTotal = saldoAtual + compraQtd;
      return saldoTotal > 0 ? (custoTotalAcumulado / saldoTotal) * 1000 : 0;
    }
    return custoMedioAtual;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <ArrowRightLeft className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Transferência de Pontos/Milhas</h1>
            <p className="text-sm text-slate-600">Gerencie as transferências de pontos e milhas</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({
              data_transferencia: new Date().toISOString().split('T')[0],
              origem_paridade: 1,
              realizar_compra_carrinho: false,
              realizar_retorno_bumerangue: false,
              compra_parcelas: 1,
              destino_data_recebimento: new Date().toISOString().split('T')[0],
              bumerangue_bonus_percentual: 0,
              origem_quantidade: 0,
              destino_quantidade: 0,
              destino_quantidade_bonus: 0,
            });
            setTemPagamento(false);
            setOrigemSaldo(null);
            setOrigemCustoMedio(null);
            setOrigemProgramaClubeId(null);
            setDestinoProgramaClubeId(null);
            setProgramasOrigem([]);
            setProgramasDestino([]);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Transferência
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <FilterBar
            filters={[
              { label: 'Parceiro', options: parceirosUnicos, value: filtroParceiro, onChange: setFiltroParceiro },
              { label: 'Origem', options: origensUnicas, value: filtroOrigem, onChange: setFiltroOrigem },
              { label: 'Destino', options: destinosUnicos, value: filtroDestino, onChange: setFiltroDestino },
            ]}
            onClear={() => { setFiltroParceiro(''); setFiltroOrigem(''); setFiltroDestino(''); }}
          />
        </div>
        <div className="overflow-x-auto max-w-full">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Parceiro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Origem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Destino</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Quantidade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Paridade</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {transferenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">Nenhuma transferência cadastrada</p>
                  </td>
                </tr>
              ) : (
                transferenciasFiltradas.map((trans) => (
                  <tr key={trans.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{getParceiroNome(trans.parceiro_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatDate(trans.data_transferencia)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{getProgramaNome(trans.origem_programa_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{getProgramaNome(trans.destino_programa_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{trans.destino_quantidade?.toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">1:{trans.origem_paridade}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(trans)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(trans.id)}
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        title={
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            {editingItem ? 'Editar Transferência' : 'Nova Transferência'}
          </div>
        }
        size="xlarge"
      >
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.data_transferencia || ''}
                onChange={(e) => setFormData({ ...formData, data_transferencia: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ORIGEM */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-6">Origem</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Programa <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.origem_programa_id || ''}
                  onChange={(e) => setFormData({ ...formData, origem_programa_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!formData.parceiro_id || programasOrigem.length === 0}
                >
                  <option value="">Selecione</option>
                  {programasOrigem.map((pc) => (
                    <option key={pc.programa_id} value={pc.programa_id}>
                      {pc.programas_fidelidade?.nome || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Paridade <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">1 :</span>
                  <input
                    type="text"
                    required
                    value={formData.origem_paridade ? formData.origem_paridade.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '1'}
                    onChange={(e) => {
                      const value = parseDecimalInput(e.target.value, 1);
                      setFormData({ ...formData, origem_paridade: value });
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Atual</label>
                <input
                  type="text"
                  value={origemSaldo !== null ? origemSaldo.toLocaleString('pt-BR') : '0'}
                  disabled
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Custo Médio</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">R$</span>
                  <input
                    type="text"
                    value={origemCustoMedio !== null ? formatCurrency(origemCustoMedio) : formatCurrency(0)}
                    disabled
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
                  />
                </div>
              </div>
            </div>

            {origemSaldo !== null && formData.origem_quantidade > 0 && formData.origem_quantidade > origemSaldo && !formData.realizar_compra_carrinho && (
              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                <Info className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800">
                    <strong>Saldo Insuficiente!</strong> Você precisa de {formData.origem_quantidade.toLocaleString('pt-BR')} pontos mas só tem {origemSaldo.toLocaleString('pt-BR')} disponíveis.
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    💡 <strong>Dica:</strong> Marque a opção "Realizar compra no carrinho" abaixo para comprar {(formData.origem_quantidade - origemSaldo).toLocaleString('pt-BR')} pontos antes da transferência.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.realizar_compra_carrinho || false}
                  onChange={(e) => setFormData({ ...formData, realizar_compra_carrinho: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Realizar compra no carrinho</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.realizar_retorno_bumerangue || false}
                  onChange={(e) => setFormData({ ...formData, realizar_retorno_bumerangue: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Realizar retorno de pontos para conta origem (Bumerangue)</span>
              </label>
            </div>
          </div>

          {/* COMPRA NO CARRINHO */}
          {formData.realizar_compra_carrinho && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-700 mb-6">Pagamento Compra no Carrinho</h3>

              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-6 flex items-start gap-2">
                <Info className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  <strong>Atenção:</strong> As milhas compradas no carrinho serão primeiramente adicionadas em sua conta, recalculando seu custo médio, para depois serem transferidas já com o novo custo médio.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantidade <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.compra_quantidade ? formData.compra_quantidade.toLocaleString('pt-BR') : '0'}
                    onChange={(e) => {
                      const value = parseDecimalInput(e.target.value, 0);
                      const valorMilheiro = Number(formData.compra_valor_milheiro) || 0;
                      const valorTotal = value > 0 && valorMilheiro > 0 ? (valorMilheiro / 1000) * value : Number(formData.compra_valor_total) || 0;
                      setFormData({
                        ...formData,
                        compra_quantidade: value,
                        compra_valor_total: valorTotal > 0 ? Number(valorTotal.toFixed(2)) : formData.compra_valor_total
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valor Total <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.compra_valor_total || ''}
                      onChange={(e) => {
                        const valorTotal = parseFloat(e.target.value) || 0;
                        const compraQtd = Number(formData.compra_quantidade) || 0;
                        const valorMilheiro = compraQtd > 0 ? (valorTotal / compraQtd) * 1000 : 0;
                        setFormData({
                          ...formData,
                          compra_valor_total: valorTotal,
                          compra_valor_milheiro: Number(valorMilheiro.toFixed(2))
                        });
                      }}
                      placeholder="0,00"
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500 mt-1 block">
                      {formData.compra_valor_total ? `R$ ${formatNumberDisplay(formData.compra_valor_total)}` : ''}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valor Milheiro
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.compra_valor_milheiro || ''}
                      onChange={(e) => {
                        const valorMilheiro = parseFloat(e.target.value) || 0;
                        const compraQtd = Number(formData.compra_quantidade) || 0;
                        const valorTotal = compraQtd > 0 ? (valorMilheiro / 1000) * compraQtd : 0;
                        setFormData({
                          ...formData,
                          compra_valor_milheiro: valorMilheiro,
                          compra_valor_total: Number(valorTotal.toFixed(2))
                        });
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500 mt-1 block">
                      {formData.compra_valor_milheiro ? `R$ ${formatNumberDisplay(formData.compra_valor_milheiro)}` : ''}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Custo Médio Final
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.compra_custo_medio_final || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, compra_custo_medio_final: parseFloat(e.target.value) || 0 });
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500 mt-1 block">
                      {formData.compra_custo_medio_final ? `R$ ${formatNumberDisplay(formData.compra_custo_medio_final)}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={formData.compra_forma_pagamento || ''}
                    onChange={(e) => setFormData({ ...formData, compra_forma_pagamento: e.target.value, compra_cartao_id: '', compra_conta_bancaria_id: '' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione</option>
                    {formasPagamento.map((forma) => (
                      <option key={forma.id} value={forma.nome}>{forma.nome}</option>
                    ))}
                  </select>
                </div>

                {formData.compra_forma_pagamento !== 'Não registrar no fluxo de caixa' && (
                  <>
                    {(formData.compra_forma_pagamento === 'Crédito') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Cartão de Crédito <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.compra_cartao_id || ''}
                          onChange={(e) => setFormData({ ...formData, compra_cartao_id: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione o cartão</option>
                          {cartoes.map((cartao) => (
                            <option key={cartao.id} value={cartao.id}>
                              {cartao.cartao} {cartao.banco_emissor ? `- ${cartao.banco_emissor}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(formData.compra_forma_pagamento === 'Débito') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Cartão de Débito <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.compra_cartao_id || ''}
                          onChange={(e) => setFormData({ ...formData, compra_cartao_id: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione o cartão</option>
                          {cartoes.map((cartao) => (
                            <option key={cartao.id} value={cartao.id}>
                              {cartao.cartao} {cartao.banco_emissor ? `- ${cartao.banco_emissor}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(formData.compra_forma_pagamento === 'PIX' || formData.compra_forma_pagamento === 'Dinheiro' || formData.compra_forma_pagamento === 'Transferência') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Banco Emissor <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.compra_conta_bancaria_id || ''}
                          onChange={(e) => setFormData({ ...formData, compra_conta_bancaria_id: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione o banco</option>
                          {contasBancarias.map((banco) => (
                            <option key={banco.id} value={banco.id}>
                              {banco.nome_banco} {banco.codigo_banco ? `(${banco.codigo_banco})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {formData.compra_forma_pagamento === 'Dinheiro' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Data de Vencimento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.compra_data_vencimento_manual || ''}
                      onChange={(e) => setFormData({ ...formData, compra_data_vencimento_manual: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.compra_parcelas || 1}
                    onChange={(e) => setFormData({ ...formData, compra_parcelas: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* RETORNO BUMERANGUE */}
          {formData.realizar_retorno_bumerangue && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bônus</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500">%</span>
                    <input
                      type="text"
                      value={formData.bumerangue_bonus_percentual ? formData.bumerangue_bonus_percentual.toLocaleString('pt-BR') : '0'}
                      onChange={(e) => {
                        const value = parseDecimalInput(e.target.value, 0);
                        setFormData({ ...formData, bumerangue_bonus_percentual: value });
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Bônus</label>
                  <input
                    type="text"
                    value={formData.bumerangue_quantidade_bonus ? formData.bumerangue_quantidade_bonus.toLocaleString('pt-BR') : '0'}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recebimento Bônus</label>
                  <input
                    type="date"
                    value={formData.bumerangue_data_recebimento || ''}
                    onChange={(e) => setFormData({ ...formData, bumerangue_data_recebimento: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DESTINO - Movido para antes do Pagamento */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-700 mb-6">Destino</h3>

            {formData.origem_programa_id && formData.destino_programa_id && formData.origem_programa_id === formData.destino_programa_id && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                <Info className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  <strong>Atenção:</strong> Não é possível transferir pontos para o mesmo programa. Selecione um programa diferente.
                </p>
              </div>
            )}

            {origemSaldo !== null && origemSaldo <= 0 && formData.origem_programa_id && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                <Info className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  <strong>Atenção:</strong> Não há pontos disponíveis no programa de origem.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Programa <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.destino_programa_id || ''}
                  onChange={(e) => setFormData({ ...formData, destino_programa_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!formData.parceiro_id || programasDestino.length === 0}
                >
                  <option value="">Selecione</option>
                  {programasDestino
                    .filter((pc) => pc.programa_id !== formData.origem_programa_id)
                    .map((pc) => (
                      <option key={pc.programa_id} value={pc.programa_id}>
                        {pc.programas_fidelidade?.nome || 'N/A'}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.destino_quantidade ? formData.destino_quantidade.toLocaleString('pt-BR') : '0'}
                  onChange={(e) => {
                    const value = parseDecimalInput(e.target.value, 0);
                    setFormData({ ...formData, destino_quantidade: value });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!formData.destino_programa_id}
                />
                {origemSaldo !== null && (formData.origem_quantidade ?? 0) > 0 && (formData.origem_quantidade ?? 0) > origemSaldo && !formData.realizar_compra_carrinho && (
                  <p className="text-xs text-red-600 mt-1">Saldo insuficiente na origem (disponível: {origemSaldo.toLocaleString('pt-BR')})</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Recebimento Milhas <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.destino_data_recebimento || ''}
                  onChange={(e) => setFormData({ ...formData, destino_data_recebimento: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Se for hoje, os pontos entram imediatamente. Se for data futura, ficam pendentes até a data.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Bônus</label>
              <input
                type="text"
                value={formData.destino_quantidade_bonus ? formData.destino_quantidade_bonus.toLocaleString('pt-BR') : ''}
                onChange={(e) => {
                  const value = parseDecimalInput(e.target.value, 0);
                  setFormData({ ...formData, destino_quantidade_bonus: value });
                }}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Total</label>
              <input
                type="text"
                value={calcularQuantidadeTotal().toLocaleString('pt-BR')}
                disabled
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
              />
            </div>
          </div>

          {/* PAGAMENTO DA TRANSFERÊNCIA */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-6">Pagamento</h3>

            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={temPagamento}
                  onChange={(e) => {
                    setTemPagamento(e.target.checked);
                    if (!e.target.checked) {
                      setFormData({
                        ...formData,
                        custo_transferencia: 0,
                        forma_pagamento_transferencia: undefined,
                        cartao_id: undefined,
                        conta_bancaria_id: undefined
                      });
                    }
                  }}
                  className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Esta transferência tem custo financeiro
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Marque se houver custo para realizar a transferência
                  </p>
                </div>
              </label>
            </div>

            {temPagamento && (
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
                        required={temPagamento}
                        value={formData.custo_transferencia || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setFormData({ ...formData, custo_transferencia: value });
                        }}
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Forma de Pagamento <span className="text-red-500">*</span>
                    </label>
                    <select
                      required={temPagamento}
                      value={formData.forma_pagamento_transferencia || ''}
                      onChange={(e) => setFormData({ ...formData, forma_pagamento_transferencia: e.target.value, cartao_id: '', conta_bancaria_id: '' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione</option>
                      {formasPagamento.map((forma) => (
                        <option key={forma.id} value={forma.nome}>{forma.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.forma_pagamento_transferencia !== 'Não registrar no fluxo de caixa' && (
                  <>
                    {(formData.forma_pagamento_transferencia === 'Crédito' || formData.forma_pagamento_transferencia === 'Débito') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Cartão <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={formData.cartao_id || ''}
                            onChange={(e) => setFormData({ ...formData, cartao_id: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Selecione o cartão</option>
                            {cartoes.map((cartao) => (
                              <option key={cartao.id} value={cartao.id}>
                                {cartao.cartao} {cartao.banco_emissor ? `- ${cartao.banco_emissor}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {formData.forma_pagamento_transferencia &&
                     formData.forma_pagamento_transferencia !== 'Crédito' &&
                     formData.forma_pagamento_transferencia !== 'Débito' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Banco Emissor <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={formData.conta_bancaria_id || ''}
                            onChange={(e) => setFormData({ ...formData, conta_bancaria_id: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Selecione a conta</option>
                            {contasBancarias.map((conta) => (
                              <option key={conta.id} value={conta.id}>
                                {conta.nome_banco} {conta.numero_conta ? `- ${conta.numero_conta}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {formData.forma_pagamento_transferencia === 'Dinheiro' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Data de Vencimento <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.taxa_data_vencimento_manual || ''}
                          onChange={(e) => setFormData({ ...formData, taxa_data_vencimento_manual: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <textarea
              rows={3}
              value={formData.observacao || ''}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                formData.origem_programa_id === formData.destino_programa_id ||
                (!formData.realizar_compra_carrinho && origemSaldo !== null && origemSaldo <= 0)
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              Transferir
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
