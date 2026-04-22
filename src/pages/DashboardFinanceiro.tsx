import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { RefreshCw } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// ─── Types ───────────────────────────────────────────────────────────────────
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
  cartao_id?: string | null;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

const mkKey = (d: string | null) => (!d ? 'sem-data' : d.substring(0, 7));

const MES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
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

const effStatus = (s: string, dv: string | null) => {
  if (s === 'pago' || s === 'quitado') return 'pago';
  if (s === 'parcial') return 'parcial';
  if (dv && new Date(dv + 'T00:00:00') < today0()) return 'vencido';
  return 'pendente';
};

// ─── Sub-components ──────────────────────────────────────────────────────────
const StatusBadge = ({ status, dv }: { status: string; dv: string | null }) => {
  const eff = effStatus(status, dv);
  const map: Record<string, { cls: string; label: string }> = {
    pago:     { cls: 'bg-green-500/15 text-green-400 border border-green-500/25',  label: '✓ Pago' },
    parcial:  { cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',     label: '⚡ Parcial' },
    vencido:  { cls: 'bg-red-500/15 text-red-400 border border-red-500/25',        label: '⚠ Vencido' },
    pendente: { cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25', label: '⏳ Pendente' },
  };
  const { cls, label } = map[eff] || map.pendente;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{label}</span>;
};

type KpiCardProps = {
  label: string;
  value: string;
  sub: string;
  color: string;
};
const KpiCard = ({ label, value, sub, color }: KpiCardProps) => (
  <div className={`bg-slate-800 border border-slate-700 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5`}>
    <div className={`absolute top-0 left-0 right-0 h-0.5 ${color}`} />
    <div className="text-xs uppercase tracking-widest text-slate-400 mb-1.5">{label}</div>
    <div className="text-2xl font-bold text-slate-100 leading-tight">{value}</div>
    <div className="text-xs text-slate-400 mt-1">{sub}</div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardFinanceiro() {
  const [tab, setTab] = useState<'visao' | 'receber' | 'pagar'>('visao');
  const [dataCR, setDataCR] = useState<ContaReceber[]>([]);
  const [dataAP, setDataAP] = useState<ContaPagar[]>([]);
  const [cartoesMap, setCartoesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpd, setLastUpd] = useState('');

  // Filters – CR
  const [selMoCR, setSelMoCR] = useState<string | null>(null);
  const [filtStatusCR, setFiltStatusCR] = useState('');
  const [filtBuscaCR, setFiltBuscaCR] = useState('');

  // Filters – AP
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
    const total = data.reduce((s, r) => s + Number(r.valor_parcela || 0), 0);
    const pago = data.filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'quitado')
      .reduce((s, r) => s + Number(r.valor_pago || r.valor_parcela || 0), 0);
    const pendRows = data.filter(r => r.status_pagamento !== 'pago' && r.status_pagamento !== 'quitado');
    const vencRows = pendRows.filter(r => r.data_vencimento && new Date(r.data_vencimento + 'T00:00:00') < t);
    const mesRows = data.filter(r => mkKey(r.data_vencimento) === ck);
    const mesPago = mesRows.filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'quitado')
      .reduce((s, r) => s + Number(r.valor_pago || r.valor_parcela || 0), 0);
    const mesTotal = mesRows.reduce((s, r) => s + Number(r.valor_parcela || 0), 0);
    return { total, pago, pendRows, pendTotal: total - pago, vencRows, vencTotal: vencRows.reduce((s, r) => s + Number(r.valor_parcela || 0), 0), mesRows, mesPago, mesTotal };
  };

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filteredCR = () => {
    return dataCR.filter(r => {
      const eff = effStatus(r.status_pagamento, r.data_vencimento);
      if (selMoCR && mkKey(r.data_vencimento) !== selMoCR) return false;
      if (filtStatusCR && filtStatusCR !== eff) return false;
      if (filtBuscaCR && !(r.origem_tipo || '').toLowerCase().includes(filtBuscaCR.toLowerCase())) return false;
      return true;
    });
  };

  const filteredAP = () => {
    return dataAP.filter(r => {
      const eff = effStatus(r.status_pagamento, r.data_vencimento);
      if (selMoAP && mkKey(r.data_vencimento) !== selMoAP) return false;
      if (filtStatusAP && filtStatusAP !== eff && !(filtStatusAP === 'pago' && r.status_pagamento === 'quitado')) return false;
      if (filtFormaAP && r.forma_pagamento !== filtFormaAP) return false;
      if (filtCartaoAP && r.cartao_id !== filtCartaoAP) return false;
      if (filtBuscaAP && !((r.descricao || r.origem_tipo || '').toLowerCase().includes(filtBuscaAP.toLowerCase()))) return false;
      return true;
    });
  };

  // ── Month cards data ───────────────────────────────────────────────────────
  const byMonth = (data: (ContaReceber | ContaPagar)[], cartaoFilter?: string) => {
    const filtered = cartaoFilter
      ? data.filter(r => (r as ContaPagar).cartao_id === cartaoFilter)
      : data;
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

  // ── Unique formas (AP) ─────────────────────────────────────────────────────
  const formasAP = [...new Set(dataAP.map(r => r.forma_pagamento).filter(Boolean))].sort() as string[];
  const cartaoIdsAP = [...new Set(dataAP.map(r => r.cartao_id).filter(Boolean))].sort((a, b) =>
    (cartoesMap[a!] || '').localeCompare(cartoesMap[b!] || '')
  ) as string[];

  // ── Chart data builders ───────────────────────────────────────────────────
  const fluxoChartData = () => {
    const allKeys = [...new Set([
      ...dataCR.map(r => mkKey(r.data_vencimento)),
      ...dataAP.map(r => mkKey(r.data_vencimento)),
    ].filter(k => k !== 'sem-data'))].sort();
    const crByM: Record<string, number> = {};
    const apByM: Record<string, number> = {};
    dataCR.forEach(r => { const k = mkKey(r.data_vencimento); crByM[k] = (crByM[k] || 0) + Number(r.valor_parcela || 0); });
    dataAP.forEach(r => { const k = mkKey(r.data_vencimento); apByM[k] = (apByM[k] || 0) + Number(r.valor_parcela || 0); });
    return {
      labels: allKeys.map(msh),
      datasets: [
        { label: 'A Receber', data: allKeys.map(k => crByM[k] || 0), backgroundColor: 'rgba(34,197,94,.5)', borderColor: '#22c55e', borderWidth: 1.5, borderRadius: 4 },
        { label: 'A Pagar',   data: allKeys.map(k => apByM[k] || 0), backgroundColor: 'rgba(239,68,68,.5)',  borderColor: '#ef4444', borderWidth: 1.5, borderRadius: 4 },
      ],
    };
  };

  const statusChartData = (data: (ContaReceber | ContaPagar)[]) => {
    const sc: Record<string, number> = {};
    data.forEach(r => { const s = effStatus(r.status_pagamento, r.data_vencimento); sc[s] = (sc[s] || 0) + 1; });
    const lMap: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', vencido: 'Vencido', parcial: 'Parcial' };
    const cMap: Record<string, string> = { pago: '#22c55e', pendente: '#f59e0b', vencido: '#ef4444', parcial: '#3b82f6' };
    return {
      labels: Object.keys(sc).map(k => lMap[k] || k),
      datasets: [{ data: Object.values(sc), backgroundColor: Object.keys(sc).map(k => cMap[k] || '#a855f7'), borderWidth: 0 }],
    };
  };

  const formaChartData = () => {
    const fc: Record<string, number> = {};
    dataAP.forEach(r => { const f = r.forma_pagamento || 'Não informado'; fc[f] = (fc[f] || 0) + Number(r.valor_parcela || 0); });
    const keys = Object.keys(fc).sort((a, b) => fc[b] - fc[a]).slice(0, 7);
    const colors = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#a855f7','#06b6d4'];
    return {
      labels: keys,
      datasets: [{ label: 'Valor', data: keys.map(k => fc[k]), backgroundColor: keys.map((_, i) => colors[i % colors.length]), borderRadius: 4 }],
    };
  };

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,.4)' } },
      y: { ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v: number | string) => { const n = Number(v); return 'R$' + (n >= 1000 ? (n/1000).toFixed(0) + 'k' : n); } }, grid: { color: 'rgba(51,65,85,.4)' } },
    },
  } as const;

  const donutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: { legend: { position: 'right' as const, labels: { color: '#94a3b8', font: { size: 11 }, padding: 10 } } },
  };

  const formaOpts = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v: number | string) => { const n = Number(v); return 'R$' + (n >= 1000 ? (n/1000).toFixed(0) + 'k' : n); } }, grid: { color: 'rgba(51,65,85,.4)' } },
      y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
    },
  } as const;

  // ── Geral KPIs ─────────────────────────────────────────────────────────────
  const t = today0();
  const crK = kpis(dataCR);
  const apK = kpis(dataAP);
  const net = crK.pendTotal - apK.pendTotal;
  const vcCR = dataCR.filter(r => r.status_pagamento !== 'pago' && r.data_vencimento && new Date(r.data_vencimento + 'T00:00:00') < t).length;
  const vcAP = dataAP.filter(r => r.status_pagamento !== 'pago' && r.status_pagamento !== 'quitado' && r.data_vencimento && new Date(r.data_vencimento + 'T00:00:00') < t).length;

  // ── Month Card Component ───────────────────────────────────────────────────
  const MonthCards = ({ data, tipo, selMo, onSel, cartaoFilter }: {
    data: (ContaReceber | ContaPagar)[];
    tipo: 'cr' | 'ap';
    selMo: string | null;
    onSel: (k: string) => void;
    cartaoFilter?: string;
  }) => {
    const bm = byMonth(data, cartaoFilter);
    const maxV = Math.max(...Object.values(bm).map(m => m.total), 1);
    const ck = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    const keys = Object.keys(bm).sort();
    if (keys.length === 0)
      return <p className="text-slate-400 text-sm py-4 text-center">Nenhuma fatura para o filtro selecionado.</p>;

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        {keys.map(k => {
          const m = bm[k];
          const pct = Math.round(m.pago / m.total * 100) || 0;
          const isSel = k === selMo || k === ck;
          const accentBorder = tipo === 'cr' ? 'border-green-500' : 'border-red-500';
          const barColor = tipo === 'cr' ? 'bg-green-500' : 'bg-red-500';
          return (
            <button
              key={k}
              onClick={() => onSel(k)}
              className={`bg-slate-800 border rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 ${isSel ? `${accentBorder} bg-slate-700/50` : 'border-slate-700'}`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-slate-100">{mlbl(k)}{k === ck ? ' 📅' : ''}</span>
                <span className="text-xs text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded-full">{m.rows.length}</span>
              </div>
              <div className="text-lg font-bold text-slate-100 mb-1">{fmtBRL(m.total)}</div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${(m.total / maxV * 100).toFixed(0)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Pago: <span className="text-slate-200">{fmtBRL(m.pago)}</span></span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                <span style={{ color: pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>●</span> {pct}% liquidado
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // ── Tab: Visão Geral ───────────────────────────────────────────────────────
  const TabVisaoGeral = () => {
    const sum = crK.pendTotal + apK.pendTotal || 1;
    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="A Receber (pendente)" value={fmtBRL(crK.pendTotal)} sub={`${dataCR.filter(r => r.status_pagamento !== 'pago').length} parcela(s)`} color="bg-green-500" />
          <KpiCard label="A Pagar (pendente)"   value={fmtBRL(apK.pendTotal)} sub={`${dataAP.filter(r => r.status_pagamento !== 'pago' && r.status_pagamento !== 'quitado').length} parcela(s)`} color="bg-red-500" />
          <KpiCard label="Saldo Líquido"         value={fmtBRL(net)}           sub={net >= 0 ? 'Positivo' : 'Negativo'} color={net >= 0 ? 'bg-cyan-500' : 'bg-orange-500'} />
          <KpiCard label="Total Receber (geral)" value={fmtBRL(crK.total)}     sub={`${dataCR.length} parcela(s)`} color="bg-blue-500" />
          <KpiCard label="Total Pagar (geral)"   value={fmtBRL(apK.total)}     sub={`${dataAP.length} parcela(s)`} color="bg-pink-500" />
          <KpiCard label="Vencidos (ambos)"      value={String(vcCR + vcAP)}   sub={`${vcCR} receber · ${vcAP} pagar`} color="bg-yellow-500" />
        </div>

        {/* Balanço */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <div className="text-sm font-semibold text-slate-200 mb-4 pb-2 border-b border-slate-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
            Balanço Geral — Receber vs Pagar
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Total a Receber</div>
              <div className="text-2xl font-bold text-green-400">{fmtBRL(crK.pendTotal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Saldo Líquido</div>
              <div className={`text-2xl font-bold ${net >= 0 ? 'text-cyan-400' : 'text-yellow-400'}`}>{fmtBRL(net)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Total a Pagar</div>
              <div className="text-2xl font-bold text-red-400">{fmtBRL(apK.pendTotal)}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 flex justify-between mb-1">
            <span>Receber</span><span>Pagar</span>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden flex">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${(crK.pendTotal / sum * 100).toFixed(1)}%` }} />
            <div className="h-full bg-red-500 transition-all"   style={{ width: `${(apK.pendTotal / sum * 100).toFixed(1)}%` }} />
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-3">📊 Fluxo Mensal — Receber vs Pagar (R$)</div>
            <div className="h-56"><Bar data={fluxoChartData()} options={chartOpts} /></div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-3">🥧 Status — Receber</div>
            <div className="h-56"><Doughnut data={statusChartData(dataCR)} options={donutOpts} /></div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-3">🥧 Status — Pagar</div>
            <div className="h-56"><Doughnut data={statusChartData(dataAP)} options={donutOpts} /></div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-3">💳 Por Forma de Pagamento (Pagar)</div>
            <div className="h-56"><Bar data={formaChartData()} options={formaOpts} /></div>
          </div>
        </div>
      </div>
    );
  };

  // ── Tab: Contas a Receber ──────────────────────────────────────────────────
  const TabReceber = () => {
    const rows = filteredCR();
    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Total Geral"      value={fmtBRL(crK.total)}    sub={`${dataCR.length} parcela(s)`}        color="bg-blue-500" />
          <KpiCard label="Total Recebido"   value={fmtBRL(crK.pago)}     sub={`${dataCR.filter(r => r.status_pagamento === 'pago').length} paga(s)`} color="bg-green-500" />
          <KpiCard label="A Receber"        value={fmtBRL(crK.pendTotal)} sub={`${crK.pendRows.length} pendente(s)`} color="bg-yellow-500" />
          <KpiCard label="Vencidos"         value={fmtBRL(crK.vencTotal)} sub={`${crK.vencRows.length} vencida(s)`}  color="bg-red-500" />
          <KpiCard label="Mês Atual"        value={fmtBRL(crK.mesTotal)}  sub={`${crK.mesRows.length} parcela(s)`}  color="bg-purple-500" />
          <KpiCard label="Recebido no Mês"  value={fmtBRL(crK.mesPago)}   sub={`${crK.mesTotal > 0 ? Math.round(crK.mesPago / crK.mesTotal * 100) : 0}% do mês`} color="bg-cyan-500" />
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Faturas por Mês — Clique para filtrar
          {selMoCR && (
            <button onClick={() => setSelMoCR(null)} className="ml-auto text-xs text-slate-400 hover:text-white">✕ Limpar filtro mês</button>
          )}
        </div>
        <MonthCards data={dataCR} tipo="cr" selMo={selMoCR} onSel={k => setSelMoCR(selMoCR === k ? null : k)} />

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Detalhes
          {selMoCR && <span className="text-green-400">— {mlbl(selMoCR)}</span>}
          <span className="bg-indigo-500/20 text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-full">{rows.length}</span>
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          <select value={filtStatusCR} onChange={e => setFiltStatusCR(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg outline-none">
            <option value="">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="vencido">Vencido</option>
            <option value="parcial">Parcial</option>
          </select>
          <input value={filtBuscaCR} onChange={e => setFiltBuscaCR(e.target.value)}
            placeholder="Buscar origem..."
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg outline-none w-48 placeholder-slate-500" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-indigo-500/10 text-slate-400 text-xs uppercase tracking-widest">
                {['#','Vencimento','Valor','Parcela','Forma Pgto','Status','Data Pgto','Valor Pago','Origem'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium border-b border-slate-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Nenhum registro encontrado.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2">{fmtDate(r.data_vencimento)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-100">{fmtBRL(r.valor_parcela)}</td>
                  <td className="px-3 py-2 text-slate-400">{r.numero_parcela}/{r.total_parcelas}</td>
                  <td className="px-3 py-2">{r.forma_pagamento || <span className="text-slate-500">—</span>}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status_pagamento} dv={r.data_vencimento} /></td>
                  <td className="px-3 py-2">{fmtDate(r.data_pagamento)}</td>
                  <td className="px-3 py-2 text-green-400">{r.valor_pago ? fmtBRL(r.valor_pago) : '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{r.origem_tipo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Tab: Contas a Pagar ────────────────────────────────────────────────────
  const TabPagar = () => {
    const rows = filteredAP();
    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Total Geral"    value={fmtBRL(apK.total)}    sub={`${dataAP.length} parcela(s)`}         color="bg-blue-500" />
          <KpiCard label="Total Pago"     value={fmtBRL(apK.pago)}     sub={`${dataAP.filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'quitado').length} paga(s)`} color="bg-red-500" />
          <KpiCard label="A Pagar"        value={fmtBRL(apK.pendTotal)} sub={`${apK.pendRows.length} pendente(s)`} color="bg-yellow-500" />
          <KpiCard label="Vencidos"       value={fmtBRL(apK.vencTotal)} sub={`${apK.vencRows.length} vencida(s)`}  color="bg-red-500" />
          <KpiCard label="Mês Atual"      value={fmtBRL(apK.mesTotal)}  sub={`${apK.mesRows.length} parcela(s)`}  color="bg-purple-500" />
          <KpiCard label="Pago no Mês"    value={fmtBRL(apK.mesPago)}   sub={`${apK.mesTotal > 0 ? Math.round(apK.mesPago / apK.mesTotal * 100) : 0}% do mês`} color="bg-cyan-500" />
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Faturas por Mês — Clique para filtrar
          {selMoAP && (
            <button onClick={() => setSelMoAP(null)} className="ml-auto text-xs text-slate-400 hover:text-white">✕ Limpar filtro mês</button>
          )}
        </div>
        <MonthCards data={dataAP} tipo="ap" selMo={selMoAP} onSel={k => setSelMoAP(selMoAP === k ? null : k)} cartaoFilter={filtCartaoAP || undefined} />

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Detalhes
          {selMoAP && <span className="text-red-400">— {mlbl(selMoAP)}</span>}
          <span className="bg-indigo-500/20 text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-full">{rows.length}</span>
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          <select value={filtStatusAP} onChange={e => setFiltStatusAP(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg outline-none">
            <option value="">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="vencido">Vencido</option>
          </select>
          <select value={filtFormaAP} onChange={e => setFiltFormaAP(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg outline-none">
            <option value="">Todas as formas</option>
            {formasAP.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filtCartaoAP} onChange={e => setFiltCartaoAP(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg outline-none">
            <option value="">💳 Todos os cartões</option>
            {cartaoIdsAP.map(id => <option key={id} value={id}>{cartoesMap[id] || id.substring(0, 8) + '...'}</option>)}
          </select>
          <input value={filtBuscaAP} onChange={e => setFiltBuscaAP(e.target.value)}
            placeholder="Buscar descrição..."
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg outline-none w-48 placeholder-slate-500" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-indigo-500/10 text-slate-400 text-xs uppercase tracking-widest">
                {['#','Descrição','Vencimento','Valor','Parcela','Forma Pgto','Status','Data Pgto','Valor Pago','Cartão','Origem'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium border-b border-slate-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-400">Nenhum registro encontrado.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-slate-100" title={r.descricao || ''}>{(r.descricao || '').substring(0, 35) || <span className="text-slate-500">—</span>}</td>
                  <td className="px-3 py-2">{fmtDate(r.data_vencimento)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-100">{fmtBRL(r.valor_parcela)}</td>
                  <td className="px-3 py-2 text-slate-400">{r.numero_parcela}/{r.total_parcelas}</td>
                  <td className="px-3 py-2">{r.forma_pagamento || <span className="text-slate-500">—</span>}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status_pagamento} dv={r.data_vencimento} /></td>
                  <td className="px-3 py-2">{fmtDate(r.data_pagamento)}</td>
                  <td className="px-3 py-2 text-green-400">{r.valor_pago ? fmtBRL(r.valor_pago) : '—'}</td>
                  <td className="px-3 py-2 text-cyan-400 text-xs max-w-[140px] truncate" title={r.cartao_id ? cartoesMap[r.cartao_id] || '' : ''}>
                    {r.cartao_id ? (cartoesMap[r.cartao_id] || r.cartao_id.substring(0, 8) + '...') : <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{r.origem_tipo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 -m-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            📊 Dashboard <span className="text-indigo-400">Financeiro</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Contas a Receber & Contas a Pagar em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Atualizado: {lastUpd}</span>
          <button onClick={fetchAll} className="flex items-center gap-1 text-xs bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <div className="flex items-center gap-1.5 bg-green-500/10 text-green-400 border border-green-500/25 rounded-full px-3 py-1 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Tempo Real
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex bg-slate-800 rounded-xl overflow-hidden border border-slate-700 mb-6">
            {([
              { id: 'visao',   label: '🏠 Visão Geral' },
              { id: 'receber', label: '💚 Contas a Receber' },
              { id: 'pagar',   label: '🔴 Contas a Pagar' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
                  tab === t.id
                    ? 'text-slate-100 border-indigo-500 bg-indigo-500/8'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-700/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === 'visao'   && <TabVisaoGeral />}
          {tab === 'receber' && <TabReceber />}
          {tab === 'pagar'   && <TabPagar />}
        </>
      )}
    </div>
  );
}
