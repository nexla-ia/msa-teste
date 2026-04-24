import { useEffect, useState, useCallback, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/formatters';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  PlusCircle, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  Building2, Search, Link2, Trash2
} from 'lucide-react';
import ImportarExtratoOFX from '../components/ImportarExtratoOFX';

type ConciliacaoItem = {
  id: string;
  conta_bancaria_id: string;
  data_extrato: string;
  descricao_extrato: string;
  valor_extrato: number;
  tipo: 'credito' | 'debito';
  lancamento_id: string | null;
  venda_id: string | null;
  centro_custo_id: string | null;
  status: 'conciliado' | 'pendente' | 'divergente';
  observacao: string | null;
  conta_bancaria?: { nome_banco: string } | null;
  lancamento?: { descricao: string; valor: number } | null;
  venda?: { ordem_compra: string | null; valor_total: number; clientes: { nome_cliente: string } | null; parceiros: { nome_parceiro: string } | null } | null;
};

type ContaBancaria = { id: string; nome_banco: string };
type Lancamento = { id: string; descricao: string; valor: number; tipo: string; data_lancamento: string };
type Venda = { id: string; ordem_compra: string | null; valor_total: number; data_venda: string; clientes: { nome_cliente: string } | null; parceiros: { nome_parceiro: string } | null };
type CentroCusto = { id: string; nome: string };

const MES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getMeses() {
  const lista = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    lista.push({ val, label: `${MES_FULL[d.getMonth()]} ${d.getFullYear()}` });
  }
  return lista;
}

const STATUS_MAP = {
  conciliado:  { label: 'Conciliado',  color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  pendente:    { label: 'Pendente',    color: 'bg-amber-100 text-amber-700',  icon: Clock },
  divergente:  { label: 'Divergente',  color: 'bg-red-100 text-red-700',     icon: AlertTriangle },
};

export default function ConciliacaoBancaria() {
  const meses = getMeses();
  const [mesSel, setMesSel] = useState(meses[0].val);
  const [contaSel, setContaSel] = useState<string>('');
  const [items, setItems] = useState<ConciliacaoItem[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [vinculoOpen, setVinculoOpen] = useState(false);
  const [vinculoItem, setVinculoItem] = useState<ConciliacaoItem | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'conciliado' | 'divergente'>('todos');
  const [form, setForm] = useState({
    data_extrato: new Date().toISOString().split('T')[0],
    descricao_extrato: '',
    valor_extrato: 0,
    tipo: 'credito' as 'credito' | 'debito',
    observacao: '',
  });
  const [dialog, setDialog] = useState<{
    isOpen: boolean; type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string; message: string; onConfirm?: () => void;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const loadContas = useCallback(async () => {
    const [{ data: contas }, { data: cc }] = await Promise.all([
      supabase.from('contas_bancarias').select('id, nome_banco').order('nome_banco'),
      supabase.from('centro_custos').select('id, nome').order('nome'),
    ]);
    setContas(contas || []);
    setCentrosCusto(cc || []);
    if (contas && contas.length > 0 && !contaSel) setContaSel(contas[0].id);
  }, [contaSel]);

  const loadData = useCallback(async () => {
    if (!contaSel) return;
    setLoading(true);
    const [ano, m] = mesSel.split('-').map(Number);
    const inicio = `${mesSel}-01`;
    const fim = `${mesSel}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`;

    // Vendas não conciliadas dos últimos 6 meses (pagamento pode vir em mês diferente)
    const seisAtras = new Date(ano, m - 7, 1);
    const seisAtrasStr = `${seisAtras.getFullYear()}-${String(seisAtras.getMonth() + 1).padStart(2, '0')}-01`;

    const [concRes, lancRes, vendasRes] = await Promise.all([
      supabase.from('conciliacao_bancaria')
        .select('*, conta_bancaria:contas_bancarias(nome_banco), lancamento:lancamentos_financeiros(descricao,valor), venda:vendas(ordem_compra,valor_total,clientes(nome_cliente),parceiros(nome_parceiro)), centro_custo:centro_custos(nome)')
        .eq('conta_bancaria_id', contaSel)
        .gte('data_extrato', inicio)
        .lte('data_extrato', fim)
        .order('data_extrato', { ascending: false }),
      supabase.from('lancamentos_financeiros')
        .select('id, descricao, valor, tipo, data_lancamento')
        .gte('data_lancamento', inicio)
        .lte('data_lancamento', fim)
        .eq('conta_bancaria_id', contaSel)
        .order('data_lancamento', { ascending: false }),
      supabase.from('vendas')
        .select('id, ordem_compra, valor_total, data_venda, clientes(nome_cliente), parceiros(nome_parceiro)')
        .eq('conciliado', false)
        .gte('data_venda', seisAtrasStr)
        .order('data_venda', { ascending: false }),
    ]);
    setItems(concRes.data || []);
    setLancamentos(lancRes.data || []);
    setVendas((vendasRes.data || []) as Venda[]);
    setLoading(false);
  }, [contaSel, mesSel]);

  useEffect(() => { loadContas(); }, [loadContas]);
  useEffect(() => { if (contaSel) loadData(); }, [contaSel, mesSel, loadData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('conciliacao_bancaria').insert({
        conta_bancaria_id: contaSel,
        data_extrato: form.data_extrato,
        descricao_extrato: form.descricao_extrato,
        valor_extrato: form.valor_extrato,
        tipo: form.tipo,
        observacao: form.observacao || null,
        status: 'pendente',
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setModalOpen(false);
      loadData();
      setDialog({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Lançamento do extrato adicionado!' });
    } catch (err: any) {
      setDialog({ isOpen: true, type: 'error', title: 'Erro', message: err.message });
    }
  };

  const handleVincular = async (lancamentoId: string) => {
    if (!vinculoItem) return;
    try {
      const lanc = lancamentos.find(l => l.id === lancamentoId);
      const divergente = lanc && Math.abs(lanc.valor - vinculoItem.valor_extrato) > 0.01;
      const { error } = await supabase.from('conciliacao_bancaria').update({
        lancamento_id: lancamentoId,
        venda_id: null,
        status: divergente ? 'divergente' : 'conciliado',
        data_conciliacao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', vinculoItem.id);
      if (error) throw error;
      await supabase.from('lancamentos_financeiros').update({ conciliado: true }).eq('id', lancamentoId);
      setVinculoOpen(false);
      setVinculoItem(null);
      loadData();
      setDialog({ isOpen: true, type: 'success', title: 'Conciliado!', message: divergente ? 'Vinculado com divergência de valor.' : 'Lançamento conciliado com sucesso!' });
    } catch (err: any) {
      setDialog({ isOpen: true, type: 'error', title: 'Erro', message: err.message });
    }
  };

  const handleVincularVenda = async (vendaId: string) => {
    if (!vinculoItem) return;
    try {
      const venda = vendas.find(v => v.id === vendaId);
      const divergente = venda && Math.abs(venda.valor_total - vinculoItem.valor_extrato) > 0.01;
      const { error } = await supabase.from('conciliacao_bancaria').update({
        venda_id: vendaId,
        lancamento_id: null,
        status: divergente ? 'divergente' : 'conciliado',
        data_conciliacao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', vinculoItem.id);
      if (error) throw error;
      await supabase.from('vendas').update({ conciliado: true }).eq('id', vendaId);
      setVinculoOpen(false);
      setVinculoItem(null);
      loadData();
      setDialog({ isOpen: true, type: 'success', title: 'Conciliado!', message: divergente ? 'Venda vinculada com divergência de valor.' : 'Venda conciliada com sucesso!' });
    } catch (err: any) {
      setDialog({ isOpen: true, type: 'error', title: 'Erro', message: err.message });
    }
  };

  const handleDesconciliar = async (item: ConciliacaoItem) => {
    await supabase.from('conciliacao_bancaria').update({
      lancamento_id: null, venda_id: null, status: 'pendente',
      data_conciliacao: null, updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    if (item.lancamento_id)
      await supabase.from('lancamentos_financeiros').update({ conciliado: false }).eq('id', item.lancamento_id);
    if (item.venda_id)
      await supabase.from('vendas').update({ conciliado: false }).eq('id', item.venda_id);
    loadData();
  };

  const handleUpdateField = async (id: string, field: string, value: string | null) => {
    await supabase.from('conciliacao_bancaria')
      .update({ [field]: value || null, updated_at: new Date().toISOString() })
      .eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value || null } : i));
  };

  const handleDelete = (item: ConciliacaoItem) => {
    setDialog({
      isOpen: true, type: 'warning', title: 'Excluir',
      message: 'Excluir este lançamento do extrato?',
      onConfirm: async () => {
        await supabase.from('conciliacao_bancaria').delete().eq('id', item.id);
        loadData();
        setDialog({ isOpen: true, type: 'success', title: 'Removido', message: 'Lançamento removido.' });
      }
    });
  };

  const filtered = items.filter(i => {
    const matchBusca = !busca || i.descricao_extrato.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || i.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const totais = {
    pendente:   items.filter(i => i.status === 'pendente').length,
    conciliado: items.filter(i => i.status === 'conciliado').length,
    divergente: items.filter(i => i.status === 'divergente').length,
  };

  const mesLabel = meses.find(m => m.val === mesSel)?.label || '';
  const contaLabel = contas.find(c => c.id === contaSel)?.nome_banco || '';

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Conciliação Bancária</h1>
            <p className="text-slate-500 text-sm">Extrato do banco vs lançamentos financeiros</p>
          </div>
          <div className="flex items-center gap-2">
            {contaSel && (
              <ImportarExtratoOFX
                contaBancariaId={contaSel}
                contaBancariaNome={contaLabel}
                mesReferencia={mesSel}
                onImportSuccess={loadData}
              />
            )}
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              <PlusCircle className="w-4 h-4" /> Lançamento do Extrato
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={contaSel} onChange={e => setContaSel(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
            {contas.map(c => <option key={c.id} value={c.id}>{c.nome_banco}</option>)}
          </select>
          <select value={mesSel} onChange={e => setMesSel(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
            {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="todos">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="conciliado">Conciliado</option>
            <option value="divergente">Divergente</option>
          </select>
          <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar descrição..."
              className="flex-1 text-sm outline-none" />
          </div>
          <button onClick={loadData} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Status resumo */}
        <div className="grid grid-cols-3 gap-4">
          {(['pendente', 'conciliado', 'divergente'] as const).map(s => {
            const st = STATUS_MAP[s];
            return (
              <div key={s} className={`bg-white rounded-xl border shadow-sm p-4 ${s === 'conciliado' ? 'border-green-100' : s === 'pendente' ? 'border-amber-100' : 'border-red-100'}`}>
                <div className={`inline-flex p-2 rounded-lg mb-2 ${s === 'conciliado' ? 'bg-green-50' : s === 'pendente' ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <st.icon className={`w-4 h-4 ${s === 'conciliado' ? 'text-green-600' : s === 'pendente' ? 'text-amber-600' : 'text-red-500'}`} />
                </div>
                <p className="text-xs text-slate-500 font-medium">{st.label}</p>
                <p className={`text-2xl font-bold ${s === 'conciliado' ? 'text-green-700' : s === 'pendente' ? 'text-amber-700' : 'text-red-600'}`}>
                  {totais[s]}
                </p>
                <p className="text-xs text-slate-400">lançamentos</p>
              </div>
            );
          })}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Extrato — {contaLabel} · {mesLabel}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} lançamentos</p>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Nenhum lançamento no extrato para este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {['Data', 'Descrição', 'Tipo', 'Valor', 'Lançamento Vinculado', 'Centro de Custo', 'Obs.', 'Status', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const st = STATUS_MAP[item.status];
                    return (
                      <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(item.data_extrato)}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{item.descricao_extrato}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.tipo === 'credito' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {item.tipo === 'credito' ? 'Crédito' : 'Débito'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${item.tipo === 'credito' ? 'text-green-600' : 'text-red-500'}`}>
                          {fmtBRL(item.valor_extrato)}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[180px]">
                          {item.venda ? (
                            <div>
                              <span className="text-emerald-600 font-semibold block truncate">
                                {item.venda.ordem_compra || 'Venda'}
                              </span>
                              <span className="text-slate-400 truncate block">
                                {item.venda.clientes?.nome_cliente || item.venda.parceiros?.nome_parceiro || '—'}
                              </span>
                            </div>
                          ) : item.lancamento ? (
                            <span className="text-blue-600 truncate block">{item.lancamento.descricao}</span>
                          ) : (
                            <span className="text-slate-300">Não vinculado</span>
                          )}
                        </td>
                        <td className="px-2 py-2 min-w-[140px]">
                          <select
                            value={item.centro_custo_id || ''}
                            onChange={e => handleUpdateField(item.id, 'centro_custo_id', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-700"
                          >
                            <option value="">—</option>
                            {centrosCusto.map(cc => (
                              <option key={cc.id} value={cc.id}>{cc.nome}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 min-w-[140px]">
                          <input
                            type="text"
                            defaultValue={item.observacao || ''}
                            onBlur={e => handleUpdateField(item.id, 'observacao', e.target.value)}
                            placeholder="Observação..."
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-700 placeholder-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            <st.icon className="w-3 h-3" />{st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {item.status !== 'conciliado' && (
                              <button
                                onClick={() => { setVinculoItem(item); setVinculoOpen(true); }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Vincular lançamento"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {item.status === 'conciliado' && (
                              <button
                                onClick={() => handleDesconciliar(item)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                title="Desconciliar"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(item)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Modal: Novo lançamento do extrato */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Lançamento do Extrato Bancário">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data <span className="text-red-500">*</span></label>
              <input type="date" required value={form.data_extrato} onChange={e => setForm({ ...form, data_extrato: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo <span className="text-red-500">*</span></label>
              <select required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="credito">Crédito (entrada)</option>
                <option value="debito">Débito (saída)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Extrato <span className="text-red-500">*</span></label>
            <input required value={form.descricao_extrato} onChange={e => setForm({ ...form, descricao_extrato: e.target.value })}
              placeholder="Ex: PIX RECEBIDO JOAO SILVA" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) <span className="text-red-500">*</span></label>
            <input type="number" step="0.01" min="0" required value={form.valor_extrato || ''} onChange={e => setForm({ ...form, valor_extrato: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <textarea rows={2} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Adicionar</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Vincular lançamento */}
      <Modal isOpen={vinculoOpen} onClose={() => { setVinculoOpen(false); setVinculoItem(null); }} title="Vincular à Conciliação">
        {vinculoItem && (() => {
          const sugestoes = vendas.filter(v => Math.abs(v.valor_total - vinculoItem.valor_extrato) <= 0.01);
          const demaisVendas = vendas.filter(v => Math.abs(v.valor_total - vinculoItem.valor_extrato) > 0.01);
          return (
            <div className="space-y-4">
              {/* Info do extrato */}
              <div className="p-3 bg-slate-50 rounded-lg text-sm border border-slate-200">
                <p className="font-medium text-slate-700 truncate">{vinculoItem.descricao_extrato}</p>
                <p className={`font-bold mt-1 ${vinculoItem.tipo === 'credito' ? 'text-green-600' : 'text-red-500'}`}>
                  {fmtBRL(vinculoItem.valor_extrato)}
                  <span className="font-normal text-slate-400 ml-2">{vinculoItem.tipo === 'credito' ? 'Crédito' : 'Débito'} · {formatDate(vinculoItem.data_extrato)}</span>
                </p>
              </div>

              {/* Seção Vendas — para créditos */}
              {vinculoItem.tipo === 'credito' && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Vendas</p>
                  {vendas.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-3 bg-slate-50 rounded-lg">Nenhuma venda pendente de conciliação</p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {/* Sugestões com valor idêntico — destacadas */}
                      {sugestoes.map(v => (
                        <button key={v.id} onClick={() => handleVincularVenda(v.id)}
                          className="w-full text-left p-3 border-2 border-emerald-400 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold shrink-0">✨ Sugestão</span>
                                <p className="text-sm font-semibold text-slate-800 truncate">{v.ordem_compra || '—'}</p>
                              </div>
                              <p className="text-xs text-slate-500 truncate">
                                {v.clientes?.nome_cliente || v.parceiros?.nome_parceiro || '—'} · {new Date(v.data_venda + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-emerald-700 shrink-0">{fmtBRL(v.valor_total)}</p>
                          </div>
                        </button>
                      ))}
                      {/* Demais vendas */}
                      {demaisVendas.map(v => (
                        <button key={v.id} onClick={() => handleVincularVenda(v.id)}
                          className="w-full text-left p-3 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{v.ordem_compra || '—'} · {v.clientes?.nome_cliente || v.parceiros?.nome_parceiro || '—'}</p>
                              <p className="text-xs text-slate-400">{new Date(v.data_venda + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-slate-700">{fmtBRL(v.valor_total)}</p>
                              <p className="text-[10px] text-amber-600">valor diferente</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Seção Lançamentos Financeiros */}
              {lancamentos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lançamentos Financeiros</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {lancamentos.map(l => (
                      <button key={l.id} onClick={() => handleVincular(l.id)}
                        className="w-full text-left p-3 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{l.descricao}</p>
                            <p className="text-xs text-slate-400">{formatDate(l.data_lancamento)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${l.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>{fmtBRL(l.valor)}</p>
                            {Math.abs(l.valor - vinculoItem.valor_extrato) > 0.01 && (
                              <p className="text-[10px] text-amber-600">valor diferente</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {vinculoItem.tipo === 'credito' && vendas.length === 0 && lancamentos.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum item disponível para vincular</p>
              )}

              <button onClick={() => { setVinculoOpen(false); setVinculoItem(null); }}
                className="w-full px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm">
                Cancelar
              </button>
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog isOpen={dialog.isOpen} type={dialog.type} title={dialog.title} message={dialog.message}
        onClose={() => setDialog({ ...dialog, isOpen: false })} onConfirm={dialog.onConfirm} />
    </>
  );
}
