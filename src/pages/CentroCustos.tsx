import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

type CentroCusto = { id: string; nome: string; chave_referencia: string; };

export default function CentroCustos() {
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CentroCusto | null>(null);
  const { usuario } = useAuth();
  const [formData, setFormData] = useState({ nome: '', chave_referencia: '' });

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('centro_custos').select('*').order('nome');
      setCentros(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => { setEditing(null); setFormData({ nome: '', chave_referencia: '' }); setModalOpen(true); };

  const handleEdit = (item: CentroCusto) => { setEditing(item); setFormData({ nome: item.nome, chave_referencia: item.chave_referencia || '' }); setModalOpen(true); };

  const handleDelete = async (item: CentroCusto) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusao',
      message: `Deseja realmente excluir o centro de custo "${item.nome}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await supabase.from('centro_custos').delete().eq('id', item.id);
          await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'DELETE', linha_afetada: `Centro de Custo: ${item.nome}`, dados_antes: item, dados_depois: null });
          loadData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Centro de custo excluido com sucesso!'
          });
        } catch (error: any) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: `Erro ao excluir: ${error.message || 'Erro desconhecido'}`
          });
        }
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      await supabase.from('centro_custos').update(formData).eq('id', editing.id);
      await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'UPDATE', linha_afetada: `Centro de Custo: ${formData.nome}`, dados_antes: editing, dados_depois: formData });
    } else {
      await supabase.from('centro_custos').insert([formData]);
      await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'INSERT', linha_afetada: `Centro de Custo: ${formData.nome}`, dados_antes: null, dados_depois: formData });
    }
    setModalOpen(false);
    loadData();
  };

  return (
    <>
      <CrudTable title="Centro de Custos" data={centros} columns={[{ key: 'chave_referencia', label: 'Chave Referência' }, { key: 'nome', label: 'Nome' }]} onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete} loading={loading} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chave Referência *</label>
            <input type="text" value={formData.chave_referencia} onChange={(e) => setFormData({ ...formData, chave_referencia: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: CENTRO001, REF123" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? 'Salvar' : 'Adicionar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
        onConfirm={dialogConfig.onConfirm}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
      />
    </>
  );
}
