import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCNPJ } from '../lib/formatters';

type Programa = {
  id: string;
  programa: string;
  nome: string;
  cnpj: string;
  site: string;
  telefone: string;
  whatsapp: string;
  email: string;
  link_chat: string;
  obs: string;
};

export default function ProgramasFidelidade() {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Programa | null>(null);
  const { usuario } = useAuth();

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

  const [formData, setFormData] = useState({
    programa: '',
    nome: '',
    cnpj: '',
    site: '',
    telefone: '',
    whatsapp: '',
    email: '',
    link_chat: '',
    obs: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('programas_fidelidade')
        .select('*')
        .order('nome');
      if (error) throw error;
      setProgramas(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({ programa: '', nome: '', cnpj: '', site: '', telefone: '', whatsapp: '', email: '', link_chat: '', obs: '' });
    setModalOpen(true);
  };

  const handleEdit = (item: Programa) => {
    setEditing(item);
    setFormData({
      ...item,
      cnpj: formatCNPJ(item.cnpj)
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: Programa) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusao',
      message: `Deseja realmente excluir o programa de fidelidade "${item.nome}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await supabase.from('programas_fidelidade').delete().eq('id', item.id);
          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Programa: ${item.nome}`,
            dados_antes: item,
            dados_depois: null
          });
          loadData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Programa de fidelidade excluido com sucesso!'
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
    const dataToSave = {
      ...formData,
      cnpj: formData.cnpj.replace(/\D/g, '')
    };
    try {
      if (editing) {
        await supabase.from('programas_fidelidade').update(dataToSave).eq('id', editing.id);
        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Programa: ${dataToSave.nome}`,
          dados_antes: editing,
          dados_depois: dataToSave
        });
      } else {
        await supabase.from('programas_fidelidade').insert([dataToSave]);
        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Programa: ${dataToSave.nome}`,
          dados_antes: null,
          dados_depois: dataToSave
        });
      }
      setModalOpen(false);
      loadData();
      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: editing ? 'Programa de fidelidade atualizado com sucesso!' : 'Programa de fidelidade cadastrado com sucesso!'
      });
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: `Erro ao salvar: ${error.message || 'Erro desconhecido'}`
      });
    }
  };

  const columns = [
    { key: 'programa', label: 'Programa' },
    { key: 'nome', label: 'Nome' },
    { key: 'cnpj', label: 'CNPJ', render: (item: Programa) => formatCNPJ(item.cnpj) },
    { key: 'site', label: 'Site' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'whatsapp', label: 'Whatsapp' },
    { key: 'email', label: 'Email' },
    { key: 'link_chat', label: 'Link Chat' },
    { key: 'obs', label: 'Observações' }
  ];

  return (
    <>
      <CrudTable
        title="Programas de Fidelidade"
        data={programas}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Programa' : 'Novo Programa'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Programa *</label>
              <input type="text" value={formData.programa} onChange={(e) => setFormData({ ...formData, programa: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
            <input
              type="text"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="00.000.000/0001-00"
              maxLength={18}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
              <input type="text" value={formData.site} onChange={(e) => setFormData({ ...formData, site: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input type="text" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Whatsapp</label>
              <input type="text" value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Link Chat</label>
            <input type="text" value={formData.link_chat} onChange={(e) => setFormData({ ...formData, link_chat: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea value={formData.obs} onChange={(e) => setFormData({ ...formData, obs: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows={3} />
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
