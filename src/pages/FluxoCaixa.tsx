import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/formatters';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
} from 'chart.js';
import {
  TrendingUp, TrendingDown, Building2,
  ArrowDownCircle, ArrowUpCircle, Clock,
  AlertCircle, CheckCircle2, Wallet, RefreshCw
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ─── Types ────────────────────────────────────────────────────────────────────
type KPIs = {
  saldoBancario: number;
  totalEntradas: number;
  totalSaidas: number;
  qtdEntradas: number;
  qtdSaidas: number;
  aReceberPendente: number;
  aPagarPendente: number;
  aReceberVencido: number;
  aPagarVencido: number;
};

type FluxoDia = { label: string; entradas: number; saidas: number };
type ProjecaoSemana = { label: string; aReceber: number; aPagar: number };
type Transacao = {
  data: string; descricao: string; categoria: string;
  tipo: 'entrada' | 'saida'; valor: number; status: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getMeses() {
  const lista = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    lista.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return lista;
}

function getDiasDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const total = new Date(ano, m, 0).getDate();
  return Array.from({ length: total }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return { key: `${mes}-${d}`, label: `${d}/${String(m).padStart(2, '0')}` };
  });
}

function getProximasOitoSemanas() {
  const hoje = new Date();
  return Array.from({ length: 8 }, (_, i) => {
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() + i * 7);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    return {
      label: `${inicio.getDate().toString().padStart(2, '0')}/${(inicio.getMonth() + 1).toString().padStart(2, '0')}`,
      inicio: inicio.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0],
    };
  });
}

// ─── Accent map — idêntico ao Dashboard ───────────────────────────────────────
const ACCENT_MAP = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    value: 'text-blue-700',    border: 'border-blue-100' },
  red:     { bg: 'bg-red-50',     icon: 'text-red-500',     value: 'text-red-600',     border: 'border-red-100' },
  green:   { bg: 'bg-green-50',   icon: 'text-green-600',   value: 'text-green-700',   border: 'border-green-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700', border: 'border-emerald-100' },
  orange:  { bg: 'bg-orange-50',  icon: 'text-orange-500',  value: 'text-orange-600',  border: 'border-orange-100' },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  value: 'text-purple-700',  border: 'border-purple-100' },
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  value: 'text-indigo-700',  border: 'border-indigo-100' },
  cyan:    { bg: 'bg-cyan-50',    icon: 'text-cyan-600',    value: 'text-cyan-700',    border: 'border-cyan-100' },
} as const;

// ─── KpiCard — mesmo componente do Dashboard ──────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, accent, loading }: {
  title: string; value: string; sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: keyof typeof ACCENT_MAP;
  loading?: boolean;
}) {
  const c = ACCENT_MAP[accent];
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${c.border}`}>
      <div className={`inline-flex p-2 rounded-lg mb-3 ${c.bg}`}>
        <Icon className={`w-4 h-4 ${c.icon}`} />
      </div>
      <p className="text-xs text-slate-500 font-medium mb-1 leading-tight">{title}</p>
      {loading ? (
        <div className="h-7 w-24 bg-slate-100 rounded animate-pulse mb-0.5" />
      ) : (
        <p className={`text-xl font-bold ${c.value}`}>{value}</p>
      )}
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pago:     'bg-green-100 text-green-700',
    pendente: 'bg-amber-100 text-amber-700',
    atrasado: 'bg-red-100 text-red-700',
    parcial:  'bg-blue-100 text-blue-700',
  };
  const labels: Record<string, string> = {
    pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado', parcial: 'Parcial'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {labels[status] || status}
    </span>
  );
}

// ─── Chart options ────────────────────────────────────────────────────────────
const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { font: { size: 11 }, padding: 12 } },
    tooltip: { callbacks: { label: (ctx: any) => ` ${fmtBRL(ctx.raw as number)}` } },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
    y: {
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: { font: { size: 9 }, callback: (v: any) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}` },
    },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function FluxoCaixa() {
  const meses = getMeses();
  const [mesSel, setMesSel] = useState(meses[0].val);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({
    saldoBancario: 0, totalEntradas: 0, totalSaidas: 0,
    qtdEntradas: 0, qtdSaidas: 0,
    aReceberPendente: 0, aPagarPendente: 0,
    aReceberVencido: 0, aPagarVencido: 0,
  });
  const [fluxoDiario, setFluxoDiario] = useState<FluxoDia[]>([]);
  const [projecao, setProjecao] = useState<ProjecaoSemana[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);

  const loadKpis = useCallback(async (mes: string) => {
    const hoje = new Date().toISOString().split('T')[0];
    const [bancosRes, receberRes, pagarRes, receberPendRes, pagarPendRes, receberVencRes, pagarVencRes] =
      await Promise.all([
        supabase.from('contas_bancarias').select('saldo_inicial').eq('ativo', true),
        supabase.from('contas_receber')
          .select('valor_pago, valor_parcela')
          .eq('status_pagamento', 'pago')
          .gte('data_pagamento', `${mes}-01`)
          .lte('data_pagamento', `${mes}-31`),
        supabase.from('contas_a_pagar')
          .select('valor_pago, valor_parcela')
          .eq('status_pagamento', 'pago')
          .gte('data_pagamento', `${mes}-01`)
          .lte('data_pagamento', `${mes}-31`),
        supabase.from('contas_receber')
          .select('valor_parcela')
          .in('status_pagamento', ['pendente', 'atrasado']),
        supabase.from('contas_a_pagar')
          .select('valor_parcela')
          .in('status_pagamento', ['pendente', 'atrasado']),
        supabase.from('contas_receber')
          .select('valor_parcela')
          .eq('status_pagamento', 'pendente')
          .lt('data_vencimento', hoje),
        supabase.from('contas_a_pagar')
          .select('valor_parcela')
          .eq('status_pagamento', 'pendente')
          .lt('data_vencimento', hoje),
      ]);

    const sum = (arr: any[], k: string) => (arr || []).reduce((s, r) => s + (Number(r[k]) || 0), 0);

    setKpis({
      saldoBancario: sum(bancosRes.data || [], 'saldo_inicial'),
      totalEntradas: sum(receberRes.data || [], 'valor_pago') || sum(receberRes.data || [], 'valor_parcela'),
      totalSaidas:   sum(pagarRes.data   || [], 'valor_pago') || sum(pagarRes.data   || [], 'valor_parcela'),
      qtdEntradas:   receberRes.data?.length || 0,
      qtdSaidas:     pagarRes.data?.length   || 0,
      aReceberPendente: sum(receberPendRes.data || [], 'valor_parcela'),
      aPagarPendente:   sum(pagarPendRes.data   || [], 'valor_parcela'),
      aReceberVencido:  sum(receberVencRes.data  || [], 'valor_parcela'),
      aPagarVencido:    sum(pagarVencRes.data    || [], 'valor_parcela'),
    });
  }, []);

  const loadFluxoDiario = useCallback(async (mes: string) => {
    const dias = getDiasDoMes(mes);
    const [ano, m] = mes.split('-').map(Number);
    const inicio = `${mes}-01`;
    const fim = `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`;

    const [{ data: rec }, { data: pag }] = await Promise.all([
      supabase.from('contas_receber')
        .select('data_vencimento, valor_parcela, valor_pago')
        .gte('data_vencimento', inicio).lte('data_vencimento', fim)
        .not('status_pagamento', 'eq', 'cancelado'),
      supabase.from('contas_a_pagar')
        .select('data_vencimento, valor_parcela, valor_pago')
        .gte('data_vencimento', inicio).lte('data_vencimento', fim)
        .not('status_pagamento', 'eq', 'cancelado'),
    ]);

    const entMap: Record<string, number> = {};
    const saiMap: Record<string, number> = {};
    for (const d of dias) { entMap[d.key] = 0; saiMap[d.key] = 0; }
    for (const r of rec || []) entMap[r.data_vencimento] = (entMap[r.data_vencimento] || 0) + (r.valor_pago ?? r.valor_parcela ?? 0);
    for (const p of pag || []) saiMap[p.data_vencimento] = (saiMap[p.data_vencimento] || 0) + (p.valor_pago ?? p.valor_parcela ?? 0);

    // Agrupa a cada 3 dias
    const grupos: FluxoDia[] = [];
    for (let i = 0; i < dias.length; i += 3) {
      const g = dias.slice(i, i + 3);
      grupos.push({
        label: g[0].label,
        entradas: g.reduce((s, d) => s + (entMap[d.key] || 0), 0),
        saidas:   g.reduce((s, d) => s + (saiMap[d.key] || 0), 0),
      });
    }
    setFluxoDiario(grupos);
  }, []);

  const loadProjecao = useCallback(async () => {
    const semanas = getProximasOitoSemanas();
    const resultado: ProjecaoSemana[] = [];
    for (const sem of semanas) {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from('contas_receber').select('valor_parcela')
          .in('status_pagamento', ['pendente', 'atrasado'])
          .gte('data_vencimento', sem.inicio).lte('data_vencimento', sem.fim),
        supabase.from('contas_a_pagar').select('valor_parcela')
          .in('status_pagamento', ['pendente', 'atrasado'])
          .gte('data_vencimento', sem.inicio).lte('data_vencimento', sem.fim),
      ]);
      resultado.push({
        label: sem.label,
        aReceber: (r || []).reduce((s, x) => s + (x.valor_parcela || 0), 0),
        aPagar:   (p || []).reduce((s, x) => s + (x.valor_parcela || 0), 0),
      });
    }
    setProjecao(resultado);
  }, []);

  const loadTransacoes = useCallback(async (mes: string) => {
    const [ano, m] = mes.split('-').map(Number);
    const inicio = `${mes}-01`;
    const fim = `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`;

    const [{ data: rec }, { data: pag }] = await Promise.all([
      supabase.from('contas_receber')
        .select('data_vencimento, valor_parcela, valor_pago, status_pagamento, observacao, origem_tipo')
        .gte('data_vencimento', inicio).lte('data_vencimento', fim)
        .not('status_pagamento', 'eq', 'cancelado')
        .order('data_vencimento', { ascending: true }),
      supabase.from('contas_a_pagar')
        .select('data_vencimento, valor_parcela, valor_pago, status_pagamento, descricao, parceiro:parceiros(nome_parceiro)')
        .gte('data_vencimento', inicio).lte('data_vencimento', fim)
        .not('status_pagamento', 'eq', 'cancelado')
        .order('data_vencimento', { ascending: true }),
    ]);

    const lista: Transacao[] = [];
    for (const r of rec || []) {
      lista.push({
        data: r.data_vencimento,
        descricao: r.observacao || (r.origem_tipo === 'venda' ? 'Venda de Milhas' : 'Recebimento'),
        categoria: r.origem_tipo === 'venda' ? 'Receita Venda' : 'A/R',
        tipo: 'entrada',
        valor: r.valor_pago ?? r.valor_parcela ?? 0,
        status: r.status_pagamento,
      });
    }
    for (const p of pag || []) {
      const parceiro = (p.parceiro as any)?.nome_parceiro;
      lista.push({
        data: p.data_vencimento,
        descricao: p.descricao || (parceiro ? `Pgto ${parceiro}` : 'Pagamento'),
        categoria: 'Contas a Pagar',
        tipo: 'saida',
        valor: p.valor_pago ?? p.valor_parcela ?? 0,
        status: p.status_pagamento,
      });
    }
    lista.sort((a, b) => a.data.localeCompare(b.data));
    setTransacoes(lista);
  }, []);

  const loadAll = useCallback(async (mes: string) => {
    setLoading(true);
    try {
      await Promise.all([loadKpis(mes), loadFluxoDiario(mes), loadTransacoes(mes), loadProjecao()]);
    } finally {
      setLoading(false);
    }
  }, [loadKpis, loadFluxoDiario, loadTransacoes, loadProjecao]);

  useEffect(() => { loadAll(mesSel); }, [mesSel, loadAll]);

  const saldoLiquido = kpis.totalEntradas - kpis.totalSaidas;
  const mesSelecionadoLabel = meses.find(m => m.val === mesSel)?.label || '';

  const fluxoDiarioData = {
    labels: fluxoDiario.map(d => d.label),
    datasets: [
      { label: 'Entradas', data: fluxoDiario.map(d => d.entradas), backgroundColor: '#10b981', borderRadius: 4 },
      { label: 'Saídas',   data: fluxoDiario.map(d => d.saidas),   backgroundColor: '#ef4444', borderRadius: 4 },
    ],
  };

  const projecaoData = {
    labels: projecao.map(s => s.label),
    datasets: [
      { label: 'A Receber', data: projecao.map(s => s.aReceber), backgroundColor: '#3b82f6', borderRadius: 4 },
      { label: 'A Pagar',   data: projecao.map(s => s.aPagar),   backgroundColor: '#f59e0b', borderRadius: 4 },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fluxo de Caixa</h1>
          <p className="text-slate-500 text-sm">Entradas, saídas e projeção financeira</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mesSel}
            onChange={e => setMesSel(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <button
            onClick={() => loadAll(mesSel)}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alert banners — mesmo padrão do Dashboard */}
      <div className="space-y-2">
        {!loading && kpis.aPagarVencido > 0 && (
          <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3 border-l-4 border-l-red-500">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-red-800 text-sm">Contas a Pagar Vencidas</span>
              <span className="text-red-600 text-xs ml-2">{formatCurrency(kpis.aPagarVencido)} em atraso</span>
            </div>
          </div>
        )}
        {!loading && kpis.aReceberVencido > 0 && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 border-l-4 border-l-amber-500">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-amber-800 text-sm">Recebimentos Vencidos</span>
              <span className="text-amber-600 text-xs ml-2">{formatCurrency(kpis.aReceberVencido)} em parcelas a receber em atraso</span>
            </div>
          </div>
        )}
        {!loading && (
          <div className={`flex items-center gap-4 rounded-xl px-5 py-3 border border-l-4
            ${saldoLiquido >= 0
              ? 'bg-green-50 border-green-200 border-l-green-500'
              : 'bg-red-50 border-red-200 border-l-red-500'}`}>
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${saldoLiquido >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <div className="flex-1 min-w-0">
              <span className={`font-semibold text-sm ${saldoLiquido >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {saldoLiquido >= 0 ? 'Resultado Positivo' : 'Resultado Negativo'} — {formatCurrency(Math.abs(saldoLiquido))}
              </span>
              <span className={`text-xs ml-2 ${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                entradas menos saídas no período selecionado
              </span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Saldo em Contas"
          value={fmtBRL(kpis.saldoBancario)}
          sub="Soma das contas bancárias"
          icon={Building2}
          accent="blue"
          loading={loading}
        />
        <KpiCard
          title="Entradas no Mês"
          value={fmtBRL(kpis.totalEntradas)}
          sub={`${kpis.qtdEntradas} pagamentos recebidos`}
          icon={ArrowDownCircle}
          accent="green"
          loading={loading}
        />
        <KpiCard
          title="Saídas no Mês"
          value={fmtBRL(kpis.totalSaidas)}
          sub={`${kpis.qtdSaidas} pagamentos efetuados`}
          icon={ArrowUpCircle}
          accent="red"
          loading={loading}
        />
        <KpiCard
          title="Resultado do Mês"
          value={fmtBRL(Math.abs(saldoLiquido))}
          sub={saldoLiquido >= 0 ? 'Superávit no período' : 'Déficit no período'}
          icon={saldoLiquido >= 0 ? TrendingUp : TrendingDown}
          accent={saldoLiquido >= 0 ? 'emerald' : 'orange'}
          loading={loading}
        />
      </div>

      {/* Workflow — Ciclo Financeiro */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Ciclo Financeiro</h3>
        <div className="flex items-start overflow-x-auto pb-1">
          {[
            { ico: '💰', label: 'Venda Realizada',   state: 'done'    },
            { ico: '📥', label: 'A/R Gerado',         state: 'done'    },
            { ico: '🔔', label: 'Cobrança / Venc.',   state: 'active'  },
            { ico: '💳', label: 'Pgto Recebido',      state: 'pending' },
            { ico: '🏦', label: 'Baixa no Banco',     state: 'pending' },
            { ico: '🔄', label: 'Conciliação',         state: 'pending' },
            { ico: '✅', label: 'Lançamento Contábil', state: 'pending' },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 px-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1.5 border-2
                  ${step.state === 'done'   ? 'border-green-400 bg-green-50'
                  : step.state === 'active' ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
                                            : 'border-slate-200 bg-slate-50 opacity-40'}`}>
                  {step.ico}
                </div>
                <span className={`text-xs font-medium text-center leading-tight whitespace-nowrap
                  ${step.state === 'done'   ? 'text-green-600'
                  : step.state === 'active' ? 'text-blue-600'
                                            : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <span className="text-slate-300 text-sm font-bold flex-shrink-0 pb-5">›</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Fluxo por Vencimento — {mesSelecionadoLabel}</h3>
          <p className="text-xs text-slate-400 mb-4">Entradas e saídas agrupadas a cada 3 dias</p>
          <div className="h-52">
            {loading ? (
              <div className="h-full bg-slate-50 rounded-lg animate-pulse" />
            ) : fluxoDiario.every(d => d.entradas === 0 && d.saidas === 0) ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Sem movimentações no período
              </div>
            ) : (
              <Bar data={fluxoDiarioData} options={CHART_OPTS} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Projeção — Próximas 8 Semanas</h3>
          <p className="text-xs text-slate-400 mb-4">Vencimentos pendentes agrupados por semana</p>
          <div className="h-52">
            {loading ? (
              <div className="h-full bg-slate-50 rounded-lg animate-pulse" />
            ) : projecao.every(s => s.aReceber === 0 && s.aPagar === 0) ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Sem vencimentos projetados
              </div>
            ) : (
              <Bar data={projecaoData} options={CHART_OPTS} />
            )}
          </div>
        </div>
      </div>

      {/* Resumo em cards pequenos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Entradas Realizadas',  value: fmtBRL(kpis.totalEntradas),      icon: CheckCircle2, accent: 'green'   as const },
          { label: 'Saídas Realizadas',    value: fmtBRL(kpis.totalSaidas),        icon: CheckCircle2, accent: 'red'     as const },
          { label: 'A Receber (em aberto)', value: fmtBRL(kpis.aReceberPendente),  icon: Clock,        accent: 'blue'    as const },
          { label: 'A Pagar (em aberto)',  value: fmtBRL(kpis.aPagarPendente),     icon: AlertCircle,  accent: 'orange'  as const },
        ].map((item, i) => {
          const c = ACCENT_MAP[item.accent];
          return (
            <div key={i} className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3 ${c.border}`}>
              <div className={`p-2 rounded-lg ${c.bg}`}>
                <item.icon className={`w-4 h-4 ${c.icon}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">{item.label}</p>
                {loading
                  ? <div className="h-5 w-20 bg-slate-100 rounded animate-pulse mt-0.5" />
                  : <p className={`text-sm font-bold ${c.value}`}>{item.value}</p>
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela Detalhamento */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">Detalhamento do Fluxo</h3>
            <p className="text-xs text-slate-400 mt-0.5">{mesSelecionadoLabel} · {transacoes.length} transações</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Entrada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Saída
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />)}
          </div>
        ) : transacoes.length === 0 ? (
          <div className="py-16 text-center">
            <Wallet className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Nenhuma transação no período selecionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Data', 'Descrição', 'Categoria', 'Entrada', 'Saída', 'Status'].map(h => (
                    <th key={h} className={`px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide ${h === 'Entrada' || h === 'Saída' ? 'text-right' : h === 'Status' ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transacoes.map((t, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(t.data)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.tipo === 'entrada' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-slate-700 text-sm truncate max-w-xs">{t.descricao}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${t.tipo === 'entrada' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {t.categoria}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {t.tipo === 'entrada'
                        ? <span className="text-green-600">{formatCurrency(t.valor)}</span>
                        : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {t.tipo === 'saida'
                        ? <span className="text-red-500">{formatCurrency(t.valor)}</span>
                        : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total do Período</td>
                  <td className="px-5 py-3 text-right font-bold text-green-600">
                    {formatCurrency(transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0))}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-red-500">
                    {formatCurrency(transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
