import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Calendar, CheckCircle, RefreshCw, CreditCard
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// ─── Types ────────────────────────────────────────────────────────────────────
type ContaReceber = {
  id: string;
  data_vencimento: string;
  valor_parcela: number;
  numero_parcela: number;
  total_parcelas: number;
  forma_pagamento: string | null;
  status_pagamento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  origem_tipo: string | null;
};

type ContaPagar = {
  id: string;
  descricao: string | null;
  data_vencimento: string;
  valor_parcela: number;
  numero_parcela: number;
  total_parcelas: number;
  forma_pagamento: string | null;
  status_pagamento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  origem_tipo: string | null;
  cartao_id: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

const mkKey = (d: string | null) => (!d ? 'sem-data' : d.substring(0, 7));

const MES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun',
                   'Jul','Ago','Set','Out','Nov','Dez'];

const mlbl = (k: string) => {
  if (k === 'sem-data') return 'Sem Data';
  const [y, m] = k.split('-');
  return `${MES_FULL[parseInt(m) - 1]} ${y}`;
};
const msh = (k: string) => {
  if (k === 'sem-data') return 'S/D';
  const [y, m] = k.split('-');
  return `${MES_SHORT[parseInt(m) - 1]}/${y.slice(2)}`;
};

const today0 = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

const effStatus = (s: string, dv: string | null): 'pago' | 'parcial' | 'vencido' | 'pendente' => {
  if (s === 'pago' || s === 'quitado') return 'pago';
  if (s === 'parcial') return 'parcial';
  if (dv && new Date(dv + 'T00:00:00') < today0()) return 'vencido';
  return 'pendente';
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatusBadge = ({ status, dv }: { status: string; dv: string | null }) => {
  const eff = effStatus(status, dv);
  const map = {
    pago:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
    parcial:  'bg-blue-50 text-blue-700 border border-blue-200',
    vencido:  'bg-red-50 text-red-700 border border-red-200',
    pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  const labels = { pago: 'Pago', parcial: 'Parcial', vencido: 'Vencido', pendente: 'Pendente' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[eff]}`}>
      {labels[eff]}
    </span>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardFinanceiro() {
  const [tab, setTab] = useState<'visao' | 'receber' | 'pagar'>('visao');
  const [dataCR, setDataCR] = useState<ContaReceber[]>([]);
  const [dataAP, setDataAP] = useState<ContaPagar[]>([]);
  const [cartoesMap, setCartoesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpd, setLastUpd] = useState('');

  // Filtros CR
  const [selMoCR, setSelMoCR] = useState<string | null>(null);
  const [filtStatusCR, setFiltStatusCR] = useState('');
  const [filtBuscaCR, setFiltBuscaCR] = useState('');

  // Filtros AP
  const [selMoAP, setSelMoAP] = useState<string | null>(null);
  const [filtStatusAP, setFiltStatusAP] = useState('');
  const [filtFormaAP, setFiltFormaAP] = useState('');
  const [filtCartaoAP, setFiltCartaoAP] = useState('');
  const [filtBuscaAP, setFiltBuscaAP] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [{ data: cr }, { data: ap }, { data: cartoes }] = await Promise.all([
      supabase.from('contas_receber').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('contas_a_pagar').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('cartoes_credito').select('id,cartao,banco_emissor').order('cartao'),
    ]);
    setDataCR((cr as ContaReceber[]) || []);
    setDataAP((ap as ContaPagar[]) || []);
    const map: Record<string, string> = {};
    (cartoes || []).forEach((c: { id: string; cartao: string; banco_emissor: string }) => {
      map[c.id] = `${c.cartao} (${c.banco_emissor})`;
    });
    setCartoesMap(map);
    setLastUpd(new Date().toLocaleTimeString('pt-BR'));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel('dash_fin_react')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_receber' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_a_pagar' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // ── KPI helpers ────────────────────────────────────────────────────────────
  const kpis = (data: (ContaReceber | ContaPagar)[]) => {
    const t = today0();
    const ck = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    const total    = data.reduce((s, r) => s + Number(r.valor_parcela || 0), 0);
    const pago     = data.filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'quitado')
                         .reduce((s, r) => s + Number(r.valor_pago || r.valor_parcela || 0), 0);
    const pendRows = data.filter(r => r.status_pagamento !== 'pago' && r.status_pagamento !== 'quitado');
    const vencRows = pendRows.filter(r => r.data_vencimento && new Date(r.data_vencimento + 'T00:00:00') < t);
    const mesRows  = data.filter(r => mkKey(r.data_vencimento) === ck);
    const mesPago  = mesRows.filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'quitado')
                            .reduce((s, r) => s + Number(r.valor_pago || r.valor_parcela || 0), 0);
    const mesTotal = mesRows.reduce((s, r) => s + Number(r.valor_parcela || 0), 0);
    return { total, pago, pendRows, pendTotal: total - pago, vencRows, vencTotal: vencRows.reduce((s, r) => s + Number(r.valor_parcela || 0), 0), mesRows, mesPago, mesTotal };
  };

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filteredCR = () =>
    dataCR.filter(r => {
      const eff = effStatus(r.status_pagamento, r.data_vencimento);
      if (selMoCR && mkKey(r.data_vencimento) !== selMoCR) return false;
      if (filtStatusCR && filtStatusCR !== eff) return false;
      if (filtBuscaCR && !(r.origem_tipo || '').toLowerCase().includes(filtBuscaCR.toLowerCase())) return false;
      return true;
    });

  const filteredAP = () =>
    dataAP.filter(r => {
      const eff = effStatus(r.status_pagamento, r.data_vencimento);
      if (selMoAP && mkKey(r.data_vencimento) !== selMoAP) return false;
      if (filtStatusAP && filtStatusAP !== eff && !(filtStatusAP === 'pago' && r.status_pagamento === 'quitado')) return false;
      if (filtFormaAP && r.forma_pagamento !== filtFormaAP) return false;
      if (filtCartaoAP && r.cartao_id !== filtCartaoAP) return false;
      if (filtBuscaAP && !((r.descricao || r.origem_tipo || '').toLowerCase().includes(filtBuscaAP.toLowerCase()))) return false;
      return true;
    });

  // ── Month cards helper ─────────────────────────────────────────────────────
  const byMonth = (data: (ContaReceber | ContaPagar)[], cartaoFilter?: string) => {
    const filtered = cartaoFilter ? data.filter(r => (r as ContaPagar).cartao_id === cartaoFilter) : data;
    const map: Record<string, { rows: typeof filtered; total: number; pago: number }> = {};
    filtered.forEach(r => {
      const k = mkKey(r.data_vencimento);
      if (!map[k]) map[k] = { rows: [], total: 0, pago: 0 };
      map[k].rows.push(r);
      map[k].total += Number(r.valor_parcela || 0);
      if (r.status_pagamento === 'pago' || r.status_pagamento === 'quitado')
        map[k].pago += Number(r.valor_pago || r.valor_parcela || 0);
    });
    return map;
  };

  const formasAP     = [...new Set(dataAP.map(r => r.forma_pagamento).filter(Boolean))].sort() as string[];
  const cartaoIdsAP  = [...new Set(dataAP.map(r => r.cartao_id).filter(Boolean))].sort((a, b) =>
    (cartoesMap[a!] || '').localeCompare(cartoesMap[b!] || '')) as string[];

  // ── Charts ─────────────────────────────────────────────────────────────────
  const fluxoData = () => {
    const allKeys = [...new Set([
      ...dataCR.map(r => mkKey(r.data_vencimento)),
      ...dataAP.map(r => mkKey(r.data_vencimento)),
    ].filter(k => k !== 'sem-data'))].sort();
    const crM: Record<string, number> = {};
    const apM: Record<string, number> = {};
    dataCR.forEach(r => { const k = mkKey(r.data_vencimento); crM[k] = (crM[k] || 0) + Number(r.valor_parcela || 0); });
    dataAP.forEach(r => { const k = mkKey(r.data_vencimento); apM[k] = (apM[k] || 0) + Number(r.valor_parcela || 0); });
    return {
      labels: allKeys.map(msh),
      datasets: [
        { label: 'A Receber', data: allKeys.map(k => crM[k] || 0), backgroundColor: 'rgba(16,185,129,.25)', borderColor: '#10b981', borderWidth: 2, borderRadius: 4 },
        { label: 'A Pagar',   data: allKeys.map(k => apM[k] || 0), backgroundColor: 'rgba(239,68,68,.2)',   borderColor: '#ef4444', borderWidth: 2, borderRadius: 4 },
      ],
    };
  };

  const statusData = (data: (ContaReceber | ContaPagar)[]) => {
    const sc: Record<string, number> = {};
    data.forEach(r => { const s = effStatus(r.status_pagamento, r.data_vencimento); sc[s] = (sc[s] || 0) + 1; });
    const labels = { pago: 'Pago', pendente: 'Pendente', vencido: 'Vencido', parcial: 'Parcial' };
    const colors = { pago: '#10b981', pendente: '#f59e0b', vencido: '#ef4444', parcial: '#3b82f6' };
    return {
      labels: Object.keys(sc).map(k => (labels as Record<string, string>)[k] || k),
      datasets: [{ data: Object.values(sc), backgroundColor: Object.keys(sc).map(k => (colors as Record<string, string>)[k] || '#94a3b8'), borderWidth: 2, borderColor: '#fff' }],
    };
  };

  const formaData = () => {
    const fc: Record<string, number> = {};
    dataAP.forEach(r => { const f = r.forma_pagamento || 'Não informado'; fc[f] = (fc[f] || 0) + Number(r.valor_parcela || 0); });
    const keys = Object.keys(fc).sort((a, b) => fc[b] - fc[a]).slice(0, 7);
    const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#a855f7','#06b6d4'];
    return {
      labels: keys,
      datasets: [{ label: 'Valor', data: keys.map(k => fc[k]), backgroundColor: keys.map((_, i) => colors[i % colors.length] + '33'), borderColor: keys.map((_, i) => colors[i % colors.length]), borderWidth: 2, borderRadius: 4 }],
    };
  };

  const barOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#475569', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(203,213,225,.5)' } },
      y: { ticks: { color: '#64748b', font: { size: 10 }, callback: (v: number | string) => { const n = Number(v); return 'R$' + (n >= 1000 ? (n / 1000).toFixed(0) + 'k' : n); } }, grid: { color: 'rgba(203,213,225,.5)' } },
    },
  } as const;

  const donutOpts = {
    responsive: true, maintainAspectRatio: false, cutout: '62%',
    plugins: { legend: { position: 'right' as const, labels: { color: '#475569', font: { size: 11 }, padding: 12 } } },
  };

  const hBarOpts = {
    indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 }, callback: (v: number | string) => { const n = Number(v); return 'R$' + (n >= 1000 ? (n / 1000).toFixed(0) + 'k' : n); } }, grid: { color: 'rgba(203,213,225,.5)' } },
      y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
    },
  } as const;

  // ── Globals para Visão Geral ────────────────────────────────────────────────
  const t   = today0();
  const crK = kpis(dataCR);
  const apK = kpis(dataAP);
  const net = crK.pendTotal - apK.pendTotal;
  const vcCR = dataCR.filter(r => r.status_pagamento !== 'pago' && r.data_vencimento && new Date(r.data_vencimento + 'T00:00:00') < t).length;
  const vcAP = dataAP.filter(r => r.status_pagamento !== 'pago' && r.status_pagamento !== 'quitado' && r.data_vencimento && new Date(r.data_vencimento + 'T00:00:00') < t).length;

  // ── Month Cards ─────────────────────────────────────────────────────────────
  const MonthCards = ({ data, tipo, selMo, onSel, cartaoFilter }: {
    data: (ContaReceber | ContaPagar)[];
    tipo: 'cr' | 'ap';
    selMo: string | null;
    onSel: (k: string) => void;
    cartaoFilter?: string;
  }) => {
    const bm   = byMonth(data, cartaoFilter);
    const maxV = Math.max(...Object.values(bm).map(m => m.total), 1);
    const ck   = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    const keys = Object.keys(bm).sort();
    if (keys.length === 0)
      return <p className="text-sm text-slate-400 py-3 text-center">Nenhuma fatura encontrada.</p>;

    const accentSel = tipo === 'cr' ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50';
    const barFill   = tipo === 'cr' ? 'bg-emerald-500' : 'bg-red-500';

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-6">
        {keys.map(k => {
          const m   = bm[k];
          const pct = Math.round((m.pago / m.total) * 100) || 0;
          const isSel = k === selMo || (selMo === null && k === ck);
          return (
            <button
              key={k}
              onClick={() => onSel(k)}
              className={`bg-white rounded-xl border text-left p-3 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                isSel ? accentSel + ' shadow-sm' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 truncate">{mlbl(k)}{k === ck ? ' 📅' : ''}</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1">{m.rows.length}</span>
              </div>
              <div className="text-base font-bold text-slate-800 mb-1.5">{fmtBRL(m.total)}</div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                <div className={`h-full rounded-full transition-all ${barFill}`} style={{ width: `${(m.total / maxV * 100).toFixed(0)}%` }} />
              </div>
              <div className="text-xs text-slate-500">
                <span style={{ color: pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>●</span>{' '}
                {pct}% liquidado
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // ── Visão Geral ──────────────────────────────────────────────────────────
  const TabVisaoGeral = () => {
    const sum = crK.pendTotal + apK.pendTotal || 1;
    return (
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'A Receber',        value: fmtBRL(crK.pendTotal), sub: `${dataCR.filter(r => r.status_pagamento !== 'pago').length} parc.`,       icon: TrendingUp,   bg: 'bg-emerald-50', ic: 'text-emerald-600', vl: 'text-emerald-700' },
            { label: 'A Pagar',          value: fmtBRL(apK.pendTotal), sub: `${dataAP.filter(r => r.status_pagamento !== 'pago' && r.status_pagamento !== 'quitado').length} parc.`, icon: TrendingDown, bg: 'bg-red-50',     ic: 'text-red-500',    vl: 'text-red-600'    },
            { label: 'Saldo Líquido',    value: fmtBRL(net),           sub: net >= 0 ? 'Positivo' : 'Negativo',                                        icon: DollarSign,   bg: net >= 0 ? 'bg-blue-50' : 'bg-amber-50', ic: net >= 0 ? 'text-blue-600' : 'text-amber-600', vl: net >= 0 ? 'text-blue-700' : 'text-amber-700' },
            { label: 'Total Receber',    value: fmtBRL(crK.total),     sub: `${dataCR.length} parcelas`,                                               icon: CheckCircle,  bg: 'bg-slate-50',   ic: 'text-slate-500',  vl: 'text-slate-800'  },
            { label: 'Total Pagar',      value: fmtBRL(apK.total),     sub: `${dataAP.length} parcelas`,                                               icon: CreditCard,   bg: 'bg-slate-50',   ic: 'text-slate-500',  vl: 'text-slate-800'  },
            { label: 'Vencidos',         value: String(vcCR + vcAP),   sub: `${vcCR} receber · ${vcAP} pagar`,                                         icon: AlertTriangle, bg: (vcCR + vcAP) > 0 ? 'bg-red-50' : 'bg-slate-50', ic: (vcCR + vcAP) > 0 ? 'text-red-500' : 'text-slate-400', vl: (vcCR + vcAP) > 0 ? 'text-red-600' : 'text-slate-700' },
          ].map(({ label, value, sub, icon: Icon, bg, ic, vl }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <div className={`${bg} p-1.5 rounded-lg`}><Icon className={`w-4 h-4 ${ic}`} /></div>
              </div>
              <p className={`text-xl font-bold ${vl}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Balanço */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Balanço — Receber vs Pagar (pendente)</h3>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Total a Receber</p>
              <p className="text-2xl font-bold text-emerald-600">{fmtBRL(crK.pendTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Saldo Líquido</p>
              <p className={`text-2xl font-bold ${net >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>{fmtBRL(net)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Total a Pagar</p>
              <p className="text-2xl font-bold text-red-500">{fmtBRL(apK.pendTotal)}</p>
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Receber ({(crK.pendTotal / sum * 100).toFixed(0)}%)</span>
            <span>Pagar ({(apK.pendTotal / sum * 100).toFixed(0)}%)</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(crK.pendTotal / sum * 100).toFixed(1)}%` }} />
            <div className="h-full bg-red-500 transition-all"     style={{ width: `${(apK.pendTotal / sum * 100).toFixed(1)}%` }} />
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Fluxo Mensal — Receber vs Pagar</h3>
            <div className="h-56"><Bar data={fluxoData()} options={barOpts} /></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Por Forma de Pagamento (Pagar)</h3>
            <div className="h-56"><Bar data={formaData()} options={hBarOpts} /></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Status — Contas a Receber</h3>
            <div className="h-56"><Doughnut data={statusData(dataCR)} options={donutOpts} /></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Status — Contas a Pagar</h3>
            <div className="h-56"><Doughnut data={statusData(dataAP)} options={donutOpts} /></div>
          </div>
        </div>
      </div>
    );
  };

  // ── Contas a Receber ──────────────────────────────────────────────────────
  const TabReceber = () => {
    const rows = filteredCR();
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Geral',      value: fmtBRL(crK.total),     sub: `${dataCR.length} parcelas`,   icon: DollarSign,    bg: 'bg-blue-50',    ic: 'text-blue-600',    vl: 'text-slate-800'  },
            { label: 'Total Recebido',   value: fmtBRL(crK.pago),      sub: `${dataCR.filter(r => r.status_pagamento === 'pago').length} pagas`, icon: CheckCircle, bg: 'bg-emerald-50', ic: 'text-emerald-600', vl: 'text-emerald-700' },
            { label: 'A Receber',        value: fmtBRL(crK.pendTotal), sub: `${crK.pendRows.length} pendentes`, icon: TrendingUp,  bg: 'bg-amber-50',   ic: 'text-amber-600',   vl: 'text-amber-700'  },
            { label: 'Vencidos',         value: fmtBRL(crK.vencTotal), sub: `${crK.vencRows.length} vencidas`, icon: AlertTriangle, bg: 'bg-red-50',  ic: 'text-red-500',     vl: 'text-red-600'    },
            { label: 'Mês Atual',        value: fmtBRL(crK.mesTotal),  sub: `${crK.mesRows.length} parcelas`, icon: Calendar,    bg: 'bg-purple-50',  ic: 'text-purple-600',  vl: 'text-slate-800'  },
            { label: 'Recebido no Mês',  value: fmtBRL(crK.mesPago),   sub: `${crK.mesTotal > 0 ? Math.round(crK.mesPago / crK.mesTotal * 100) : 0}% do mês`, icon: TrendingUp, bg: 'bg-cyan-50', ic: 'text-cyan-600', vl: 'text-slate-800' },
          ].map(({ label, value, sub, icon: Icon, bg, ic, vl }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <div className={`${bg} p-1.5 rounded-lg`}><Icon className={`w-4 h-4 ${ic}`} /></div>
              </div>
              <p className={`text-xl font-bold ${vl}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Faturas por Mês</h3>
            {selMoCR && (
              <button onClick={() => setSelMoCR(null)} className="text-xs text-blue-600 hover:underline">Limpar filtro</button>
            )}
          </div>
          <MonthCards data={dataCR} tipo="cr" selMo={selMoCR} onSel={k => setSelMoCR(selMoCR === k ? null : k)} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Detalhes</h3>
              {selMoCR && <span className="text-xs text-emerald-600 font-medium">— {mlbl(selMoCR)}</span>}
              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">{rows.length}</span>
            </div>
            <div className="flex gap-2">
              <select value={filtStatusCR} onChange={e => setFiltStatusCR(e.target.value)}
                className="border border-slate-200 text-slate-600 text-xs px-2 py-1.5 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-300">
                <option value="">Todos os status</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="vencido">Vencido</option>
                <option value="parcial">Parcial</option>
              </select>
              <input value={filtBuscaCR} onChange={e => setFiltBuscaCR(e.target.value)}
                placeholder="Buscar origem..."
                className="border border-slate-200 text-slate-600 text-xs px-2 py-1.5 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-300 w-36 placeholder-slate-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  {['#','Vencimento','Valor','Parcela','Forma Pgto','Status','Data Pgto','Valor Pago','Origem'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium border-b border-slate-100 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">Nenhum registro encontrado.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{fmtDate(r.data_vencimento)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{fmtBRL(r.valor_parcela)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.numero_parcela}/{r.total_parcelas}</td>
                    <td className="px-4 py-3 text-slate-600">{r.forma_pagamento || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status_pagamento} dv={r.data_vencimento} /></td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.data_pagamento)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{r.valor_pago ? fmtBRL(r.valor_pago) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.origem_tipo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── Contas a Pagar ────────────────────────────────────────────────────────
  const TabPagar = () => {
    const rows = filteredAP();
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Geral',   value: fmtBRL(apK.total),     sub: `${dataAP.length} parcelas`,    icon: DollarSign,    bg: 'bg-blue-50',    ic: 'text-blue-600',    vl: 'text-slate-800'  },
            { label: 'Total Pago',    value: fmtBRL(apK.pago),      sub: `${dataAP.filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'quitado').length} pagas`, icon: CheckCircle, bg: 'bg-emerald-50', ic: 'text-emerald-600', vl: 'text-emerald-700' },
            { label: 'A Pagar',       value: fmtBRL(apK.pendTotal), sub: `${apK.pendRows.length} pendentes`, icon: TrendingDown, bg: 'bg-amber-50',  ic: 'text-amber-600',   vl: 'text-amber-700'  },
            { label: 'Vencidos',      value: fmtBRL(apK.vencTotal), sub: `${apK.vencRows.length} vencidas`, icon: AlertTriangle, bg: 'bg-red-50',   ic: 'text-red-500',     vl: 'text-red-600'    },
            { label: 'Mês Atual',     value: fmtBRL(apK.mesTotal),  sub: `${apK.mesRows.length} parcelas`, icon: Calendar,     bg: 'bg-purple-50',  ic: 'text-purple-600',  vl: 'text-slate-800'  },
            { label: 'Pago no Mês',   value: fmtBRL(apK.mesPago),   sub: `${apK.mesTotal > 0 ? Math.round(apK.mesPago / apK.mesTotal * 100) : 0}% do mês`, icon: TrendingDown, bg: 'bg-cyan-50', ic: 'text-cyan-600', vl: 'text-slate-800' },
          ].map(({ label, value, sub, icon: Icon, bg, ic, vl }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <div className={`${bg} p-1.5 rounded-lg`}><Icon className={`w-4 h-4 ${ic}`} /></div>
              </div>
              <p className={`text-xl font-bold ${vl}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Faturas por Mês</h3>
            {selMoAP && (
              <button onClick={() => setSelMoAP(null)} className="text-xs text-blue-600 hover:underline">Limpar filtro</button>
            )}
          </div>
          <MonthCards data={dataAP} tipo="ap" selMo={selMoAP} onSel={k => setSelMoAP(selMoAP === k ? null : k)} cartaoFilter={filtCartaoAP || undefined} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Detalhes</h3>
              {selMoAP && <span className="text-xs text-red-500 font-medium">— {mlbl(selMoAP)}</span>}
              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">{rows.length}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select value={filtStatusAP} onChange={e => setFiltStatusAP(e.target.value)}
                className="border border-slate-200 text-slate-600 text-xs px-2 py-1.5 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-300">
                <option value="">Todos os status</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="vencido">Vencido</option>
              </select>
              <select value={filtFormaAP} onChange={e => setFiltFormaAP(e.target.value)}
                className="border border-slate-200 text-slate-600 text-xs px-2 py-1.5 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-300">
                <option value="">Todas as formas</option>
                {formasAP.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select value={filtCartaoAP} onChange={e => setFiltCartaoAP(e.target.value)}
                className="border border-slate-200 text-slate-600 text-xs px-2 py-1.5 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-300">
                <option value="">Todos os cartões</option>
                {cartaoIdsAP.map(id => <option key={id} value={id}>{cartoesMap[id] || id.substring(0, 8) + '...'}</option>)}
              </select>
              <input value={filtBuscaAP} onChange={e => setFiltBuscaAP(e.target.value)}
                placeholder="Buscar descrição..."
                className="border border-slate-200 text-slate-600 text-xs px-2 py-1.5 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-300 w-40 placeholder-slate-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  {['#','Descrição','Vencimento','Valor','Parcela','Forma Pgto','Status','Data Pgto','Valor Pago','Cartão','Origem'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium border-b border-slate-100 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-10 text-slate-400 text-sm">Nenhum registro encontrado.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate" title={r.descricao || ''}>{(r.descricao || '').substring(0, 40) || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{fmtDate(r.data_vencimento)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{fmtBRL(r.valor_parcela)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.numero_parcela}/{r.total_parcelas}</td>
                    <td className="px-4 py-3 text-slate-600">{r.forma_pagamento || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status_pagamento} dv={r.data_vencimento} /></td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.data_pagamento)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{r.valor_pago ? fmtBRL(r.valor_pago) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-blue-600 text-xs max-w-[140px] truncate" title={r.cartao_id ? cartoesMap[r.cartao_id] || '' : ''}>
                      {r.cartao_id ? (cartoesMap[r.cartao_id] || r.cartao_id.substring(0, 8) + '...') : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.origem_tipo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Financeiro</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contas a Receber & Contas a Pagar em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Atualizado: {lastUpd}</span>
          <button onClick={fetchAll}
            className="flex items-center gap-1.5 text-sm border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Tempo Real
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-slate-200 flex gap-0">
            {([
              { id: 'visao',   label: 'Visão Geral' },
              { id: 'receber', label: 'Contas a Receber' },
              { id: 'pagar',   label: 'Contas a Pagar' },
            ] as const).map(tb => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
                  tab === tb.id
                    ? 'text-blue-600 border-blue-500'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === 'visao'   && <TabVisaoGeral />}
          {tab === 'receber' && <TabReceber />}
          {tab === 'pagar'   && <TabPagar />}
        </>
      )}
    </div>
  );
}
