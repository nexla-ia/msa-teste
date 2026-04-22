import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  LineElement, PointElement, Filler,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Users, Award, Bell, Calendar, AlertCircle, CheckCircle2,
  TrendingUp, DollarSign, ShoppingCart, AlertTriangle, Clock,
  Package, CreditCard, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  LineElement, PointElement, Filler,
  Title, Tooltip, Legend,
);

// ─── Types ────────────────────────────────────────────────────────────────────
type KPI = {
  receitaBruta: number;
  custoAquisicao: number;
  margemBruta: number;
  aReceberTotal: number;
  aReceberVencendo7d: number;
  aReceberVencendo7dCount: number;
  aPagarVencendo7d: number;
  aPagarVencendo7dCount: number;
  estoqueMilhasValor: number;
  ticketMedio: number;
  valorMilheiroMedio: number;
  contasVencidasValor: number;
  contasVencidasCount: number;
  receberVencidasCount: number;
  totalEntradasMes: number;
  totalSaidasMes: number;
};

type EstoquePrograma = {
  programa_id: string;
  programa_nome: string;
  total_pontos: number;
  valor_total: number;
};

type Atividade = {
  id: string;
  tipo_atividade: string;
  titulo: string;
  parceiro_nome: string;
  programa_nome: string;
  quantidade_pontos: number;
  data_prevista: string;
  prioridade: string;
  periodo: string;
  dias_restantes: number;
};

type AtividadeProcessada = {
  id: string;
  tipo_atividade: string;
  titulo: string;
  parceiro_nome: string;
  programa_nome: string;
  quantidade_pontos: number;
  processado_em: string;
};

type ProximoItem = {
  id: string;
  nome: string;
  data_vencimento: string;
  valor_parcela: number;
  status_pagamento: string;
};

type MesTrend = { mes: string; receita: number; custo: number };
type ProgramaPie = { nome: string; total: number };
type FluxoDia = { dia: string; entradas: number; saidas: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPts = (v: number) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const sum = (arr: Record<string, number>[], key: string) =>
  (arr || []).reduce((s, r) => s + (Number(r[key]) || 0), 0);
const fmtDate = (d: string) => {
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

const MES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun',
                   'Jul','Ago','Set','Out','Nov','Dez'];

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16'];

const TIPO_ICONS: Record<string, string> = {
  transferencia_entrada: '📥',
  transferencia_bonus: '🎁',
  bumerangue_retorno: '🔄',
  clube_credito_mensal: '💳',
  clube_credito_bonus: '⭐',
  outro: '📌',
};

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-700',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-amber-100 text-amber-700',
  urgente: 'bg-red-100 text-red-700',
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [kpi, setKpi] = useState<KPI>({
    receitaBruta: 0, custoAquisicao: 0, margemBruta: 0,
    aReceberTotal: 0, aReceberVencendo7d: 0, aReceberVencendo7dCount: 0,
    aPagarVencendo7d: 0, aPagarVencendo7dCount: 0,
    estoqueMilhasValor: 0, ticketMedio: 0, valorMilheiroMedio: 0,
    contasVencidasValor: 0, contasVencidasCount: 0, receberVencidasCount: 0,
    totalEntradasMes: 0, totalSaidasMes: 0,
  });
  const [estoque, setEstoque] = useState<EstoquePrograma[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [atividadesProcessadas, setAtividadesProcessadas] = useState<AtividadeProcessada[]>([]);
  const [proximosRecebimentos, setProximosRecebimentos] = useState<ProximoItem[]>([]);
  const [proximosPagamentos, setProximosPagamentos] = useState<ProximoItem[]>([]);
  const [tendencia, setTendencia] = useState<MesTrend[]>([]);
  const [porPrograma, setPorPrograma] = useState<ProgramaPie[]>([]);
  const [fluxo30, setFluxo30] = useState<FluxoDia[]>([]);
  const [loading, setLoading] = useState(true);

  const loadKPI = useCallback(async () => {
    const hoje = new Date().toISOString().split('T')[0];
    const d = new Date();
    const inicioMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const [
      { data: vendas },
      { data: compras },
      { data: comprasBon },
      { data: estoqueData },
      { data: contasVencidas },
      { data: aPagar7d },
      { data: receberPendentes },
      { data: receber7d },
      { data: receberVencidas },
      { data: entradasMes },
      { data: saidasMes },
    ] = await Promise.all([
      supabase.from('vendas').select('valor_total, valor_milheiro').gte('data_venda', inicioMes).neq('status', 'cancelada'),
      supabase.from('compras').select('valor_total').gte('data_entrada', inicioMes),
      supabase.from('compra_bonificada').select('custo_total').gte('data_compra', inicioMes),
      supabase.from('estoque_pontos').select('saldo_atual, custo_medio').gt('saldo_atual', 0),
      supabase.from('contas_a_pagar').select('valor_parcela').lt('data_vencimento', hoje).eq('status_pagamento', 'pendente'),
      supabase.from('contas_a_pagar').select('valor_parcela').gt('data_vencimento', hoje).lte('data_vencimento', em7dias).eq('status_pagamento', 'pendente'),
      supabase.from('contas_a_receber').select('valor_parcela').eq('status_pagamento', 'pendente'),
      supabase.from('contas_a_receber').select('valor_parcela').gt('data_vencimento', hoje).lte('data_vencimento', em7dias).eq('status_pagamento', 'pendente'),
      supabase.from('contas_a_receber').select('id', { count: 'exact', head: true }).lt('data_vencimento', hoje).eq('status_pagamento', 'pendente'),
      supabase.from('contas_a_receber').select('valor_parcela').gte('data_vencimento', inicioMes),
      supabase.from('contas_a_pagar').select('valor_parcela').gte('data_vencimento', inicioMes),
    ]);

    const receita = sum(vendas as any[] || [], 'valor_total');
    const custo = sum(compras as any[] || [], 'valor_total') + sum(comprasBon as any[] || [], 'custo_total');
    const qtdVendas = (vendas || []).length;
    const milheiroSum = (vendas || []).reduce((s, v: any) => s + (Number(v.valor_milheiro) || 0), 0);

    const estoqueValor = (estoqueData || []).reduce((s: number, r: any) =>
      s + Number(r.saldo_atual) * Number(r.custo_medio || 0) / 1000, 0);

    setKpi({
      receitaBruta: receita,
      custoAquisicao: custo,
      margemBruta: receita > 0 ? ((receita - custo) / receita) * 100 : 0,
      aReceberTotal: sum(receberPendentes as any[] || [], 'valor_parcela'),
      aReceberVencendo7d: sum(receber7d as any[] || [], 'valor_parcela'),
      aReceberVencendo7dCount: (receber7d || []).length,
      aPagarVencendo7d: sum(aPagar7d as any[] || [], 'valor_parcela'),
      aPagarVencendo7dCount: (aPagar7d || []).length,
      estoqueMilhasValor: estoqueValor,
      ticketMedio: qtdVendas > 0 ? receita / qtdVendas : 0,
      valorMilheiroMedio: qtdVendas > 0 ? milheiroSum / qtdVendas : 0,
      contasVencidasValor: sum(contasVencidas as any[] || [], 'valor_parcela'),
      contasVencidasCount: (contasVencidas || []).length,
      receberVencidasCount: (receberVencidas as any)?.count || 0,
      totalEntradasMes: sum(entradasMes as any[] || [], 'valor_parcela'),
      totalSaidasMes: sum(saidasMes as any[] || [], 'valor_parcela'),
    });
  }, []);

  const loadEstoque = useCallback(async () => {
    const { data } = await supabase
      .from('estoque_pontos')
      .select('saldo_atual, custo_medio, programa_id, programas_fidelidade(nome)')
      .gt('saldo_atual', 0);
    if (!data) return;
    const map: Record<string, EstoquePrograma> = {};
    for (const row of data) {
      const id = row.programa_id;
      const nome = (row.programas_fidelidade as any)?.nome || 'Desconhecido';
      if (!map[id]) map[id] = { programa_id: id, programa_nome: nome, total_pontos: 0, valor_total: 0 };
      map[id].total_pontos += Number(row.saldo_atual);
      map[id].valor_total += Number(row.saldo_atual) * Number(row.custo_medio || 0) / 1000;
    }
    setEstoque(Object.values(map).sort((a, b) => b.total_pontos - a.total_pontos));
  }, []);

  const loadAtividades = useCallback(async () => {
    const { data } = await supabase
      .from('atividades_pendentes')
      .select('*')
      .in('periodo', ['Hoje', 'Amanhã', 'Esta semana'])
      .limit(8);
    setAtividades(data || []);
  }, []);

  const loadAtividadesProcessadas = useCallback(async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const { data } = await supabase
      .from('atividades')
      .select('id, tipo_atividade, titulo, parceiro_nome, programa_nome, quantidade_pontos, processado_em')
      .eq('status', 'concluido')
      .gte('processado_em', hoje.toISOString())
      .lt('processado_em', amanha.toISOString())
      .order('processado_em', { ascending: false })
      .limit(8);
    setAtividadesProcessadas(data || []);
  }, []);

  const loadProximos = useCallback(async () => {
    const hoje = new Date().toISOString().split('T')[0];
    const em30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const [{ data: receber }, { data: pagar }] = await Promise.all([
      supabase.from('contas_a_receber')
        .select('id, data_vencimento, valor_parcela, status_pagamento, parceiros(nome)')
        .gte('data_vencimento', hoje)
        .lte('data_vencimento', em30)
        .neq('status_pagamento', 'pago')
        .order('data_vencimento')
        .limit(6),
      supabase.from('contas_a_pagar')
        .select('id, data_vencimento, valor_parcela, status_pagamento, descricao')
        .gte('data_vencimento', hoje)
        .lte('data_vencimento', em30)
        .neq('status_pagamento', 'pago')
        .order('data_vencimento')
        .limit(6),
    ]);

    setProximosRecebimentos((receber || []).map((r: any) => ({
      id: r.id,
      nome: r.parceiros?.nome || '—',
      data_vencimento: r.data_vencimento,
      valor_parcela: r.valor_parcela,
      status_pagamento: r.status_pagamento,
    })));
    setProximosPagamentos((pagar || []).map((r: any) => ({
      id: r.id,
      nome: r.descricao || '—',
      data_vencimento: r.data_vencimento,
      valor_parcela: r.valor_parcela,
      status_pagamento: r.status_pagamento,
    })));
  }, []);

  const loadTendencia = useCallback(async () => {
    const meses: MesTrend[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const fimStr = fim.toISOString().split('T')[0];
      const label = MES_SHORT[d.getMonth()];
      const [{ data: v }, { data: c }, { data: cb }] = await Promise.all([
        supabase.from('vendas').select('valor_total').gte('data_venda', inicio).lte('data_venda', fimStr).neq('status', 'cancelada'),
        supabase.from('compras').select('valor_total').gte('data_entrada', inicio).lte('data_entrada', fimStr),
        supabase.from('compra_bonificada').select('custo_total').gte('data_compra', inicio).lte('data_compra', fimStr),
      ]);
      meses.push({
        mes: label,
        receita: sum(v as any[] || [], 'valor_total'),
        custo: sum(c as any[] || [], 'valor_total') + sum(cb as any[] || [], 'custo_total'),
      });
    }
    setTendencia(meses);
  }, []);

  const loadPorPrograma = useCallback(async () => {
    const d = new Date();
    const inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const { data } = await supabase
      .from('vendas')
      .select('valor_total, programas_fidelidade(nome)')
      .gte('data_venda', inicio)
      .neq('status', 'cancelada');
    if (!data) return;
    const map: Record<string, number> = {};
    for (const row of data as any[]) {
      const nome = row.programas_fidelidade?.nome || 'Outros';
      map[nome] = (map[nome] || 0) + Number(row.valor_total || 0);
    }
    const sorted = Object.entries(map)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
    const top4 = sorted.slice(0, 4);
    const outros = sorted.slice(4).reduce((s, x) => s + x.total, 0);
    if (outros > 0) top4.push({ nome: 'Outros', total: outros });
    setPorPrograma(top4);
  }, []);

  const loadFluxo30 = useCallback(async () => {
    const hoje = new Date();
    const dias: FluxoDia[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i);
      dias.push({ dia: d.toISOString().split('T')[0], entradas: 0, saidas: 0 });
    }
    const inicio = dias[0].dia;
    const fim = dias[29].dia;
    const [{ data: receber }, { data: pagar }] = await Promise.all([
      supabase.from('contas_a_receber').select('data_vencimento, valor_parcela').gte('data_vencimento', inicio).lte('data_vencimento', fim).neq('status_pagamento', 'pago'),
      supabase.from('contas_a_pagar').select('data_vencimento, valor_parcela').gte('data_vencimento', inicio).lte('data_vencimento', fim).neq('status_pagamento', 'pago'),
    ]);
    const diaMap: Record<string, FluxoDia> = {};
    for (const d of dias) diaMap[d.dia] = d;
    for (const r of receber as any[] || []) {
      if (diaMap[r.data_vencimento]) diaMap[r.data_vencimento].entradas += Number(r.valor_parcela || 0);
    }
    for (const r of pagar as any[] || []) {
      if (diaMap[r.data_vencimento]) diaMap[r.data_vencimento].saidas += Number(r.valor_parcela || 0);
    }
    setFluxo30(dias);
  }, []);

  useEffect(() => {
    Promise.all([
      loadKPI(), loadEstoque(), loadAtividades(), loadAtividadesProcessadas(),
      loadProximos(), loadTendencia(), loadPorPrograma(), loadFluxo30(),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const saldoFinal = kpi.totalEntradasMes - kpi.totalSaidasMes;
  const totalEstoque = estoque.reduce((s, e) => s + e.total_pontos, 0);

  // A/R status breakdown
  const arEmDia = kpi.aReceberTotal - kpi.aReceberVencendo7d;
  const arTotal = kpi.aReceberTotal || 1;
  const arVencidoPct = Math.round((kpi.receberVencidasCount > 0 ? (kpi.receberVencidasCount / arTotal) * 100 : 0));
  const ar7dPct = Math.round((kpi.aReceberVencendo7d / arTotal) * 100);
  const arEmDiaPct = Math.max(0, 100 - arVencidoPct - ar7dPct);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Alert Banners */}
      <div className="space-y-2">
        {kpi.contasVencidasCount > 0 && (
          <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3 border-l-4 border-l-red-500">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-red-800 text-sm">
                {kpi.contasVencidasCount} Conta{kpi.contasVencidasCount !== 1 ? 's' : ''} a Pagar Vencida{kpi.contasVencidasCount !== 1 ? 's' : ''}
              </span>
              <span className="text-red-600 text-xs ml-2">
                Total de {fmtBRL(kpi.contasVencidasValor)} em atraso
              </span>
            </div>
          </div>
        )}
        {kpi.receberVencidasCount > 0 && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 border-l-4 border-l-amber-500">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-amber-800 text-sm">
                {kpi.receberVencidasCount} Recebimento{kpi.receberVencidasCount !== 1 ? 's' : ''} Vencido{kpi.receberVencidasCount !== 1 ? 's' : ''}
              </span>
              <span className="text-amber-600 text-xs ml-2">parcelas a receber em atraso</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl px-5 py-3 border-l-4 border-l-green-500">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-green-800 text-sm">
              {saldoFinal >= 0 ? 'Resultado Positivo' : 'Resultado Negativo'} — {fmtBRL(Math.abs(saldoFinal))}
            </span>
            <span className="text-green-600 text-xs ml-2">entradas menos saídas no mês atual</span>
          </div>
        </div>
      </div>

      {/* KPI Cards — 4+4 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Receita Bruta (Mês)"
          value={fmtBRL(kpi.receitaBruta)}
          sub="Fonte: vendas"
          icon={TrendingUp}
          accent="blue"
        />
        <KpiCard
          title="Custo de Aquisição"
          value={fmtBRL(kpi.custoAquisicao)}
          sub="compras + bonificadas"
          icon={ShoppingCart}
          accent="red"
        />
        <KpiCard
          title="Margem Bruta"
          value={`${kpi.margemBruta.toFixed(1)}%`}
          sub="(Receita − Custo) / Receita"
          icon={Award}
          accent={kpi.margemBruta >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="A Receber (7 dias)"
          value={fmtBRL(kpi.aReceberVencendo7d)}
          sub={`${kpi.aReceberVencendo7dCount} parcelas`}
          icon={ArrowDownCircle}
          accent="emerald"
        />
        <KpiCard
          title="A Pagar (7 dias)"
          value={fmtBRL(kpi.aPagarVencendo7d)}
          sub={`${kpi.aPagarVencendo7dCount} parcelas`}
          icon={ArrowUpCircle}
          accent="orange"
        />
        <KpiCard
          title="Estoque de Milhas"
          value={fmtBRL(kpi.estoqueMilhasValor)}
          sub={`${fmtPts(totalEstoque)} pts — custo médio`}
          icon={Package}
          accent="purple"
        />
        <KpiCard
          title="Ticket Médio Venda"
          value={fmtBRL(kpi.ticketMedio)}
          sub="valor_total / qtd vendas"
          icon={DollarSign}
          accent="indigo"
        />
        <KpiCard
          title="Valor Milheiro Médio"
          value={fmtBRL(kpi.valorMilheiroMedio)}
          sub="média vendas do mês"
          icon={CreditCard}
          accent="cyan"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receita vs Custo */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Receita vs Custo — Últimos 6 Meses</h3>
          <p className="text-xs text-slate-400 mb-4">Evolução financeira mensal</p>
          <Bar
            data={{
              labels: tendencia.map(t => t.mes),
              datasets: [
                { label: 'Receita', data: tendencia.map(t => t.receita), backgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'Custo', data: tendencia.map(t => t.custo), backgroundColor: '#ef4444', borderRadius: 4 },
              ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { ticks: { callback: (v) => `R$${Number(v)/1000}k` } } },
            }}
          />
        </div>

        {/* Receita por Programa */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Receita por Programa</h3>
          <p className="text-xs text-slate-400 mb-4">Distribuição do mês atual</p>
          {porPrograma.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Sem dados no mês</div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-48 h-48 flex-shrink-0">
                <Doughnut
                  data={{
                    labels: porPrograma.map(p => p.nome),
                    datasets: [{
                      data: porPrograma.map(p => p.total),
                      backgroundColor: PIE_COLORS,
                      borderWidth: 2,
                      borderColor: '#fff',
                    }],
                  }}
                  options={{ plugins: { legend: { display: false } }, cutout: '65%' }}
                />
              </div>
              <div className="flex-1 space-y-2">
                {porPrograma.map((p, i) => {
                  const total = porPrograma.reduce((s, x) => s + x.total, 0);
                  const pct = total > 0 ? Math.round((p.total / total) * 100) : 0;
                  return (
                    <div key={p.nome} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                      <span className="text-xs text-slate-600 flex-1 truncate">{p.nome}</span>
                      <span className="text-xs font-semibold text-slate-700">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fluxo de Caixa 30 dias */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Fluxo de Caixa — 30 Dias</h3>
          <p className="text-xs text-slate-400 mb-4">Entradas e saídas projetadas por vencimento</p>
          <Line
            data={{
              labels: fluxo30.map((d, i) => i % 5 === 0 ? d.dia.split('-')[2] : ''),
              datasets: [
                {
                  label: 'Entradas',
                  data: fluxo30.map(d => d.entradas),
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 2,
                },
                {
                  label: 'Saídas',
                  data: fluxo30.map(d => d.saidas),
                  borderColor: '#ef4444',
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 2,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { ticks: { callback: (v) => `R$${Number(v)/1000}k` } } },
            }}
          />
        </div>

        {/* Status A/R */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Status A/R</h3>
          <p className="text-xs text-slate-400 mb-6">Contas a receber por situação</p>
          <div className="space-y-5">
            <StatusBar label="Em dia" pct={arEmDiaPct} color="bg-green-500" value={fmtBRL(arEmDia)} />
            <StatusBar label="Vencendo 7d" pct={ar7dPct} color="bg-amber-400" value={fmtBRL(kpi.aReceberVencendo7d)} />
            <StatusBar label="Vencido" pct={arVencidoPct} color="bg-red-500" value={`${kpi.receberVencidasCount} parcela${kpi.receberVencidasCount !== 1 ? 's' : ''}`} />
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total A/R Pendente</span>
              <span className="font-bold text-slate-800">{fmtBRL(kpi.aReceberTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Próximos Recebimentos + Pagamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProximosTable
          title="Próximos Recebimentos"
          icon={<ArrowDownCircle className="w-4 h-4 text-green-600" />}
          items={proximosRecebimentos}
          colLabel="Parceiro/Cliente"
          colorScheme="green"
        />
        <ProximosTable
          title="Próximos Pagamentos"
          icon={<ArrowUpCircle className="w-4 h-4 text-red-500" />}
          items={proximosPagamentos}
          colLabel="Fornecedor/Descrição"
          colorScheme="red"
        />
      </div>

      {/* Resumo do Mês */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ResumoCard label="Total Entradas" value={fmtBRL(kpi.totalEntradasMes)} accent="green" />
        <ResumoCard label="Total Saídas" value={fmtBRL(kpi.totalSaidasMes)} accent="red" />
        <ResumoCard label="Resultado do Mês" value={fmtBRL(saldoFinal)} accent={saldoFinal >= 0 ? 'green' : 'red'} />
        <ResumoCard label="A Receber (Total)" value={fmtBRL(kpi.aReceberTotal)} accent="blue" />
      </div>

      {/* Estoque por Programa */}
      {estoque.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Estoque de Pontos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {estoque.map((prog) => (
              <div key={prog.programa_id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-purple-50 p-1.5 rounded-lg flex-shrink-0">
                    <Package className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-semibold text-slate-700 text-sm truncate">{prog.programa_nome}</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">{fmtPts(prog.total_pontos)}</p>
                <p className="text-xs text-slate-400 mt-1">pts · {fmtBRL(prog.valor_total)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Atividades */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-amber-50 p-2 rounded-lg">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Atividades Pendentes</h3>
              <p className="text-xs text-slate-500">Entradas de pontos desta semana</p>
            </div>
          </div>
          {atividades.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma atividade pendente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {atividades.map((a) => (
                <div key={a.id} className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-base">{TIPO_ICONS[a.tipo_atividade] || '📌'}</span>
                        <span className="font-medium text-slate-800 text-sm truncate">{a.titulo}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${PRIORIDADE_COLORS[a.prioridade] || 'bg-slate-100 text-slate-600'}`}>
                          {a.prioridade}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        {a.parceiro_nome && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />{a.parceiro_nome}
                          </span>
                        )}
                        {a.quantidade_pontos > 0 && (
                          <span className="text-green-600 font-semibold">+{fmtPts(a.quantidade_pontos)} pts</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
                        <Calendar className="w-3 h-3" />
                        {a.data_prevista
                          ? new Date(a.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '-'}
                      </div>
                      <span className="text-xs text-slate-400">{a.periodo}{a.dias_restantes > 0 ? ` (${a.dias_restantes}d)` : ''}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Pontos Creditados Hoje</h3>
              <p className="text-xs text-slate-500">Entradas processadas hoje</p>
            </div>
          </div>
          {atividadesProcessadas.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum ponto creditado hoje</p>
            </div>
          ) : (
            <div className="space-y-2">
              {atividadesProcessadas.map((a) => (
                <div key={a.id} className="bg-white border border-green-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-base">{TIPO_ICONS[a.tipo_atividade] || '📌'}</span>
                        <span className="font-medium text-slate-800 text-sm truncate">{a.titulo}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700 flex-shrink-0">Creditado</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        {a.parceiro_nome && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />{a.parceiro_nome}
                          </span>
                        )}
                        {a.quantidade_pontos > 0 && (
                          <span className="text-green-600 font-semibold">+{fmtPts(a.quantidade_pontos)} pts</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {new Date(a.processado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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

function KpiCard({
  title, value, sub, icon: Icon, accent,
}: {
  title: string; value: string; sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: keyof typeof ACCENT_MAP;
}) {
  const c = ACCENT_MAP[accent];
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${c.border}`}>
      <div className={`inline-flex p-2 rounded-lg mb-3 ${c.bg}`}>
        <Icon className={`w-4 h-4 ${c.icon}`} />
      </div>
      <p className="text-xs text-slate-500 font-medium mb-1 leading-tight">{title}</p>
      <p className={`text-xl font-bold ${c.value}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function StatusBar({ label, pct, color, value }: { label: string; pct: number; color: string; value: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-700">{value}</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-1 text-right">{pct}%</p>
    </div>
  );
}

function ProximosTable({
  title, icon, items, colLabel, colorScheme,
}: {
  title: string;
  icon: React.ReactNode;
  items: ProximoItem[];
  colLabel: string;
  colorScheme: 'green' | 'red';
}) {
  const hoje = new Date().toISOString().split('T')[0];
  const statusColor = (item: ProximoItem) => {
    if (item.status_pagamento === 'parcial') return 'bg-blue-100 text-blue-700';
    if (item.data_vencimento < hoje) return 'bg-red-100 text-red-700';
    const diff = (new Date(item.data_vencimento).getTime() - Date.now()) / 86400000;
    if (diff <= 3) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };
  const statusLabel = (item: ProximoItem) => {
    if (item.status_pagamento === 'parcial') return 'Parcial';
    if (item.data_vencimento < hoje) return 'Vencido';
    const diff = (new Date(item.data_vencimento).getTime() - Date.now()) / 86400000;
    if (diff <= 3) return 'Urgente';
    return 'Pendente';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        {icon}
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <span className="ml-auto text-xs text-slate-400">{items.length} itens</span>
      </div>
      {items.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nenhum item nos próximos 30 dias</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-2 text-left">{colLabel}</th>
              <th className="px-4 py-2 text-left">Vencimento</th>
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-slate-700 truncate max-w-[180px]">{item.nome}</td>
                <td className="px-4 py-2.5 text-slate-500">{fmtDate(item.data_vencimento)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{fmtBRL(item.valor_parcela)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(item)}`}>
                    {statusLabel(item)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ResumoCard({ label, value, accent }: { label: string; value: string; accent: 'green' | 'red' | 'blue' }) {
  const colors = {
    green: 'border-t-green-500 text-green-700',
    red:   'border-t-red-500 text-red-600',
    blue:  'border-t-blue-500 text-blue-700',
  };
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-t-4 ${colors[accent]}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-xl font-bold ${colors[accent]}`}>{value}</p>
    </div>
  );
}
