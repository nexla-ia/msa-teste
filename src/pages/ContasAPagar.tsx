import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, DollarSign, TrendingDown, AlertCircle, Calendar,
  CheckCircle, X, SlidersHorizontal, ChevronDown, ChevronUp,
  CreditCard, Clock, ChevronRight, ChevronLeft
} from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import ConfirmDialog from '../components/ConfirmDialog';

type ContaPagar = {
  id: string;
  origem_tipo: string;
  origem_id: string;
  parceiro_id: string | null;
  programa_id: string | null;
  descricao: string;
  data_vencimento: string;
  valor_parcela: number;
  numero_parcela: number;
  total_parcelas: number;
  forma_pagamento: string | null;
  cartao_id: string | null;
  conta_bancaria_id: string | null;
  status_pagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  data_pagamento: string | null;
  valor_pago: number | null;
  observacao: string | null;
  created_at: string;
  parceiro?: { nome_parceiro: string };
  programa?: { nome: string };
  cartao?: { cartao: string; banco_emissor?: string };
  conta_bancaria?: { nome_banco: string };
  criado_por?: { nome: string };
};

type FaturaGroup = {
  key: string;
  cartaoNome: string;
  cartaoId: string | null;
  mesAno: string;
  contas: ContaPagar[];
  totalPendente: number;
  totalPago: number;
  qtdPendente: number;
  status: 'paga' | 'parcial' | 'pendente' | 'vencida';
};

const hoje = () => new Date(new Date().toDateString());

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseBRL = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;

export default function ContasAPagar() {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<'faturas' | 'lista'>('faturas');
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // lista
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPagamento, setFiltroPagamento] = useState('');
  const [filtroVencDe, setFiltroVencDe] = useState('');
  const [filtroVencAte, setFiltroVencAte] = useState('');
  const [filtroGeradoDe, setFiltroGeradoDe] = useState('');
  const [filtroGeradoAte, setFiltroGeradoAte] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);

  // pagar parcela individual
  const [contaSelecionada, setContaSelecionada] = useState<ContaPagar | null>(null);
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [valorPagamento, setValorPagamento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');

  // pagar fatura inteira
  const [faturaParaPagar, setFaturaParaPagar] = useState<FaturaGroup | null>(null);
  const [showPagarFaturaModal, setShowPagarFaturaModal] = useState(false);
  const [valorFatura, setValorFatura] = useState('');
  const [dataFatura, setDataFatura] = useState('');

  // faturas expandidas
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; type: 'success' | 'error'; title: string; message: string;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  useEffect(() => { carregarContas(); }, []);

  const carregarContas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contas_a_pagar')
        .select(`
          *,
          parceiro:parceiros(nome_parceiro),
          programa:programas_fidelidade(nome),
          cartao:cartoes_credito(cartao, banco_emissor),
          conta_bancaria:contas_bancarias(nome_banco),
          criado_por:usuarios!contas_a_pagar_created_by_fkey(nome)
        `)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      setContas(data || []);
    } catch {
      showError('Erro ao carregar contas a pagar.');
    } finally {
      setLoading(false);
    }
  };

  const showError = (msg: string) =>
    setConfirmDialog({ isOpen: true, type: 'error', title: 'Erro', message: msg });

  // ── agrupamento em faturas ──────────────────────────────────────────────
  const calcularFaturas = (): FaturaGroup[] => {
    const map = new Map<string, ContaPagar[]>();
    contas.filter(c => c.status_pagamento !== 'cancelado').forEach(c => {
      const mesAno = c.data_vencimento.substring(0, 7);
      const cartaoKey = c.cartao_id || 'sem-cartao';
      const key = `${cartaoKey}_${mesAno}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });

    const faturas: FaturaGroup[] = [];
    map.forEach((items, key) => {
      const first = items[0];
      const mesAno = first.data_vencimento.substring(0, 7);
      const totalPendente = items
        .filter(c => c.status_pagamento === 'pendente')
        .reduce((s, c) => s + c.valor_parcela, 0);
      const totalPago = items
        .filter(c => c.status_pagamento === 'pago')
        .reduce((s, c) => s + (c.valor_pago || 0), 0);
      const qtdPendente = items.filter(c => c.status_pagamento === 'pendente').length;
      const vencidas = items.some(
        c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) < hoje()
      );

      let status: FaturaGroup['status'] = 'pendente';
      if (qtdPendente === 0) status = 'paga';
      else if (vencidas) status = 'vencida';
      else if (totalPago > 0) status = 'parcial';

      const cartaoNome = first.cartao?.cartao
        ? `${first.cartao.cartao}${first.cartao.banco_emissor ? ` · ${first.cartao.banco_emissor}` : ''}`
        : first.forma_pagamento || 'Sem cartão';

      faturas.push({ key, cartaoNome, cartaoId: first.cartao_id, mesAno, contas: items, totalPendente, totalPago, qtdPendente, status });
    });

    return faturas.sort((a, b) => a.mesAno.localeCompare(b.mesAno));
  };

  const faturas = calcularFaturas();

  const toggleExpand = (key: string) => {
    setExpandidas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── pagamento parcela individual ────────────────────────────────────────
  const abrirModalPagar = (conta: ContaPagar) => {
    setContaSelecionada(conta);
    setValorPagamento(formatBRL(conta.valor_parcela));
    setDataPagamento(new Date().toISOString().split('T')[0]);
    setShowPagarModal(true);
  };

  const registrarPagamento = async () => {
    if (!contaSelecionada) return;
    try {
      const { error } = await supabase
        .from('contas_a_pagar')
        .update({ status_pagamento: 'pago', data_pagamento: dataPagamento, valor_pago: parseBRL(valorPagamento) })
        .eq('id', contaSelecionada.id);
      if (error) throw error;
      setShowPagarModal(false);
      setConfirmDialog({ isOpen: true, type: 'success', title: 'Pagamento Registrado', message: 'Pagamento registrado com sucesso!' });
      await carregarContas();
    } catch {
      showError('Erro ao registrar pagamento.');
    }
  };

  // ── pagamento fatura inteira ────────────────────────────────────────────
  const abrirModalFatura = (fatura: FaturaGroup) => {
    setFaturaParaPagar(fatura);
    setValorFatura(formatBRL(fatura.totalPendente));
    setDataFatura(new Date().toISOString().split('T')[0]);
    setShowPagarFaturaModal(true);
  };

  const registrarPagamentoFatura = async () => {
    if (!faturaParaPagar) return;
    try {
      const pendentes = faturaParaPagar.contas.filter(c => c.status_pagamento === 'pendente');
      const valorTotal = faturaParaPagar.totalPendente;
      const valorInformado = parseBRL(valorFatura);
      const proporcao = valorTotal > 0 ? valorInformado / valorTotal : 1;

      const updates = pendentes.map(c =>
        supabase.from('contas_a_pagar').update({
          status_pagamento: 'pago',
          data_pagamento: dataFatura,
          valor_pago: parseFloat((c.valor_parcela * proporcao).toFixed(2))
        }).eq('id', c.id)
      );

      await Promise.all(updates);
      setShowPagarFaturaModal(false);
      setConfirmDialog({ isOpen: true, type: 'success', title: 'Fatura Paga', message: `${pendentes.length} parcela(s) marcadas como pagas!` });
      await carregarContas();
    } catch {
      showError('Erro ao registrar pagamento da fatura.');
    }
  };

  const cancelarConta = async (id: string) => {
    try {
      await supabase.from('contas_a_pagar').update({ status_pagamento: 'cancelado' }).eq('id', id);
      setConfirmDialog({ isOpen: true, type: 'success', title: 'Conta Cancelada', message: 'Conta cancelada com sucesso!' });
      await carregarContas();
    } catch {
      showError('Erro ao cancelar conta.');
    }
  };

  // ── filtros lista ───────────────────────────────────────────────────────
  const formasPagamento = [...new Set(contas.map(c => c.forma_pagamento).filter(Boolean))] as string[];

  const contasFiltradas = contas.filter(conta => {
    if (busca) {
      const q = busca.toLowerCase();
      const match =
        conta.descricao.toLowerCase().includes(q) ||
        conta.parceiro?.nome_parceiro?.toLowerCase().includes(q) ||
        conta.programa?.nome?.toLowerCase().includes(q) ||
        conta.forma_pagamento?.toLowerCase().includes(q) ||
        conta.cartao?.cartao?.toLowerCase().includes(q) ||
        conta.criado_por?.nome?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filtroStatus && conta.status_pagamento !== filtroStatus) return false;
    if (filtroTipo && conta.origem_tipo !== filtroTipo) return false;
    if (filtroPagamento && conta.forma_pagamento !== filtroPagamento) return false;
    if (filtroVencDe && conta.data_vencimento < filtroVencDe) return false;
    if (filtroVencAte && conta.data_vencimento > filtroVencAte) return false;
    if (filtroGeradoDe && conta.created_at.split('T')[0] < filtroGeradoDe) return false;
    if (filtroGeradoAte && conta.created_at.split('T')[0] > filtroGeradoAte) return false;
    return true;
  });

  const filtrosAtivos = [filtroStatus, filtroTipo, filtroPagamento, filtroVencDe, filtroVencAte, filtroGeradoDe, filtroGeradoAte].filter(Boolean).length;
  const limparFiltros = () => { setFiltroStatus(''); setFiltroTipo(''); setFiltroPagamento(''); setFiltroVencDe(''); setFiltroVencAte(''); setFiltroGeradoDe(''); setFiltroGeradoAte(''); };

  // ── KPIs ────────────────────────────────────────────────────────────────
  const totalPendente = contas.filter(c => c.status_pagamento === 'pendente').reduce((s, c) => s + c.valor_parcela, 0);
  const totalPago = contas.filter(c => c.status_pagamento === 'pago').reduce((s, c) => s + (c.valor_pago || 0), 0);
  const totalVencido = contas.filter(c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) < hoje()).reduce((s, c) => s + c.valor_parcela, 0);
  const proximos7 = (() => {
    const limite = new Date(); limite.setDate(limite.getDate() + 7);
    return contas.filter(c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) <= limite && new Date(c.data_vencimento) >= hoje()).reduce((s, c) => s + c.valor_parcela, 0);
  })();

  // ── helpers ─────────────────────────────────────────────────────────────
  const getStatusConta = (conta: ContaPagar) => {
    if (conta.status_pagamento === 'pago') return { label: 'Pago', color: 'bg-green-100 text-green-800' };
    if (conta.status_pagamento === 'cancelado') return { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' };
    if (new Date(conta.data_vencimento) < hoje()) return { label: 'Vencido', color: 'bg-red-100 text-red-800' };
    return { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' };
  };

  const getFaturaStatusStyle = (status: FaturaGroup['status']) => {
    if (status === 'paga') return { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', border: 'border-l-emerald-400', label: 'Paga' };
    if (status === 'vencida') return { badge: 'bg-red-100 text-red-700 border border-red-200', border: 'border-l-red-400', label: 'Vencida' };
    if (status === 'parcial') return { badge: 'bg-blue-100 text-blue-700 border border-blue-200', border: 'border-l-blue-400', label: 'Parcial' };
    return { badge: 'bg-amber-100 text-amber-700 border border-amber-200', border: 'border-l-amber-400', label: 'Pendente' };
  };

  const formatMesAno = (mesAno: string) => {
    const [ano, mes] = mesAno.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(mes) - 1]}/${ano}`;
  };

  const getTipoOrigemLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      compra: 'Compra de Pontos', compra_bonificada: 'Compra Bonificada',
      clube: 'Mensalidade Clube', transferencia_pontos: 'Transferência',
      ajuste: 'Ajuste', outro: 'Outro', venda: 'Venda'
    };
    return tipos[tipo] || tipo;
  };

  const formatDescricao = (desc: string) =>
    desc.replace(/([\d]+(?:\.\d+)?)\s*pontos\/milhas/g, (_, num) =>
      `${parseFloat(num).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} pontos/milhas`);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Contas a Pagar</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie suas contas a pagar e faturas de cartão</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">A Pagar</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalPendente)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{contas.filter(c => c.status_pagamento === 'pendente').length} parcelas pendentes</p>
            </div>
            <div className="bg-red-50 p-3 rounded-xl"><DollarSign className="w-5 h-5 text-red-500" /></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Pago</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPago)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{contas.filter(c => c.status_pagamento === 'pago').length} parcelas pagas</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl"><TrendingDown className="w-5 h-5 text-emerald-500" /></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vencido</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalVencido)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{contas.filter(c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) < hoje()).length} em atraso</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-xl"><AlertCircle className="w-5 h-5 text-orange-500" /></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Próximos 7 dias</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(proximos7)}</p>
              <p className="text-xs text-slate-400 mt-0.5">vencendo em breve</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl"><Clock className="w-5 h-5 text-blue-500" /></div>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setAba('faturas')}
            className={`px-6 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${aba === 'faturas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Por Fatura</span>
          </button>
          <button
            onClick={() => setAba('lista')}
            className={`px-6 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${aba === 'lista' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-2"><Calendar className="w-4 h-4" />Lista Detalhada</span>
          </button>
        </div>

        {/* ── ABA: POR FATURA ── */}
        {aba === 'faturas' && (() => {
          // meses disponíveis (com ou sem dados) — sempre mostra ±3 ao redor do atual
          const mesesComDados = [...new Set(faturas.map(f => f.mesAno))].sort();
          const gerarMeses = () => {
            const set = new Set(mesesComDados);
            // garante que o mês selecionado e vizinhos existam
            const [y, m] = mesSelecionado.split('-').map(Number);
            for (let d = -2; d <= 3; d++) {
              const dt = new Date(y, m - 1 + d, 1);
              set.add(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
            }
            return [...set].sort();
          };
          const todosMeses = gerarMeses();
          const idxAtual = todosMeses.indexOf(mesSelecionado);

          const navMes = (dir: 1 | -1) => {
            const novIdx = idxAtual + dir;
            if (novIdx >= 0 && novIdx < todosMeses.length) setMesSelecionado(todosMeses[novIdx]);
          };

          const faturasMes = faturas.filter(f => f.mesAno === mesSelecionado);
          const totalMesPendente = faturasMes.reduce((s, f) => s + f.totalPendente, 0);
          const totalMesPago = faturasMes.reduce((s, f) => s + f.totalPago, 0);
          const totalMesVencido = faturasMes.filter(f => f.status === 'vencida').reduce((s, f) => s + f.totalPendente, 0);

          const totalPorMes = (mes: string) =>
            faturas.filter(f => f.mesAno === mes).reduce((s, f) => s + f.totalPendente + f.totalPago, 0);

          return (
          <div className="space-y-0">
            {/* Navegação de meses — pills scrolláveis */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navMes(-1)}
                  disabled={idxAtual === 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex gap-1.5 overflow-x-auto flex-1 scrollbar-hide pb-0.5">
                  {todosMeses.map(mes => {
                    const total = totalPorMes(mes);
                    const temDados = mesesComDados.includes(mes);
                    const isSelected = mes === mesSelecionado;
                    return (
                      <button
                        key={mes}
                        onClick={() => setMesSelecionado(mes)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : temDados
                            ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        <span className="block">{formatMesAno(mes)}</span>
                        {temDados && (
                          <span className={`block text-[10px] mt-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                            {formatCurrency(total)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => navMes(1)}
                  disabled={idxAtual === todosMeses.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Resumo do mês */}
            {faturasMes.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4">
                <div>
                  <p className="text-xs text-slate-500">Pendente no mês</p>
                  <p className="text-base font-bold text-slate-800">{formatCurrency(totalMesPendente)}</p>
                </div>
                {totalMesPago > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Já pago</p>
                    <p className="text-base font-bold text-emerald-600">{formatCurrency(totalMesPago)}</p>
                  </div>
                )}
                {totalMesVencido > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Vencido</p>
                    <p className="text-base font-bold text-red-600">{formatCurrency(totalMesVencido)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500">Cartões</p>
                  <p className="text-base font-bold text-slate-700">{faturasMes.length}</p>
                </div>
              </div>
            )}

            {/* Faturas do mês */}
            <div className="p-4 space-y-3">
            {faturasMes.length === 0 && (
              <div className="text-center py-12 text-slate-400">Nenhuma fatura em {formatMesAno(mesSelecionado)}</div>
            )}
            {faturasMes.map(fatura => {
              const style = getFaturaStatusStyle(fatura.status);
              const expanded = expandidas.has(fatura.key);
              return (
                <div key={fatura.key} className={`border border-slate-200 border-l-4 ${style.border} rounded-lg overflow-hidden`}>
                  {/* Cabeçalho da fatura */}
                  <div
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => toggleExpand(fatura.key)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="bg-slate-100 p-2 rounded-lg flex-shrink-0">
                        <CreditCard className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{fatura.cartaoNome}</p>
                        <p className="text-xs text-slate-500">{formatMesAno(fatura.mesAno)} · {fatura.contas.length} parcela(s)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      {fatura.totalPago > 0 && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-slate-400">Pago</p>
                          <p className="text-sm font-semibold text-emerald-600">{formatCurrency(fatura.totalPago)}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Pendente</p>
                        <p className={`text-base font-bold ${fatura.status === 'vencida' ? 'text-red-600' : fatura.totalPendente > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                          {formatCurrency(fatura.totalPendente)}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${style.badge} hidden sm:inline-flex`}>
                        {style.label}
                      </span>
                      {fatura.status !== 'paga' && fatura.qtdPendente > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); abrirModalFatura(fatura); }}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          Pagar Fatura
                        </button>
                      )}
                      {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Itens da fatura */}
                  {expanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {fatura.contas.map(conta => {
                        const st = getStatusConta(conta);
                        return (
                          <div key={conta.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <ChevronRight className="w-3 h-3 text-slate-400 mt-1 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{formatDescricao(conta.descricao)}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs text-slate-400">{getTipoOrigemLabel(conta.origem_tipo)}</span>
                                  {conta.parceiro && <span className="text-xs text-slate-400">· {conta.parceiro.nome_parceiro}</span>}
                                  {conta.programa && <span className="text-xs text-slate-400">· {conta.programa.nome}</span>}
                                  <span className="text-xs text-slate-400">· Parcela {conta.numero_parcela}/{conta.total_parcelas}</span>
                                  <span className="text-xs text-slate-400">· Venc. {new Date(conta.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                </div>
                                {conta.status_pagamento === 'pago' && conta.data_pagamento && (
                                  <p className="text-xs text-emerald-600 mt-0.5">Pago em {new Date(conta.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')} · {formatCurrency(conta.valor_pago || 0)}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                              <p className="text-sm font-semibold text-slate-800">{formatCurrency(conta.valor_parcela)}</p>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${st.color}`}>{st.label}</span>
                              {conta.status_pagamento === 'pendente' && (
                                <div className="flex gap-1">
                                  <button onClick={() => abrirModalPagar(conta)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Registrar pagamento">
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => cancelarConta(conta.id)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Cancelar">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
          );
        })()}

        {/* ── ABA: LISTA ── */}
        {aba === 'lista' && (
          <>
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por descrição, parceiro, programa, cartão..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowFiltros(v => !v)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${showFiltros ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filtros
                  {filtrosAtivos > 0 && <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{filtrosAtivos}</span>}
                  {showFiltros ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {showFiltros && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                      <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                      <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Todos</option>
                        <option value="compra">Compra de Pontos</option>
                        <option value="compra_bonificada">Compra Bonificada</option>
                        <option value="clube">Mensalidade Clube</option>
                        <option value="transferencia_pontos">Transferência</option>
                        <option value="venda">Venda</option>
                        <option value="ajuste">Ajuste</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Forma de Pagamento</label>
                      <select value={filtroPagamento} onChange={e => setFiltroPagamento(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Todas</option>
                        {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento de</label>
                      <input type="date" value={filtroVencDe} onChange={e => setFiltroVencDe(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento até</label>
                      <input type="date" value={filtroVencAte} onChange={e => setFiltroVencAte(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Gerado de</label>
                      <input type="date" value={filtroGeradoDe} onChange={e => setFiltroGeradoDe(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Gerado até</label>
                      <input type="date" value={filtroGeradoAte} onChange={e => setFiltroGeradoAte(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  {filtrosAtivos > 0 && (
                    <div className="flex justify-end">
                      <button onClick={limparFiltros} className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1">
                        <X className="w-3 h-3" /> Limpar filtros
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Tipo', 'Descrição', 'Vencimento', 'Valor', 'Parcela', 'Pagamento', 'Status', 'Gerado em / Por', 'Ações'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {contasFiltradas.map(conta => {
                    const status = getStatusConta(conta);
                    return (
                      <tr key={conta.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-700">{getTipoOrigemLabel(conta.origem_tipo)}</td>
                        <td className="px-5 py-4 text-sm">
                          <div className="max-w-xs">
                            <p className="font-medium text-slate-800 truncate">{formatDescricao(conta.descricao)}</p>
                            {conta.parceiro && <p className="text-xs text-slate-500">{conta.parceiro.nome_parceiro}</p>}
                            {conta.programa && <p className="text-xs text-slate-500">{conta.programa.nome}</p>}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-700">
                          {new Date(conta.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{formatCurrency(conta.valor_parcela)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">{conta.numero_parcela}/{conta.total_parcelas}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <p>{conta.forma_pagamento || '-'}</p>
                          {conta.cartao && <p className="text-xs text-slate-400">{conta.cartao.cartao}</p>}
                          {conta.conta_bancaria && <p className="text-xs text-slate-400">{conta.conta_bancaria.nome_banco}</p>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>{status.label}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          <p>{new Date(conta.created_at).toLocaleDateString('pt-BR')}</p>
                          <p className="text-xs text-slate-400">{new Date(conta.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                          {conta.criado_por?.nome && <p className="text-xs text-slate-400">{conta.criado_por.nome}</p>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {conta.status_pagamento === 'pendente' && (
                            <div className="flex gap-1.5">
                              <button onClick={() => abrirModalPagar(conta)} className="text-emerald-600 hover:text-emerald-800 p-1 rounded hover:bg-emerald-50" title="Registrar Pagamento">
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button onClick={() => cancelarConta(conta.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" title="Cancelar">
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                          {conta.status_pagamento === 'pago' && conta.data_pagamento && (
                            <p className="text-xs text-slate-500">Pago em: {new Date(conta.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {contasFiltradas.length === 0 && <div className="text-center py-12 text-slate-400">Nenhuma conta encontrada</div>}
            </div>
          </>
        )}
      </div>

      {/* Modal: Pagar Parcela Individual */}
      {showPagarModal && contaSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Registrar Pagamento</h2>
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">{formatDescricao(contaSelecionada.descricao)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Parcela {contaSelecionada.numero_parcela}/{contaSelecionada.total_parcelas} · Venc. {new Date(contaSelecionada.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Original</label>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(contaSelecionada.valor_parcela)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Pago *</label>
                <input type="text" value={valorPagamento} onChange={e => setValorPagamento(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data do Pagamento *</label>
                <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPagarModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={registrarPagamento} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pagar Fatura Inteira */}
      {showPagarFaturaModal && faturaParaPagar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Pagar Fatura</h2>
            <p className="text-sm text-slate-500 mb-4">{faturaParaPagar.cartaoNome} · {formatMesAno(faturaParaPagar.mesAno)}</p>

            {/* Itens da fatura */}
            <div className="bg-slate-50 rounded-lg divide-y divide-slate-200 mb-4 max-h-52 overflow-y-auto">
              {faturaParaPagar.contas.filter(c => c.status_pagamento === 'pendente').map(c => (
                <div key={c.id} className="flex justify-between items-center px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-slate-700 truncate max-w-xs">{formatDescricao(c.descricao)}</p>
                    <p className="text-xs text-slate-400">Parc. {c.numero_parcela}/{c.total_parcelas} · Venc. {new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 ml-3">{formatCurrency(c.valor_parcela)}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mb-4 px-1">
              <p className="text-sm font-medium text-slate-600">{faturaParaPagar.qtdPendente} parcela(s) pendente(s)</p>
              <p className="text-base font-bold text-slate-800">Total: {formatCurrency(faturaParaPagar.totalPendente)}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Pago *</label>
                <input type="text" value={valorFatura} onChange={e => setValorFatura(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                {parseBRL(valorFatura) < faturaParaPagar.totalPendente && parseBRL(valorFatura) > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Valor menor que o total — será distribuído proporcionalmente entre as parcelas.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data do Pagamento *</label>
                <input type="date" value={dataFatura} onChange={e => setDataFatura(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPagarFaturaModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={registrarPagamentoFatura} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Confirmar Pagamento</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        type={confirmDialog.type}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
