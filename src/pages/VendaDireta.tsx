import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
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
  programa?: { nome: string } | null;
  parceiro?: { nome_parceiro: string } | null;
}

interface Parceiro { id: string; nome_parceiro: string; }
interface Programa { id: string; nome: string; }

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
};

export default function VendaDireta() {
  const { usuario } = useAuth();
  const [emissoes, setEmissoes] = useState<Emissao[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Emissao | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [dialog, setDialog] = useState<{
    isOpen: boolean; type: 'success'|'error'|'confirm'|'warning';
    title: string; message: string; onConfirm?: () => void;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: em }, { data: pa }, { data: pr }] = await Promise.all([
      supabase.from('controle_emissoes')
        .select('*, programa:programas_fidelidade(nome), parceiro:parceiros(nome_parceiro)')
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

  const openNew = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (e: Emissao) => {
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
    });
    setModalOpen(true);
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
        created_by: usuario?.id,
      };
      if (editing) {
        const { error } = await supabase.from('controle_emissoes').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('controle_emissoes').insert(payload);
        if (error) throw error;
      }
      setModalOpen(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Venda Direta</h1>
          <p className="text-sm text-slate-500 mt-1">Controle de emissões — entrada manual</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> Nova Emissão
        </button>
      </div>

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

      {/* Filtros */}
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
                  {['#','Data','Dt. Embarque','Programa','Parceiro','Passageiro','Origem','Destino','Localizador','Milhas','Pax','Status',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {lista.map((e, i) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
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
                        <button onClick={() => openEdit(e)} className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(e.id)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={9} className="px-3 py-2 text-xs font-semibold text-slate-500">Total ({lista.length} registros)</td>
                  <td className="px-3 py-2 text-xs font-bold text-blue-700">{totalMilhas.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2 text-xs font-bold text-slate-700">{totalPax}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Emissão' : 'Nova Emissão'} size="lg">
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
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
          <button onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Salvar</button>
        </div>
      </Modal>

      <ConfirmDialog {...dialog} onClose={() => setDialog(d => ({...d, isOpen: false}))} />
    </div>
  );
}
