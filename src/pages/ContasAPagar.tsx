import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, DollarSign, TrendingDown, AlertCircle,
  CheckCircle, X, SlidersHorizontal, ChevronDown, ChevronUp,
  CreditCard, Clock, Calendar
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

type MesResumo = {
  mesAno: string;
  total: number;
  totalPago: number;
  count: number;
  pctLiquidado: number;
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

  // detalhes (aba faturas)
  const [detalheStatus, setDetalheStatus] = useState('');
  const [detalheForma, setDetalheForma] = useState('');
  const [detalheCartao, setDetalheCartao] = useState('');
  const [detalheBusca, setDetalheBusca] = useState('');

  // pagar parcela individual
  const [contaSelecionada, setContaSelecionada] = useState<ContaPagar | null>(null);
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [valorPagamento, setValorPagamento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');

  // pagar fatura (cartão)
  const [faturaParaPagar, setFaturaParaPagar] = useState<FaturaGroup | null>(null);
  const [showPagarFaturaModal, setShowPagarFaturaModal] = useState(false);
  const [valorFatura, setValorFatura] = useState('');
  const [dataFatura, setDataFatura] = useState('');

  // expandir fatura
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

  // ── meses resumo ────────────────────────────────────────────────────────
  const calcularMeses = (): MesResumo[] => {
    const map = new Map<string, { total: number; totalPago: number; count: number }>();
    contas.filter(c => c.status_pagamento !== 'cancelado').forEach(c => {
      const mes = c.data_vencimento.substring(0, 7);
      const cur = map.get(mes) || { total: 0, totalPago: 0, count: 0 };
      cur.total += c.valor_parcela;
      cur.count += 1;
      if (c.status_pagamento === 'pago') cur.totalPago += c.valor_pago || 0;
      map.set(mes, cur);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mesAno, d]) => ({
        mesAno,
        total: d.total,
        totalPago: d.totalPago,
        count: d.count,
        pctLiquidado: d.total > 0 ? Math.round((d.totalPago / d.total) * 100) : 0,
      }));
  };

  // ── faturas (por cartão dentro do mês) ─────────────────────────────────
  const calcularFaturas = (mes: string): FaturaGroup[] => {
    const map = new Map<string, ContaPagar[]>();
    contas.filter(c => c.status_pagamento !== 'cancelado' && c.data_vencimento.startsWith(mes))
      .forEach(c => {
        const key = c.cartao_id || 'sem-cartao';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      });

    return [...map.entries()].map(([, items]) => {
      const first = items[0];
      const totalPendente = items.filter(c => c.status_pagamento === 'pendente').reduce((s, c) => s + c.valor_parcela, 0);
      const totalPago = items.filter(c => c.status_pagamento === 'pago').reduce((s, c) => s + (c.valor_pago || 0), 0);
      const qtdPendente = items.filter(c => c.status_pagamento === 'pendente').length;
      const vencidas = items.some(c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) < hoje());
      let status: FaturaGroup['status'] = 'pendente';
      if (qtdPendente === 0) status = 'paga';
      else if (vencidas) status = 'vencida';
      else if (totalPago > 0) status = 'parcial';
      const cartaoNome = first.cartao?.cartao
        ? `${first.cartao.cartao}${first.cartao.banco_emissor ? ` · ${first.cartao.banco_emissor}` : ''}`
        : first.forma_pagamento || 'Sem cartão';
      return {
        key: first.cartao_id || 'sem-cartao',
        cartaoNome, cartaoId: first.cartao_id, mesAno: mes,
        contas: items, totalPendente, totalPago, qtdPendente, status,
      };
    }).sort((a, b) => b.totalPendente - a.totalPendente);
  };

  // ── itens detalhados do mês selecionado ────────────────────────────────
  const contasDoMes = contas.filter(c =>
    c.data_vencimento.startsWith(mesSelecionado) && c.status_pagamento !== 'cancelado'
  );

  const contasDetalhe = contasDoMes.filter(c => {
    if (detalheStatus) {
      const efStatus = c.status_pagamento === 'pago' ? 'pago'
        : new Date(c.data_vencimento) < hoje() ? 'vencido' : 'pendente';
      if (efStatus !== detalheStatus) return false;
    }
    if (detalheForma && c.forma_pagamento !== detalheForma) return false;
    if (detalheCartao && (c.cartao?.cartao || '') !== detalheCartao) return false;
    if (detalheBusca) {
      const q = detalheBusca.toLowerCase();
      if (!c.descricao.toLowerCase().includes(q) &&
        !(c.parceiro?.nome_parceiro || '').toLowerCase().includes(q) &&
        !(c.cartao?.cartao || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const formasDoMes = [...new Set(contasDoMes.map(c => c.forma_pagamento).filter(Boolean))] as string[];
  const cartoesDoMes = [...new Set(contasDoMes.map(c => c.cartao?.cartao).filter(Boolean))] as string[];

  // ── pagamento parcela ───────────────────────────────────────────────────
  const abrirModalPagar = (conta: ContaPagar) => {
    setContaSelecionada(conta);
    setValorPagamento(formatBRL(conta.valor_parcela));
    setDataPagamento(new Date().toISOString().split('T')[0]);
    setShowPagarModal(true);
  };

  const registrarPagamento = async () => {
    if (!contaSelecionada) return;
    try {
      const { error } = await supabase.from('contas_a_pagar')
        .update({ status_pagamento: 'pago', data_pagamento: dataPagamento, valor_pago: parseBRL(valorPagamento) })
        .eq('id', contaSelecionada.id);
      if (error) throw error;
      setShowPagarModal(false);
      setConfirmDialog({ isOpen: true, type: 'success', title: 'Pagamento Registrado', message: 'Pagamento registrado com sucesso!' });
      await carregarContas();
    } catch { showError('Erro ao registrar pagamento.'); }
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
      const valorInformado = parseBRL(valorFatura);
      const proporcao = faturaParaPagar.totalPendente > 0 ? valorInformado / faturaParaPagar.totalPendente : 1;
      await Promise.all(pendentes.map(c =>
        supabase.from('contas_a_pagar').update({
          status_pagamento: 'pago',
          data_pagamento: dataFatura,
          valor_pago: parseFloat((c.valor_parcela * proporcao).toFixed(2))
        }).eq('id', c.id)
      ));
      setShowPagarFaturaModal(false);
      setConfirmDialog({ isOpen: true, type: 'success', title: 'Fatura Paga', message: `${pendentes.length} parcela(s) marcadas como pagas!` });
      await carregarContas();
    } catch { showError('Erro ao registrar pagamento da fatura.'); }
  };

  const cancelarConta = async (id: string) => {
    try {
      await supabase.from('contas_a_pagar').update({ status_pagamento: 'cancelado' }).eq('id', id);
      setConfirmDialog({ isOpen: true, type: 'success', title: 'Conta Cancelada', message: 'Conta cancelada com sucesso!' });
      await carregarContas();
    } catch { showError('Erro ao cancelar conta.'); }
  };

  const toggleExpand = (key: string) => {
    setExpandidas(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  // ── KPIs globais ────────────────────────────────────────────────────────
  const formasPagamento = [...new Set(contas.map(c => c.forma_pagamento).filter(Boolean))] as string[];
  const contasFiltradas = contas.filter(c => {
    if (busca) {
      const q = busca.toLowerCase();
      if (!c.descricao.toLowerCase().includes(q) &&
        !(c.parceiro?.nome_parceiro || '').toLowerCase().includes(q) &&
        !(c.programa?.nome || '').toLowerCase().includes(q) &&
        !(c.forma_pagamento || '').toLowerCase().includes(q) &&
        !(c.cartao?.cartao || '').toLowerCase().includes(q) &&
        !(c.criado_por?.nome || '').toLowerCase().includes(q)) return false;
    }
    if (filtroStatus && c.status_pagamento !== filtroStatus) return false;
    if (filtroTipo && c.origem_tipo !== filtroTipo) return false;
    if (filtroPagamento && c.forma_pagamento !== filtroPagamento) return false;
    if (filtroVencDe && c.data_vencimento < filtroVencDe) return false;
    if (filtroVencAte && c.data_vencimento > filtroVencAte) return false;
    if (filtroGeradoDe && c.created_at.split('T')[0] < filtroGeradoDe) return false;
    if (filtroGeradoAte && c.created_at.split('T')[0] > filtroGeradoAte) return false;
    return true;
  });
  const filtrosAtivos = [filtroStatus, filtroTipo, filtroPagamento, filtroVencDe, filtroVencAte, filtroGeradoDe, filtroGeradoAte].filter(Boolean).length;
  const limparFiltros = () => { setFiltroStatus(''); setFiltroTipo(''); setFiltroPagamento(''); setFiltroVencDe(''); setFiltroVencAte(''); setFiltroGeradoDe(''); setFiltroGeradoAte(''); };

  const totalPendente = contas.filter(c => c.status_pagamento === 'pendente').reduce((s, c) => s + c.valor_parcela, 0);
  const totalPago = contas.filter(c => c.status_pagamento === 'pago').reduce((s, c) => s + (c.valor_pago || 0), 0);
  const totalVencido = contas.filter(c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) < hoje()).reduce((s, c) => s + c.valor_parcela, 0);
  const proximos7 = (() => {
    const lim = new Date(); lim.setDate(lim.getDate() + 7);
    return contas.filter(c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) <= lim && new Date(c.data_vencimento) >= hoje()).reduce((s, c) => s + c.valor_parcela, 0);
  })();

  // ── helpers ─────────────────────────────────────────────────────────────
  const getStatusConta = (conta: ContaPagar) => {
    if (conta.status_pagamento === 'pago') return { label: 'Pago', color: 'bg-emerald-100 text-emerald-700' };
    if (conta.status_pagamento === 'cancelado') return { label: 'Cancelado', color: 'bg-slate-100 text-slate-600' };
    if (new Date(conta.data_vencimento) < hoje()) return { label: 'Vencido', color: 'bg-red-100 text-red-700' };
    return { label: 'Pendente', color: 'bg-amber-100 text-amber-700' };
  };

  const getFaturaStyle = (status: FaturaGroup['status']) => {
    if (status === 'paga') return { border: 'border-l-emerald-400', badge: 'bg-emerald-100 text-emerald-700', label: 'Paga' };
    if (status === 'vencida') return { border: 'border-l-red-400', badge: 'bg-red-100 text-red-700', label: 'Vencida' };
    if (status === 'parcial') return { border: 'border-l-blue-400', badge: 'bg-blue-100 text-blue-700', label: 'Parcial' };
    return { border: 'border-l-amber-400', badge: 'bg-amber-100 text-amber-700', label: 'Pendente' };
  };

  const formatMesAno = (mesAno: string) => {
    const [ano, mes] = mesAno.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${meses[parseInt(mes) - 1]} ${ano}`;
  };

  const getTipoLabel = (tipo: string) => ({
    compra: 'compra', compra_bonificada: 'bonificada', clube: 'clube',
    transferencia_pontos: 'transferência', ajuste: 'ajuste', outro: 'outro', venda: 'venda'
  }[tipo] || tipo);

  const formatDescricao = (desc: string) =>
    desc.replace(/([\d]+(?:\.\d+)?)\s*pontos\/milhas/g, (_, n) =>
      `${parseFloat(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} pts`);

  const mesAtual = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; })();
  const meses = calcularMeses();
  const faturasMes = calcularFaturas(mesSelecionado);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Contas a Pagar</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie suas contas a pagar e faturas de cartão</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'A Pagar', value: totalPendente, sub: `${contas.filter(c => c.status_pagamento === 'pendente').length} parcelas pendentes`, color: 'text-red-600', bg: 'bg-red-50', icon: <DollarSign className="w-5 h-5 text-red-500" /> },
          { label: 'Total Pago', value: totalPago, sub: `${contas.filter(c => c.status_pagamento === 'pago').length} parcelas pagas`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <TrendingDown className="w-5 h-5 text-emerald-500" /> },
          { label: 'Vencido', value: totalVencido, sub: `${contas.filter(c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) < hoje()).length} em atraso`, color: 'text-orange-600', bg: 'bg-orange-50', icon: <AlertCircle className="w-5 h-5 text-orange-500" /> },
          { label: 'Próximos 7 dias', value: proximos7, sub: 'vencendo em breve', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Clock className="w-5 h-5 text-blue-500" /> },
        ].map(k => (
          <div key={k.label} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${k.color}`}>{formatCurrency(k.value)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
              </div>
              <div className={`${k.bg} p-3 rounded-xl`}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-200">
          {([['faturas', CreditCard, 'Por Fatura'], ['lista', Calendar, 'Lista Detalhada']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setAba(id)}
              className={`px-6 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${aba === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ── POR FATURA ── */}
        {aba === 'faturas' && (
          <div className="p-5 space-y-5">

            {/* Grid de meses */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Faturas por Mês</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {meses.map(m => {
                  const isSelected = m.mesAno === mesSelecionado;
                  const isCurrent = m.mesAno === mesAtual;
                  const barW = Math.max(m.pctLiquidado, 2);
                  return (
                    <button
                      key={m.mesAno}
                      onClick={() => setMesSelecionado(m.mesAno)}
                      className={`text-left p-3 rounded-xl border-2 transition-all hover:shadow-md ${
                        isSelected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                          {formatMesAno(m.mesAno)}
                          {isCurrent && <Calendar className="inline w-3 h-3 ml-1 text-blue-400" />}
                        </span>
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>{m.count}</span>
                      </div>
                      <p className={`text-sm font-bold leading-tight ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                        {formatCurrency(m.total)}
                      </p>
                      {/* barra de progresso */}
                      <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${m.pctLiquidado === 100 ? 'bg-emerald-500' : m.pctLiquidado > 0 ? 'bg-blue-500' : 'bg-red-400'}`}
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                      <p className={`text-[10px] mt-1 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${m.pctLiquidado === 100 ? 'bg-emerald-500' : m.pctLiquidado > 0 ? 'bg-blue-400' : 'bg-red-400'}`} />
                        {m.pctLiquidado}% liquidado
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Faturas por cartão do mês */}
            {faturasMes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Cartões — {formatMesAno(mesSelecionado)}
                  </p>
                  <p className="text-sm font-semibold text-slate-600">
                    {formatCurrency(faturasMes.reduce((s, f) => s + f.totalPendente, 0))} pendente
                  </p>
                </div>
                <div className="space-y-2">
                  {faturasMes.map(fatura => {
                    const sty = getFaturaStyle(fatura.status);
                    const exp = expandidas.has(fatura.key);
                    return (
                      <div key={fatura.key} className={`border border-slate-200 border-l-4 ${sty.border} rounded-lg overflow-hidden`}>
                        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleExpand(fatura.key)}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="bg-slate-100 p-1.5 rounded-lg flex-shrink-0">
                              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{fatura.cartaoNome}</p>
                              <p className="text-xs text-slate-400">{fatura.contas.length} parcela(s)</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            {fatura.totalPago > 0 && (
                              <div className="text-right hidden sm:block">
                                <p className="text-[10px] text-slate-400">Pago</p>
                                <p className="text-xs font-semibold text-emerald-600">{formatCurrency(fatura.totalPago)}</p>
                              </div>
                            )}
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400">Pendente</p>
                              <p className={`text-sm font-bold ${fatura.status === 'vencida' ? 'text-red-600' : fatura.totalPendente > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                                {formatCurrency(fatura.totalPendente)}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${sty.badge} hidden sm:inline-block`}>{sty.label}</span>
                            {fatura.qtdPendente > 0 && (
                              <button onClick={e => { e.stopPropagation(); abrirModalFatura(fatura); }}
                                className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                                Pagar
                              </button>
                            )}
                            {exp ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>
                        {exp && (
                          <div className="border-t border-slate-100 divide-y divide-slate-100">
                            {fatura.contas.map(c => {
                              const st = getStatusConta(c);
                              return (
                                <div key={c.id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-slate-700 truncate">{formatDescricao(c.descricao)}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Parc. {c.numero_parcela}/{c.total_parcelas} · Venc. {new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                                      {c.parceiro && ` · ${c.parceiro.nome_parceiro}`}
                                    </p>
                                    {c.status_pagamento === 'pago' && c.data_pagamento && (
                                      <p className="text-[10px] text-emerald-600">Pago {new Date(c.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')} · {formatCurrency(c.valor_pago || 0)}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                    <p className="text-xs font-semibold text-slate-800">{formatCurrency(c.valor_parcela)}</p>
                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${st.color}`}>{st.label}</span>
                                    {c.status_pagamento === 'pendente' && (
                                      <div className="flex gap-0.5">
                                        <button onClick={() => abrirModalPagar(c)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => cancelarConta(c.id)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"><X className="w-3.5 h-3.5" /></button>
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
            )}

            {/* Tabela detalhada do mês */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Detalhes <span className="text-slate-600 font-bold text-sm normal-case">{contasDetalhe.length}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <select value={detalheStatus} onChange={e => setDetalheStatus(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Todos os status</option>
                    <option value="pendente">Pendente</option>
                    <option value="vencido">Vencido</option>
                    <option value="pago">Pago</option>
                  </select>
                  <select value={detalheForma} onChange={e => setDetalheForma(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Todas as formas</option>
                    {formasDoMes.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={detalheCartao} onChange={e => setDetalheCartao(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Todos os cartões</option>
                    {cartoesDoMes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input type="text" placeholder="Buscar descrição..." value={detalheBusca} onChange={e => setDetalheBusca(e.target.value)}
                      className="pl-6 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 w-40" />
                  </div>
                </div>
              </div>

              {contasDetalhe.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">Nenhum item encontrado</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['#', 'Descrição', 'Vencimento', 'Valor', 'Parcela', 'Forma Pgto', 'Status', 'Data Pgto', 'Valor Pago', 'Cartão', 'Origem', ''].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {contasDetalhe.map((c, idx) => {
                        const st = getStatusConta(c);
                        return (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2.5 max-w-[200px]">
                              <p className="font-medium text-slate-700 truncate">{formatDescricao(c.descricao)}</p>
                              {c.parceiro && <p className="text-slate-400 truncate">{c.parceiro.nome_parceiro}</p>}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800">{formatCurrency(c.valor_parcela)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{c.numero_parcela}/{c.total_parcelas}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{c.forma_pagamento || '—'}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                              {c.data_pagamento ? new Date(c.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                              {c.valor_pago != null ? formatCurrency(c.valor_pago) : '—'}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-500 max-w-[120px] truncate">{c.cartao?.cartao || '—'}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">{getTipoLabel(c.origem_tipo)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {c.status_pagamento === 'pendente' && (
                                <div className="flex gap-1">
                                  <button onClick={() => abrirModalPagar(c)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Pagar"><CheckCircle className="w-4 h-4" /></button>
                                  <button onClick={() => cancelarConta(c.id)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Cancelar"><X className="w-4 h-4" /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LISTA DETALHADA ── */}
        {aba === 'lista' && (
          <>
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="text" placeholder="Buscar por descrição, parceiro, programa, cartão..."
                    value={busca} onChange={e => setBusca(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <button onClick={() => setShowFiltros(v => !v)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${showFiltros ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  <SlidersHorizontal className="w-4 h-4" />Filtros
                  {filtrosAtivos > 0 && <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{filtrosAtivos}</span>}
                  {showFiltros ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              {showFiltros && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Status', val: filtroStatus, set: setFiltroStatus, opts: [['pendente','Pendente'],['pago','Pago'],['cancelado','Cancelado']] },
                      { label: 'Tipo', val: filtroTipo, set: setFiltroTipo, opts: [['compra','Compra de Pontos'],['compra_bonificada','Compra Bonificada'],['clube','Mensalidade Clube'],['transferencia_pontos','Transferência'],['venda','Venda'],['ajuste','Ajuste'],['outro','Outro']] },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                        <select value={f.val} onChange={e => f.set(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                          <option value="">Todos</option>
                          {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Forma de Pagamento</label>
                      <select value={filtroPagamento} onChange={e => setFiltroPagamento(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Todas</option>
                        {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[['Vencimento de', filtroVencDe, setFiltroVencDe], ['Vencimento até', filtroVencAte, setFiltroVencAte], ['Gerado de', filtroGeradoDe, setFiltroGeradoDe], ['Gerado até', filtroGeradoAte, setFiltroGeradoAte]].map(([l, v, s]) => (
                      <div key={l as string}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{l as string}</label>
                        <input type="date" value={v as string} onChange={e => (s as (v: string) => void)(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>
                  {filtrosAtivos > 0 && <div className="flex justify-end"><button onClick={limparFiltros} className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1"><X className="w-3 h-3" />Limpar filtros</button></div>}
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
                  {contasFiltradas.map(c => {
                    const st = getStatusConta(c);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-700">{getTipoLabel(c.origem_tipo)}</td>
                        <td className="px-5 py-4 text-sm">
                          <p className="font-medium text-slate-800 truncate max-w-xs">{formatDescricao(c.descricao)}</p>
                          {c.parceiro && <p className="text-xs text-slate-500">{c.parceiro.nome_parceiro}</p>}
                          {c.programa && <p className="text-xs text-slate-500">{c.programa.nome}</p>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-700">{new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{formatCurrency(c.valor_parcela)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-500">{c.numero_parcela}/{c.total_parcelas}</td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          <p>{c.forma_pagamento || '—'}</p>
                          {c.cartao && <p className="text-xs text-slate-400">{c.cartao.cartao}</p>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${st.color}`}>{st.label}</span></td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          <p>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                          <p className="text-xs text-slate-400">{new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                          {c.criado_por?.nome && <p className="text-xs text-slate-400">{c.criado_por.nome}</p>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {c.status_pagamento === 'pendente' && (
                            <div className="flex gap-1.5">
                              <button onClick={() => abrirModalPagar(c)} className="text-emerald-600 hover:text-emerald-800 p-1 rounded hover:bg-emerald-50"><CheckCircle className="w-5 h-5" /></button>
                              <button onClick={() => cancelarConta(c.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"><X className="w-5 h-5" /></button>
                            </div>
                          )}
                          {c.status_pagamento === 'pago' && c.data_pagamento && (
                            <p className="text-xs text-slate-500">Pago em: {new Date(c.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
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

      {/* Modal: Pagar Parcela */}
      {showPagarModal && contaSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Registrar Pagamento</h2>
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">{formatDescricao(contaSelecionada.descricao)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Parc. {contaSelecionada.numero_parcela}/{contaSelecionada.total_parcelas} · Venc. {new Date(contaSelecionada.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
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

      {/* Modal: Pagar Fatura */}
      {showPagarFaturaModal && faturaParaPagar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Pagar Fatura</h2>
            <p className="text-sm text-slate-500 mb-4">{faturaParaPagar.cartaoNome} · {formatMesAno(faturaParaPagar.mesAno)}</p>
            <div className="bg-slate-50 rounded-lg divide-y divide-slate-200 mb-4 max-h-52 overflow-y-auto">
              {faturaParaPagar.contas.filter(c => c.status_pagamento === 'pendente').map(c => (
                <div key={c.id} className="flex justify-between items-center px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-slate-700 truncate max-w-xs">{formatDescricao(c.descricao)}</p>
                    <p className="text-[10px] text-slate-400">Parc. {c.numero_parcela}/{c.total_parcelas} · Venc. {new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 ml-3">{formatCurrency(c.valor_parcela)}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mb-4 px-1">
              <p className="text-sm text-slate-600">{faturaParaPagar.qtdPendente} parcela(s) pendente(s)</p>
              <p className="text-base font-bold text-slate-800">Total: {formatCurrency(faturaParaPagar.totalPendente)}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Pago *</label>
                <input type="text" value={valorFatura} onChange={e => setValorFatura(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                {parseBRL(valorFatura) < faturaParaPagar.totalPendente && parseBRL(valorFatura) > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Valor menor que o total — distribuído proporcionalmente.</p>
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
