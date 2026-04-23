import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Send, Construction, Search, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const ACCENT = { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-blue-700', border: 'border-blue-100' };

interface Emissao {
  id: string;
  data: string;
  data_embarque: string | null;
  programa_id: string | null;
  parceiro_id: string | null;
  passageiro: string | null;
  origem: string | null;
  destino: string | null;
  localizacao: string | null;
  quantidade_milhas: number;
  quantidade_passageiros: number;
  status: string;
  observacao: string | null;
  venda_id: string | null;
  programa?: { nome: string } | null;
  parceiro?: { nome_parceiro: string } | null;
  venda?: VendaRef | null;
}

interface Parceiro { id: string; nome_parceiro: string; }
interface Programa { id: string; nome: string; }
interface VendaRef {
  id: string;
  ordem_compra: string | null;
  clientes: { nome_cliente: string } | null;
  programas_fidelidade: { nome: string } | null;
  quantidade_milhas: number;
  programa_id: string | null;
  parceiro_id: string | null;
}

const emptyForm = {
  data: new Date().toISOString().split('T')[0],
  data_embarque: '',
  programa_id: '',
  parceiro_id: '',
  passageiro: '',
  origem: '',
  destino: '',
  localizacao: '',
  quantidade_milhas: '',
  quantidade_passageiros: '1',
  status: 'ativo',
  observacao: '',
  venda_id: '',
};

export default function VendaDireta() {
  const { usuario } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);

  const [emissoes, setEmissoes] = useState<Emissao[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [editing, setEditing] = useState<Emissao | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [ocBusca, setOcBusca] = useState('');
  const [vendaBuscada, setVendaBuscada] = useState<VendaRef | null>(null);
  const [buscandoVenda, setBuscandoVenda] = useState(false);

  const [dialog, setDialog] = useState<{
    isOpen: boolean; type: 'success'|'error'|'confirm'|'warning';
    title: string; message: string; onConfirm?: () => void;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: em }, { data: pa }, { data: pr }] = await Promise.all([
      supabase.from('controle_emissoes')
        .select('*, programa:programas_fidelidade(nome), parceiro:parceiros(nome_parceiro), venda:vendas(id,ordem_compra,programa_id,parceiro_id,clientes(nome_cliente),programas_fidelidade(nome),quantidade_milhas)')
        .eq('tipo_venda', 'direta')
        .order('data', { ascending: false }),
      supabase.from('parceiros').select('id,nome_parceiro').order('nome_parceiro'),
      supabase.from('programas_fidelidade').select('id,nome').order('nome'),
    ]);
    setEmissoes((em || []) as Emissao[]);
    setParceiros(pa || []);
    setProgramas(pr || []);
    setLoading(false);
  };

  const abrirForm = (venda?: VendaRef) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      venda_id: venda?.id || '',
      programa_id: venda?.programa_id || '',
      parceiro_id: venda?.parceiro_id || '',
      quantidade_milhas: venda ? String(venda.quantidade_milhas) : '',
    });
    setOcBusca(venda?.ordem_compra || '');
    setVendaBuscada(venda || null);
    setFormAberto(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const abrirEdicao = (e: Emissao) => {
    setEditing(e);
    setForm({
      data: e.data,
      data_embarque: e.data_embarque || '',
      programa_id: e.programa_id || '',
      parceiro_id: e.parceiro_id || '',
      passageiro: e.passageiro || '',
      origem: e.origem || '',
      destino: e.destino || '',
      localizacao: e.localizacao || '',
      quantidade_milhas: String(e.quantidade_milhas),
      quantidade_passageiros: String(e.quantidade_passageiros),
      status: e.status,
      observacao: e.observacao || '',
      venda_id: e.venda_id || '',
    });
    setOcBusca(e.venda?.ordem_compra || '');
    setVendaBuscada(e.venda || null);
    setFormAberto(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const fecharForm = () => {
    setFormAberto(false);
    setEditing(null);
  };

  const buscarVenda = async () => {
    if (!ocBusca.trim()) return;
    setBuscandoVenda(true);
    setVendaBuscada(null);
    const { data } = await supabase
      .from('vendas')
      .select('id, ordem_compra, programa_id, parceiro_id, clientes(nome_cliente), programas_fidelidade(nome), quantidade_milhas')
      .ilike('ordem_compra', ocBusca.trim())
      .maybeSingle();
    if (data) {
      const v = data as VendaRef;
      setVendaBuscada(v);
      setForm(f => ({
        ...f,
        venda_id: v.id,
        programa_id: v.programa_id || f.programa_id,
        parceiro_id: v.parceiro_id || f.parceiro_id,
        quantidade_milhas: v.quantidade_milhas ? String(v.quantidade_milhas) : f.quantidade_milhas,
      }));
    } else {
      setDialog({ isOpen: true, type: 'warning', title: 'Não encontrado', message: `Nenhuma venda com o Pedido de Compra "${ocBusca}" foi encontrada.` });
    }
    setBuscandoVenda(false);
  };

  const handleSave = async () => {
    try {
      const payload = {
        tipo_venda: 'direta',
        data: form.data,
        data_embarque: form.data_embarque || null,
        programa_id: form.programa_id || null,
        parceiro_id: form.parceiro_id || null,
        passageiro: form.passageiro || null,
        origem: form.origem || null,
        destino: form.destino || null,
        localizacao: form.localizacao || null,
        quantidade_milhas: parseFloat(form.quantidade_milhas) || 0,
        quantidade_passageiros: parseInt(form.quantidade_passageiros) || 1,
        status: form.status,
        observacao: form.observacao || null,
        venda_id: form.venda_id || null,
        created_by: usuario?.id,
      };
      if (editing) {
        const { error } = await supabase.from('controle_emissoes').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('controle_emissoes').insert(payload);
        if (error) throw error;
      }
      fecharForm();
      setDialog({ isOpen: true, type: 'success', title: 'Salvo', message: 'Emissão salva com sucesso!' });
      load();
    } catch (e: any) {
      setDialog({ isOpen: true, type: 'error', title: 'Erro', message: e.message });
    }
  };

  const handleDelete = (id: string) => {
    setDialog({
      isOpen: true, type: 'confirm',
      title: 'Excluir Emissão',
      message: 'Confirma a exclusão desta emissão?',
      onConfirm: async () => {
        await supabase.from('controle_emissoes').delete().eq('id', id);
        setDialog({ isOpen: true, type: 'success', title: 'Excluído', message: 'Emissão excluída.' });
        load();
      },
    });
  };

  const f = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

  const lista = emissoes.filter(e => {
    if (filtroStatus && e.status !== filtroStatus) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return (e.passageiro || '').toLowerCase().includes(q)
        || (e.origem || '').toLowerCase().includes(q)
        || (e.destino || '').toLowerCase().includes(q)
        || (e.localizacao || '').toLowerCase().includes(q)
        || (e.parceiro?.nome_parceiro || '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalMilhas = lista.reduce((s, e) => s + e.quantidade_milhas, 0);
  const totalPax = lista.reduce((s, e) => s + e.quantidade_passageiros, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Venda Direta</h1>
          <p className="text-sm text-slate-500 mt-1">Controle de emissões — entrada manual</p>
        </div>
        {!formAberto && (
          <button onClick={() => abrirForm()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Nova Emissão
          </button>
        )}
      </div>

      {/* Banner em desenvolvimento */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Construction className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-700 font-medium">Esta tela está em desenvolvimento. Funcionalidades podem estar incompletas.</p>
      </div>

      {/* Busca por Pedido de Compra OU formulário inline */}
      {!formAberto ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pedido de Compra</p>
          <div className="flex gap-2">
            <input
              value={ocBusca}
              onChange={e => { setOcBusca(e.target.value); if (!e.target.value) setVendaBuscada(null); }}
              onKeyDown={e => e.key === 'Enter' && buscarVenda()}
              placeholder="Digite o OC da venda e pressione Enter ou clique Buscar..."
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={buscarVenda} disabled={buscandoVenda || !ocBusca.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              {buscandoVenda ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>
          {vendaBuscada && (
            <div className="mt-3 flex items-center justify-between gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-800">{vendaBuscada.ordem_compra}</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {vendaBuscada.clientes?.nome_cliente || '—'} · {vendaBuscada.programas_fidelidade?.nome || '—'} · {vendaBuscada.quantidade_milhas.toLocaleString('pt-BR')} milhas
                </p>
              </div>
              <button onClick={() => abrirForm(vendaBuscada)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shrink-0">
                <Plus className="w-4 h-4" /> Emitir
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Formulário inline */
        <div ref={formRef} className="bg-white rounded-xl border border-blue-200 shadow-sm">
          {/* Cabeçalho do formulário */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100">
            <h2 className="text-sm font-semibold text-slate-700">
              {editing ? 'Editar Emissão' : 'Nova Emissão'}
            </h2>
            <button onClick={fecharForm} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Campo Pedido de Compra */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Pedido de Compra</label>
              <div className="flex gap-2">
                <input
                  value={ocBusca}
                  onChange={e => { setOcBusca(e.target.value); if (!e.target.value) { setVendaBuscada(null); setForm(f => ({ ...f, venda_id: '' })); } }}
                  onKeyDown={e => e.key === 'Enter' && buscarVenda()}
                  placeholder="Digite o OC e pressione buscar..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={buscarVenda} disabled={buscandoVenda || !ocBusca.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {buscandoVenda ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Buscar
                </button>
                {vendaBuscada && (
                  <button type="button" onClick={() => { setVendaBuscada(null); setOcBusca(''); setForm(f => ({ ...f, venda_id: '', programa_id: '', parceiro_id: '', quantidade_milhas: '' })); }}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg border border-slate-200 hover:border-red-200 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {vendaBuscada && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-3">
                  <div className="text-xs min-w-0">
                    <p className="font-semibold text-blue-800">{vendaBuscada.ordem_compra}</p>
                    <p className="text-blue-600 mt-0.5">{vendaBuscada.clientes?.nome_cliente || '—'} · {vendaBuscada.programas_fidelidade?.nome || '—'} · {vendaBuscada.quantidade_milhas.toLocaleString('pt-BR')} milhas</p>
                  </div>
                  <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold shrink-0">Vinculado</span>
                </div>
              )}
            </div>

            {/* Campos do formulário */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data *</label>
                <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data do Embarque</label>
                <input type="date" value={form.data_embarque} onChange={e => setForm({...form, data_embarque: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Programa de Fidelidade</label>
                <select value={form.programa_id} onChange={e => setForm({...form, programa_id: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Selecione...</option>
                  {programas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Parceiro</label>
                <select value={form.parceiro_id} onChange={e => setForm({...form, parceiro_id: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Selecione...</option>
                  {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome_parceiro}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Passageiro</label>
                <input value={form.passageiro} onChange={e => setForm({...form, passageiro: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Nome do passageiro" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Localizador</label>
                <input value={form.localizacao} onChange={e => setForm({...form, localizacao: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Código localizador" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Origem</label>
                <input value={form.origem} onChange={e => setForm({...form, origem: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Ex: GRU" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Destino</label>
                <input value={form.destino} onChange={e => setForm({...form, destino: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Ex: MIA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantidade de Milhas *</label>
                <input type="number" value={form.quantidade_milhas} onChange={e => setForm({...form, quantidade_milhas: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Qtd. Passageiros</label>
                <input type="number" value={form.quantidade_passageiros} onChange={e => setForm({...form, quantidade_passageiros: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="1" min="1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="ativo">Ativo</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Observação</label>
                <textarea value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})}
                  rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
              <button onClick={fecharForm}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={handleSave}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de Emissões', value: lista.length, sub: 'registros' },
          { label: 'Total de Milhas', value: totalMilhas.toLocaleString('pt-BR'), sub: 'milhas emitidas' },
          { label: 'Total de Passageiros', value: totalPax, sub: 'pax' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-xl border shadow-sm p-4 ${ACCENT.border}`}>
            <div className={`inline-flex p-2 rounded-lg mb-3 ${ACCENT.bg}`}>
              <Send className={`w-4 h-4 ${ACCENT.icon}`} />
            </div>
            <p className="text-xs text-slate-500 font-medium mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${ACCENT.value}`}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros + Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-3 p-4 border-b border-slate-100">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar passageiro, origem, destino, localizador..."
            className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">Nenhuma emissão encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['#','Ped. Compra','Data','Dt. Embarque','Programa','Parceiro','Passageiro','Origem','Destino','Localizador','Milhas','Pax','Status',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {lista.map((e, i) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {e.venda?.ordem_compra
                        ? <span className="text-blue-600 font-medium">{e.venda.ordem_compra}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{f(e.data)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{f(e.data_embarque || '')}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{e.programa?.nome || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{e.parceiro?.nome_parceiro || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 font-medium">{e.passageiro || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{e.origem || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{e.destino || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{e.localizacao || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-blue-700">{e.quantidade_milhas.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2.5 text-slate-500">{e.quantidade_passageiros}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${e.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {e.status === 'ativo' ? 'Ativo' : 'Cancelado'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button onClick={() => abrirEdicao(e)} className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(e.id)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={10} className="px-3 py-2 text-xs font-semibold text-slate-500">Total ({lista.length} registros)</td>
                  <td className="px-3 py-2 text-xs font-bold text-blue-700">{totalMilhas.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2 text-xs font-bold text-slate-700">{totalPax}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog {...dialog} onClose={() => setDialog(d => ({...d, isOpen: false}))} />
    </div>
  );
}
