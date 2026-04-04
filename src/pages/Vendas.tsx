import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, TrendingUp, Eye, Trash2, Layers, AlertTriangle } from 'lucide-react';
import { FilterBar } from '../components/FilterCombobox';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatNumberDisplay } from '../lib/formatters';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ParceiroSearch from '../components/ParceiroSearch';
import VendaLoteModal from '../components/VendaLoteModal';

interface Venda {
  id: string;
  data_venda: string;
  ordem_compra: string | null;
  parceiros: { nome_parceiro: string } | null;
  clientes: { nome_cliente: string } | null;
  programas_fidelidade: { nome: string } | null;
  cia_parceira: string | null;
  quantidade_milhas: number;
  valor_milheiro: number;
  valor_total: number;
  lucro_real: number;
  status: string;
  localizadores: { codigo_localizador: string }[] | null;
}

interface Parceiro {
  id: string;
  nome_parceiro: string;
}

interface Cliente {
  id: string;
  nome_cliente: string;
}

interface Programa {
  id: string;
  nome: string;
}

interface Cartao {
  id: string;
  cartao: string;
}

interface Usuario {
  id: string;
  nome: string;
}

interface FormData {
  parceiro_id: string;
  cliente_id: string;
  cartao_id: string;
  data_venda: string;
  ordem_compra: string;
  programa_id: string;
  cia_parceira: string;
  quantidade_milhas: number;
  valor_milheiro: number;
  valor_total: number;
  taxa_embarque: number;
  taxa_resgate: number;
  taxa_bagagem: number;
  cartao_taxa_embarque_id: string;
  cartao_taxa_embarque_tipo: 'debito' | 'credito' | '';
  cartao_taxa_embarque_parcelas: number;
  cartao_taxa_bagagem_id: string;
  cartao_taxa_bagagem_tipo: 'debito' | 'credito' | '';
  cartao_taxa_bagagem_parcelas: number;
  cartao_taxa_resgate_id: string;
  cartao_taxa_resgate_tipo: 'debito' | 'credito' | '';
  cartao_taxa_resgate_parcelas: number;
  data_voo_ida: string;
  data_voo_volta: string;
  nome_passageiro: string;
  quantidade_passageiros: number;
  trecho: string;
  tarifa_diamante: number;
  milhas_bonus: number;
  custo_emissao: number;
  emissor: string;
  observacao: string;
  localizador: string;
  data_vencimento_venda: string;
}

export default function Vendas() {
  const { usuario, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroPrograma, setFiltroPrograma] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showLoteModal, setShowLoteModal] = useState(false);
  const [saldoAtual, setSaldoAtual] = useState<number>(0);
  const [custoMedio, setCustoMedio] = useState<number>(0);
  const [comissaoInfo, setComissaoInfo] = useState<{ tem_comissao: boolean; tipo: 'porcentagem' | 'real' | null; valor: number }>({ tem_comissao: false, tipo: null, valor: 0 });
  const [rawValorMilheiro, setRawValorMilheiro] = useState('');
  const [rawTaxaEmbarque, setRawTaxaEmbarque] = useState('');
  const [rawTaxaResgate, setRawTaxaResgate] = useState('');
  const [rawTaxaBagagem, setRawTaxaBagagem] = useState('');
  const [rawCustoEmissao, setRawCustoEmissao] = useState('');
  const custoEmissaoManual = useRef(false);
  const [rawTarifaDiamante, setRawTarifaDiamante] = useState('');
  const [error, setError] = useState<string>('');
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type?: 'success' | 'error' | 'warning';
    title?: string;
    message?: string;
    onConfirm?: () => void;
  }>({ isOpen: false });

  const [formData, setFormData] = useState<FormData>({
    parceiro_id: '',
    cliente_id: '',
    cartao_id: '',
    data_venda: new Date().toISOString().split('T')[0],
    ordem_compra: '',
    programa_id: '',
    cia_parceira: '',
    quantidade_milhas: 0,
    valor_milheiro: 0,
    valor_total: 0,
    taxa_embarque: 0,
    taxa_resgate: 0,
    taxa_bagagem: 0,
    cartao_taxa_embarque_id: '',
    cartao_taxa_embarque_tipo: '',
    cartao_taxa_embarque_parcelas: 1,
    cartao_taxa_bagagem_id: '',
    cartao_taxa_bagagem_tipo: '',
    cartao_taxa_bagagem_parcelas: 1,
    cartao_taxa_resgate_id: '',
    cartao_taxa_resgate_tipo: '',
    cartao_taxa_resgate_parcelas: 1,
    data_voo_ida: '',
    data_voo_volta: '',
    nome_passageiro: '',
    quantidade_passageiros: 1,
    trecho: '',
    tarifa_diamante: 0,
    milhas_bonus: 0,
    custo_emissao: 0,
    emissor: usuario?.nome || '',
    observacao: '',
    localizador: '',
    data_vencimento_venda: '',
  });

  const { lucroReal, lucroBase, comissaoCalculada, custoEmissaoCalc } = useMemo(() => {
    if (formData.quantidade_milhas > 0 && custoMedio > 0) {
      const custoTotal = (custoMedio * formData.quantidade_milhas) / 1000;
      const bruto = formData.valor_total - custoTotal;
      let comissaoCalc = 0;
      if (comissaoInfo.tem_comissao && comissaoInfo.tipo && comissaoInfo.valor > 0) {
        comissaoCalc = comissaoInfo.tipo === 'porcentagem'
          ? formData.valor_total * comissaoInfo.valor / 100
          : comissaoInfo.valor;
      }
      // Usar custo_emissao do form; se ainda não calculado pelo efeito, derivar da qtd
      const custoEmissao = formData.custo_emissao > 0
        ? formData.custo_emissao
        : Number(((0.1 * formData.quantidade_milhas) / 1000).toFixed(2));
      return {
        lucroBase: Number(bruto.toFixed(2)),
        comissaoCalculada: Number(comissaoCalc.toFixed(2)),
        lucroReal: Number((bruto - comissaoCalc - custoEmissao).toFixed(2)),
        custoEmissaoCalc: custoEmissao,
      };
    }
    return { lucroBase: 0, comissaoCalculada: 0, lucroReal: 0, custoEmissaoCalc: 0 };
  }, [formData.quantidade_milhas, formData.valor_total, formData.custo_emissao, custoMedio, comissaoInfo]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.parceiro_id) {
      carregarProgramasDoParceiro(formData.parceiro_id);
    } else {
      setProgramas([]);
      setFormData(prev => ({ ...prev, programa_id: '' }));
    }
  }, [formData.parceiro_id]);

  useEffect(() => {
    if (formData.parceiro_id && formData.programa_id) {
      carregarSaldoECusto();
      carregarComissao();
    } else {
      setSaldoAtual(0);
      setCustoMedio(0);
      setComissaoInfo({ tem_comissao: false, tipo: null, valor: 0 });
    }
  }, [formData.parceiro_id, formData.programa_id]);

  useEffect(() => {
    calcularValorTotal();
  }, [formData.quantidade_milhas, formData.valor_milheiro]);

  useEffect(() => {
    if (custoEmissaoManual.current) return; // não sobrescrever valor digitado manualmente
    const custo = (0.1 * formData.quantidade_milhas) / 1000;
    const custoFormatado = Number(custo.toFixed(2));
    setFormData(prev => ({ ...prev, custo_emissao: custoFormatado }));
    setRawCustoEmissao(custoFormatado > 0 ? formatNumberDisplay(custoFormatado) : '');
  }, [formData.quantidade_milhas]);

  useEffect(() => {
    if (formData.cartao_id) {
      setFormData(prev => ({
        ...prev,
        cartao_taxa_embarque_id: formData.cartao_id,
        cartao_taxa_bagagem_id: formData.cartao_id,
        cartao_taxa_resgate_id: formData.cartao_id,
      }));
    }
  }, [formData.cartao_id]);

  const formatarOrdemCompra = (valor: string): string => {
    return valor.toUpperCase();
  };

  const formatarLocalizador = (valor: string): string => {
    return valor.toUpperCase();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vendasRes, parceirosRes, clientesRes, cartoesRes, usuariosRes] = await Promise.all([
        supabase
          .from('vendas')
          .select(`
            *,
            parceiros!vendas_parceiro_id_fkey(nome_parceiro),
            clientes!vendas_cliente_id_fkey(nome_cliente),
            programas_fidelidade!vendas_programa_id_fkey(nome),
            localizadores(codigo_localizador)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('parceiros').select('id, nome_parceiro').order('nome_parceiro'),
        supabase.from('clientes').select('id, nome_cliente').order('nome_cliente'),
        supabase.from('cartoes_credito').select('id, cartao').order('cartao'),
        supabase.from('usuarios').select('id, nome').order('nome'),
      ]);

      if (vendasRes.data) setVendas(vendasRes.data);
      if (parceirosRes.data) setParceiros(parceirosRes.data);
      if (clientesRes.data) setClientes(clientesRes.data);
      if (cartoesRes.data) setCartoes(cartoesRes.data);
      if (usuariosRes.data) setUsuarios(usuariosRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarProgramasDoParceiro = async (parceiroId: string) => {
    try {
      const { data, error } = await supabase
        .from('programas_clubes')
        .select('programa_id, programas_fidelidade(id, nome)')
        .eq('parceiro_id', parceiroId);

      if (error) throw error;

      if (data) {
        const programasUnicos = data
          .filter((item: any) => item.programas_fidelidade)
          .map((item: any) => ({
            id: item.programas_fidelidade.id,
            nome: item.programas_fidelidade.nome
          }))
          .filter((programa: Programa, index: number, self: Programa[]) =>
            index === self.findIndex(p => p.id === programa.id)
          );

        setProgramas(programasUnicos);
      }
    } catch (error) {
      console.error('Erro ao carregar programas:', error);
      setProgramas([]);
    }
  };

  const carregarSaldoECusto = async () => {
    try {
      const [{ data, error }, { data: comprasAtivas }] = await Promise.all([
        supabase
          .from('estoque_pontos')
          .select('saldo_atual, custo_medio')
          .eq('parceiro_id', formData.parceiro_id)
          .eq('programa_id', formData.programa_id)
          .maybeSingle(),
        supabase
          .from('compras')
          .select('saldo_atual, valor_milheiro')
          .eq('parceiro_id', formData.parceiro_id)
          .eq('programa_id', formData.programa_id)
          .eq('status', 'Concluído')
          .gt('saldo_atual', 0)
          .neq('observacao', 'Compra no Carrinho'),
      ]);

      if (error) throw error;

      setSaldoAtual(data ? Number(data.saldo_atual || 0) : 0);

      if (comprasAtivas && comprasAtivas.length > 0) {
        let totalPts = 0;
        let totalValor = 0;
        for (const c of comprasAtivas as any[]) {
          const pts = Number(c.saldo_atual || 0);
          totalPts += pts;
          totalValor += pts * Number(c.valor_milheiro || 0);
        }
        setCustoMedio(totalPts > 0 ? totalValor / totalPts : 0);
      } else {
        setCustoMedio(data ? Number(data.custo_medio || 0) : 0);
      }
    } catch (error) {
      console.error('Erro ao carregar saldo:', error);
      setSaldoAtual(0);
      setCustoMedio(0);
    }
  };

  const carregarComissao = async () => {
    try {
      const { data } = await supabase
        .from('programas_clubes')
        .select('tem_comissao, comissao_tipo, comissao_valor')
        .eq('parceiro_id', formData.parceiro_id)
        .eq('programa_id', formData.programa_id)
        .maybeSingle();

      if (data && data.tem_comissao) {
        setComissaoInfo({
          tem_comissao: true,
          tipo: data.comissao_tipo || null,
          valor: Number(data.comissao_valor || 0),
        });
      } else {
        setComissaoInfo({ tem_comissao: false, tipo: null, valor: 0 });
      }
    } catch {
      setComissaoInfo({ tem_comissao: false, tipo: null, valor: 0 });
    }
  };

  const calcularValorTotal = () => {
    if (formData.quantidade_milhas > 0 && formData.valor_milheiro > 0) {
      const valorTotal = (formData.valor_milheiro * formData.quantidade_milhas) / 1000;
      setFormData(prev => ({ ...prev, valor_total: Number(valorTotal.toFixed(2)) }));
    }
  };

  const calcularValorTotalVendas = () => {
    return formData.valor_total + formData.taxa_embarque + formData.taxa_resgate + formData.taxa_bagagem;
  };

  const handleOpenModal = () => {
    setFormData({
      parceiro_id: '',
      cliente_id: '',
      cartao_id: '',
      data_venda: new Date().toISOString().split('T')[0],
      ordem_compra: '',
      programa_id: '',
      cia_parceira: '',
      quantidade_milhas: 0,
      valor_milheiro: 0,
      valor_total: 0,
      taxa_embarque: 0,
      taxa_resgate: 0,
      taxa_bagagem: 0,
      cartao_taxa_embarque_id: '',
      cartao_taxa_embarque_tipo: '',
      cartao_taxa_embarque_parcelas: 1,
      cartao_taxa_bagagem_id: '',
      cartao_taxa_bagagem_tipo: '',
      cartao_taxa_bagagem_parcelas: 1,
      cartao_taxa_resgate_id: '',
      cartao_taxa_resgate_tipo: '',
      cartao_taxa_resgate_parcelas: 1,
      data_voo_ida: '',
      data_voo_volta: '',
      nome_passageiro: '',
      quantidade_passageiros: 1,
      trecho: '',
      tarifa_diamante: 0,
      milhas_bonus: 0,
      custo_emissao: 0,
      emissor: usuario?.nome || '',
      observacao: '',
      localizador: '',
    });
    setSaldoAtual(0);
    setCustoMedio(0);
    setComissaoInfo({ tem_comissao: false, tipo: null, valor: 0 });
    setError('');
    setRawValorMilheiro('');
    setRawTaxaEmbarque('');
    setRawTaxaResgate('');
    setRawTaxaBagagem('');
    setRawCustoEmissao('');
    setRawTarifaDiamante('');
    custoEmissaoManual.current = false;
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setError('');
  };

  const handleDelete = async (id: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir esta venda?\n\nEsta ação afetará o estoque de pontos/milhas, os localizadores e contas a receber associadas. Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          if (isAdmin && usuario) {
            await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: true });
          }

          const { error } = await supabase
            .from('vendas')
            .delete()
            .eq('id', id);

          if (isAdmin && usuario) {
            await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
          }

          if (error) throw error;

          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Venda: id=${id}`,
            dados_antes: null,
            dados_depois: null
          });

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Venda excluída com sucesso!'
          });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (formData.localizador) {
        const { data: localizadorExiste } = await supabase
          .from('vendas')
          .select('id')
          .eq('localizador', formData.localizador)
          .maybeSingle();
        if (localizadorExiste) {
          throw new Error(`Já existe uma venda com o Localizador "${formData.localizador}". Localizadores não podem ser duplicados.`);
        }
      }

      if (formData.ordem_compra) {
        const { data: ocExiste } = await supabase
          .from('vendas')
          .select('id')
          .eq('ordem_compra', formData.ordem_compra)
          .maybeSingle();
        if (ocExiste) {
          throw new Error(`Já existe uma venda com a Ordem de Compra "${formData.ordem_compra}". OCs não podem ser duplicadas.`);
        }
      }

      const { data: estoqueCheck } = await supabase
        .from('estoque_pontos')
        .select('id')
        .eq('parceiro_id', formData.parceiro_id)
        .eq('programa_id', formData.programa_id)
        .maybeSingle();

      if (!estoqueCheck) {
        const parceiroSel = parceiros.find((p: any) => p.id === formData.parceiro_id);
        const programaSel = programas.find((p: any) => p.id === formData.programa_id);
        throw new Error(
          `${parceiroSel?.nome_parceiro || 'O parceiro'} não possui conta cadastrada no programa ${programaSel?.nome || 'selecionado'}.\n\nRegistre uma compra ou movimentação para este parceiro neste programa antes de realizar uma venda.`
        );
      }

      if (formData.quantidade_milhas > saldoAtual) {
        throw new Error(`Saldo insuficiente. Saldo disponível: ${saldoAtual.toLocaleString('pt-BR')}`);
      }

      if (formData.quantidade_milhas <= 0) {
        throw new Error('Quantidade de milhas deve ser maior que zero.');
      }

      if (formData.valor_milheiro <= 0) {
        throw new Error('Valor do milheiro deve ser maior que zero.');
      }

      const vendaData = {
        parceiro_id: formData.parceiro_id,
        cliente_id: formData.cliente_id || null,
        data_venda: formData.data_venda,
        ordem_compra: formData.ordem_compra || null,
        programa_id: formData.programa_id,
        cia_parceira: formData.cia_parceira || null,
        quantidade_milhas: formData.quantidade_milhas,
        valor_milheiro: formData.valor_milheiro,
        valor_total: formData.valor_total,
        taxa_embarque: formData.taxa_embarque,
        taxa_resgate: formData.taxa_resgate,
        taxa_bagagem: formData.taxa_bagagem,
        cartao_taxa_embarque_id: formData.cartao_taxa_embarque_id || null,
        cartao_taxa_bagagem_id: formData.cartao_taxa_bagagem_id || null,
        cartao_taxa_resgate_id: formData.cartao_taxa_resgate_id || null,
        data_voo_ida: formData.data_voo_ida || null,
        data_voo_volta: formData.data_voo_volta || null,
        nome_passageiro: formData.nome_passageiro || null,
        quantidade_passageiros: formData.quantidade_passageiros,
        trecho: formData.trecho || null,
        tarifa_diamante: formData.tarifa_diamante,
        milhas_bonus: formData.milhas_bonus,
        custo_emissao: formData.custo_emissao,
        emissor: formData.emissor || null,
        observacao: formData.observacao || null,
        custo_medio: custoMedio,
        lucro_real: lucroReal,
        status: 'concluida',
        created_by: usuario?.id,
      };

      const { data: vendaCriada, error: vendaError } = await supabase
        .from('vendas')
        .insert([vendaData])
        .select()
        .single();

      if (vendaError) throw vendaError;

      if (formData.localizador) {
        const { error: localizadorError } = await supabase
          .from('localizadores')
          .insert([{
            venda_id: vendaCriada.id,
            codigo_localizador: formData.localizador,
            status: 'emitido',
          }]);

        if (localizadorError) throw localizadorError;
      }

      // Criar conta a receber se data de vencimento informada
      if (formData.data_vencimento_venda) {
        const { error: contaError } = await supabase.from('contas_receber').insert([{
          venda_id: vendaCriada.id,
          origem_tipo: 'venda',
          origem_id: vendaCriada.id,
          data_vencimento: formData.data_vencimento_venda,
          valor_parcela: calcularValorTotalVendas(),
          numero_parcela: 1,
          total_parcelas: 1,
          status_pagamento: 'pendente',
        }]);
        if (contaError) throw contaError;
      }

      await supabase.from('logs').insert({
        usuario_id: usuario?.id,
        usuario_nome: usuario?.nome || '',
        acao: 'INSERT',
        linha_afetada: `Venda: ${formData.quantidade_milhas} pts`,
        dados_antes: null,
        dados_depois: formData
      });

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'Venda cadastrada com sucesso!'
      });

      handleCloseModal();
      fetchData();
    } catch (error: any) {
      console.error('Erro ao salvar venda:', error);
      setError(error.message || 'Erro ao processar venda');
    } finally {
      setSaving(false);
    }
  };

  const vendasFiltradas = vendas.filter(venda =>
    (!filtroParceiro || (venda.parceiros?.nome_parceiro || '').toLowerCase().includes(filtroParceiro.toLowerCase())) &&
    (!filtroCliente || (venda.clientes?.nome_cliente || '').toLowerCase().includes(filtroCliente.toLowerCase())) &&
    (!filtroPrograma || (venda.programas_fidelidade?.nome || '').toLowerCase().includes(filtroPrograma.toLowerCase())) &&
    (!filtroStatus || venda.status.toLowerCase() === filtroStatus.toLowerCase())
  );

  const parceirosUnicos = Array.from(new Set(vendas.map(v => v.parceiros?.nome_parceiro).filter(Boolean))).sort() as string[];
  const clientesUnicos = Array.from(new Set(vendas.map(v => v.clientes?.nome_cliente).filter(Boolean))).sort() as string[];
  const programasUnicos = Array.from(new Set(vendas.map(v => v.programas_fidelidade?.nome).filter(Boolean))).sort() as string[];

  const getStatusBadge = (status: string) => {
    const colors = {
      pendente: 'bg-yellow-100 text-yellow-800',
      concluida: 'bg-green-100 text-green-800',
      cancelada: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-sm text-gray-600 mt-1">Gerenciar vendas de milhas/pontos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLoteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <Layers className="w-5 h-5" />
            Venda por Lote
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="w-5 h-5" />
            Nova Venda
          </button>
        </div>
      </div>

      <div className="mb-6">
        <FilterBar
          filters={[
            { label: 'Parceiro', options: parceirosUnicos, value: filtroParceiro, onChange: setFiltroParceiro },
            { label: 'Cliente', options: clientesUnicos, value: filtroCliente, onChange: setFiltroCliente },
            { label: 'Programa', options: programasUnicos, value: filtroPrograma, onChange: setFiltroPrograma },
            { label: 'Status', options: ['Concluída', 'Pendente', 'Cancelada'], value: filtroStatus, onChange: setFiltroStatus },
          ]}
          onClear={() => { setFiltroParceiro(''); setFiltroCliente(''); setFiltroPrograma(''); setFiltroStatus(''); }}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parceiro</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Emissão</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">OC</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Localizador</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Programa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cia Parceira</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qte Milhas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Milheiro</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Venda</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lucro</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-8 text-center text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>Nenhuma venda encontrada</p>
                  </td>
                </tr>
              ) : (
                vendasFiltradas.map((venda) => (
                  <tr key={venda.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {venda.parceiros?.nome_parceiro || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {venda.clientes?.nome_cliente || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(venda.data_venda + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {venda.ordem_compra || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {venda.localizadores?.[0]?.codigo_localizador || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {venda.programas_fidelidade?.nome || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {venda.cia_parceira || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {venda.quantidade_milhas.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(venda.valor_milheiro)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(venda.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                      {formatCurrency(venda.lucro_real)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(venda.status)}`}>
                        {venda.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => navigate(`/vendas/${venda.id}/localizador`)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Ver detalhes"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(venda.id)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={handleCloseModal} title="Nova Venda">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Campos Obrigatórios</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parceiro <span className="text-red-500">*</span>
                  </label>
                  <ParceiroSearch
                    parceiros={parceiros}
                    value={formData.parceiro_id}
                    onChange={(parceiroId) => setFormData(prev => ({ ...prev, parceiro_id: parceiroId }))}
                    placeholder="Digite para buscar parceiro..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.cliente_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, cliente_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_cliente}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data da Operação <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.data_venda}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_venda: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordem de Compra <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ordem_compra}
                    onChange={(e) => {
                      const valorFormatado = formatarOrdemCompra(e.target.value);
                      setFormData(prev => ({ ...prev, ordem_compra: valorFormatado }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="000.000.000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Localizador <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.localizador}
                    onChange={(e) => {
                      const valorFormatado = formatarLocalizador(e.target.value);
                      setFormData(prev => ({ ...prev, localizador: valorFormatado }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ABC.123.XYZ"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Programa Fidelidade <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.programa_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, programa_id: e.target.value }))}
                    disabled={!formData.parceiro_id}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Selecione</option>
                    {programas.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cia Parceira <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.cia_parceira}
                    onChange={(e) => setFormData(prev => ({ ...prev, cia_parceira: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Qte Milhas <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.quantidade_milhas ? formData.quantidade_milhas.toLocaleString('pt-BR') : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData(prev => ({ ...prev, quantidade_milhas: Number(value) }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor Milheiro <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      required
                      value={rawValorMilheiro}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9,]/g, '');
                        setRawValorMilheiro(val);
                        const num = parseFloat(val.replace(',', '.')) || 0;
                        setFormData(prev => ({ ...prev, valor_milheiro: num }));
                      }}
                      onBlur={() => {
                        if (formData.valor_milheiro) {
                          setRawValorMilheiro(formatNumberDisplay(formData.valor_milheiro));
                        }
                      }}
                      onFocus={() => {
                        setRawValorMilheiro(formData.valor_milheiro ? String(formData.valor_milheiro).replace('.', ',') : '');
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Atual</label>
                  <input
                    type="text"
                    value={saldoAtual.toLocaleString('pt-BR')}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custo Médio</label>
                  <input
                    type="text"
                    value={formatCurrency(custoMedio)}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lucro</label>
                  <input
                    type="text"
                    value={formatCurrency(lucroReal)}
                    readOnly
                    className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 font-medium"
                  />
                  {(comissaoCalculada > 0 || custoEmissaoCalc > 0) && (
                    <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                      <div>Bruto: {formatCurrency(lucroBase)}</div>
                      {comissaoCalculada > 0 && <div>Comissão (-): {formatCurrency(comissaoCalculada)}</div>}
                      {custoEmissaoCalc > 0 && <div>Custo Emissão (-): {formatCurrency(custoEmissaoCalc)}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Campos Opcionais</h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor da Venda</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={formData.valor_total ? formData.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                      readOnly
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taxa de Embarque R$</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={rawTaxaEmbarque}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9,]/g, '');
                        setRawTaxaEmbarque(val);
                        setFormData(prev => ({ ...prev, taxa_embarque: parseFloat(val.replace(',', '.')) || 0 }));
                      }}
                      onBlur={() => {
                        if (formData.taxa_embarque) setRawTaxaEmbarque(formatNumberDisplay(formData.taxa_embarque));
                      }}
                      onFocus={() => {
                        setRawTaxaEmbarque(formData.taxa_embarque ? String(formData.taxa_embarque).replace('.', ',') : '');
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taxa de Resgate R$</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={rawTaxaResgate}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9,]/g, '');
                        setRawTaxaResgate(val);
                        setFormData(prev => ({ ...prev, taxa_resgate: parseFloat(val.replace(',', '.')) || 0 }));
                      }}
                      onBlur={() => {
                        if (formData.taxa_resgate) setRawTaxaResgate(formatNumberDisplay(formData.taxa_resgate));
                      }}
                      onFocus={() => {
                        setRawTaxaResgate(formData.taxa_resgate ? String(formData.taxa_resgate).replace('.', ',') : '');
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bagagem/Tx Cancel./Assentos R$</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={rawTaxaBagagem}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9,]/g, '');
                        setRawTaxaBagagem(val);
                        setFormData(prev => ({ ...prev, taxa_bagagem: parseFloat(val.replace(',', '.')) || 0 }));
                      }}
                      onBlur={() => {
                        if (formData.taxa_bagagem) setRawTaxaBagagem(formatNumberDisplay(formData.taxa_bagagem));
                      }}
                      onFocus={() => {
                        setRawTaxaBagagem(formData.taxa_bagagem ? String(formData.taxa_bagagem).replace('.', ',') : '');
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Cartão TX Embarque</label>
                  <select
                    value={formData.cartao_taxa_embarque_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_embarque_id: e.target.value, cartao_taxa_embarque_tipo: '', cartao_taxa_embarque_parcelas: 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o cartão</option>
                    {cartoes.map(c => (
                      <option key={c.id} value={c.id}>{c.cartao}</option>
                    ))}
                  </select>
                  {formData.cartao_taxa_embarque_id && (
                    <div className="flex gap-2">
                      <select
                        value={formData.cartao_taxa_embarque_tipo}
                        onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_embarque_tipo: e.target.value as 'debito' | 'credito' | '', cartao_taxa_embarque_parcelas: 1 }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Tipo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                      </select>
                      {formData.cartao_taxa_embarque_tipo === 'credito' && (
                        <select
                          value={formData.cartao_taxa_embarque_parcelas}
                          onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_embarque_parcelas: Number(e.target.value) }))}
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}x</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Cartão Tx Bagagem</label>
                  <select
                    value={formData.cartao_taxa_bagagem_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_bagagem_id: e.target.value, cartao_taxa_bagagem_tipo: '', cartao_taxa_bagagem_parcelas: 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o cartão</option>
                    {cartoes.map(c => (
                      <option key={c.id} value={c.id}>{c.cartao}</option>
                    ))}
                  </select>
                  {formData.cartao_taxa_bagagem_id && (
                    <div className="flex gap-2">
                      <select
                        value={formData.cartao_taxa_bagagem_tipo}
                        onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_bagagem_tipo: e.target.value as 'debito' | 'credito' | '', cartao_taxa_bagagem_parcelas: 1 }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Tipo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                      </select>
                      {formData.cartao_taxa_bagagem_tipo === 'credito' && (
                        <select
                          value={formData.cartao_taxa_bagagem_parcelas}
                          onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_bagagem_parcelas: Number(e.target.value) }))}
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}x</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Cartão Tx Resgate</label>
                  <select
                    value={formData.cartao_taxa_resgate_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_resgate_id: e.target.value, cartao_taxa_resgate_tipo: '', cartao_taxa_resgate_parcelas: 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o cartão</option>
                    {cartoes.map(c => (
                      <option key={c.id} value={c.id}>{c.cartao}</option>
                    ))}
                  </select>
                  {formData.cartao_taxa_resgate_id && (
                    <div className="flex gap-2">
                      <select
                        value={formData.cartao_taxa_resgate_tipo}
                        onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_resgate_tipo: e.target.value as 'debito' | 'credito' | '', cartao_taxa_resgate_parcelas: 1 }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Tipo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                      </select>
                      {formData.cartao_taxa_resgate_tipo === 'credito' && (
                        <select
                          value={formData.cartao_taxa_resgate_parcelas}
                          onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_resgate_parcelas: Number(e.target.value) }))}
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}x</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor Total Vendas</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={calcularValorTotalVendas().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      readOnly
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dt Voo Ida</label>
                  <input
                    type="date"
                    value={formData.data_voo_ida}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_voo_ida: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dt Voo Volta</label>
                  <input
                    type="date"
                    value={formData.data_voo_volta}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_voo_volta: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Passageiro</label>
                  <input
                    type="text"
                    value={formData.nome_passageiro}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome_passageiro: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Qte Passageiro</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantidade_passageiros}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantidade_passageiros: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contagem de Passageiro</label>
                  <input
                    type="text"
                    value={formData.quantidade_passageiros}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Trecho</label>
                  <input
                    type="text"
                    value={formData.trecho}
                    onChange={(e) => setFormData(prev => ({ ...prev, trecho: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: GRU-MIA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarifa Diamante</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.tarifa_diamante || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, tarifa_diamante: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Milhas Bonus</label>
                  <input
                    type="text"
                    value={formData.milhas_bonus ? formData.milhas_bonus.toLocaleString('pt-BR') : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData(prev => ({ ...prev, milhas_bonus: Number(value) }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comissões</label>
                  {comissaoInfo.tem_comissao ? (
                    <div className="px-3 py-2 border border-blue-200 rounded-lg bg-blue-50 text-sm font-medium text-blue-800">
                      {comissaoInfo.tipo === 'porcentagem'
                        ? `${comissaoInfo.valor}%`
                        : formatCurrency(comissaoInfo.valor)}
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400">R$</span>
                      <input
                        type="text"
                        value="0,00"
                        readOnly
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-400"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custo Milheiro</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={formatCurrency(custoMedio)}
                      readOnly
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custo Emissão</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={rawCustoEmissao}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9,]/g, '');
                        custoEmissaoManual.current = true;
                        setRawCustoEmissao(val);
                        setFormData(prev => ({ ...prev, custo_emissao: parseFloat(val.replace(',', '.')) || 0 }));
                      }}
                      onBlur={() => {
                        if (formData.custo_emissao) setRawCustoEmissao(formatNumberDisplay(formData.custo_emissao));
                      }}
                      onFocus={() => {
                        setRawCustoEmissao(formData.custo_emissao ? String(formData.custo_emissao).replace('.', ',') : '');
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Emissor</label>
                  <select
                    value={formData.emissor}
                    onChange={(e) => setFormData(prev => ({ ...prev, emissor: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.nome}>{u.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data de Vencimento</label>
                  <input
                    type="date"
                    value={formData.data_vencimento_venda}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_vencimento_venda: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observação</label>
              <textarea
                value={formData.observacao}
                onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <VendaLoteModal
        isOpen={showLoteModal}
        onClose={() => setShowLoteModal(false)}
        onSuccess={() => {
          setDialogConfig({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Venda por lote cadastrada com sucesso!' });
          fetchData();
        }}
        parceiros={parceiros}
        clientes={clientes}
        cartoes={cartoes}
        usuarios={usuarios}
      />

      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onConfirm={dialogConfig.onConfirm}
        onClose={() => setDialogConfig({ isOpen: false })}
      />
    </div>
  );
}
