import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCNPJ, formatTelefone, formatCPFCNPJInput } from '../lib/formatters';
import { getErrorMessage } from '../lib/errorMessages';

type Loja = {
  id: string;
  nome: string;
  cnpj?: string;
  telefone?: string;
  observacoes?: string;
};

export default function Lojas() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Loja | null>(null);
  const { usuario } = useAuth();
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    telefone: '',
    observacoes: ''
  });

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
      const { data, error } = await supabase.from('lojas').select('*').order('nome');
      if (error) throw error;
      setLojas(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({ nome: '', cnpj: '', telefone: '', observacoes: '' });
    setModalOpen(true);
  };

  const handleEdit = (item: Loja) => {
    setEditing(item);
    setFormData({
      nome: item.nome,
      cnpj: item.cnpj || '',
      telefone: item.telefone || '',
      observacoes: item.observacoes || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: Loja) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusao',
      message: `Deseja realmente excluir a loja "${item.nome}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await supabase.from('lojas').delete().eq('id', item.id);
          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Loja: ${item.nome}`,
            dados_antes: item,
            dados_depois: null
          });
          loadData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Loja excluida com sucesso!'
          });
        } catch (error: any) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir a loja.\n\n${getErrorMessage(error)}`
          });
        }
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const data = {
      nome: formData.nome,
      cnpj: formData.cnpj || null,
      telefone: formData.telefone || null,
      observacoes: formData.observacoes || null
    };

    try {
      if (editing) {
        const { error } = await supabase.from('lojas').update(data).eq('id', editing.id);

        if (error) {
          if (error.message.includes('lojas_nome_unique')) {
            throw new Error('Já existe uma loja cadastrada com este nome');
          }
          if (error.message.includes('lojas_cnpj_unique')) {
            throw new Error('Já existe uma loja cadastrada com este CNPJ');
          }
          throw error;
        }

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Loja: ${data.nome}`,
          dados_antes: editing,
          dados_depois: data
        });
      } else {
        const { error } = await supabase.from('lojas').insert([data]);

        if (error) {
          if (error.message.includes('lojas_nome_unique')) {
            throw new Error('Já existe uma loja cadastrada com este nome');
          }
          if (error.message.includes('lojas_cnpj_unique')) {
            throw new Error('Já existe uma loja cadastrada com este CNPJ');
          }
          throw error;
        }

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Loja: ${data.nome}`,
          dados_antes: null,
          dados_depois: data
        });
      }
      setModalOpen(false);
      loadData();
      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: editing ? 'Loja atualizada com sucesso!' : 'Loja cadastrada com sucesso!'
      });
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar a loja.\n\n${getErrorMessage(error)}`
      });
    }
  };

  return (
    <>
      <CrudTable
        title="Lojas - Compras Bonificadas"
        data={lojas}
        columns={[
          { key: 'nome', label: 'Nome da Loja' },
          { key: 'cnpj', label: 'CNPJ', render: (item) => formatCNPJ(item.cnpj) },
          { key: 'telefone', label: 'Telefone', render: (item) => item.telefone ? formatTelefone(item.telefone) : '-' },
          { key: 'observacoes', label: 'Observações' }
        ]}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Loja' : 'Nova Loja'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Loja *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ (chave de identificação) *</label>
            <input
              type="text"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: formatCPFCNPJInput(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="00.000.000/0000-00"
              maxLength={18}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
            <input
              type="text"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="(00) 00000-0000"
              maxLength={15}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
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
