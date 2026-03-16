import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

type StatusPrograma = {
  id: string;
  chave_referencia: string;
  status: string;
  limite_cpfs_ano: number;
  created_at: string;
};

export default function StatusPrograma() {
  const [statusList, setStatusList] = useState<StatusPrograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StatusPrograma | null>(null);
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
    chave_referencia: '',
    status: '',
    limite_cpfs_ano: 25
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('status_programa')
        .select('*')
        .order('status');

      setStatusList(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({
      chave_referencia: '',
      status: '',
      limite_cpfs_ano: 25
    });
    setModalOpen(true);
  };

  const handleEdit = (item: StatusPrograma) => {
    setEditing(item);
    setFormData({
      chave_referencia: item.chave_referencia,
      status: item.status,
      limite_cpfs_ano: item.limite_cpfs_ano || 25
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: StatusPrograma) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir o status "${item.status}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        const { error } = await supabase
          .from('status_programa')
          .delete()
          .eq('id', item.id);

        if (error) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir o status.\n\n${error.message}`
          });
          return;
        }

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'DELETE',
          linha_afetada: `Status Programa: ${item.status}`,
          dados_antes: item,
          dados_depois: null
        });

        loadData();
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const data = {
      chave_referencia: formData.chave_referencia.trim(),
      status: formData.status.trim(),
      limite_cpfs_ano: formData.limite_cpfs_ano
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from('status_programa')
          .update(data)
          .eq('id', editing.id);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Status Programa: ${data.status}`,
          dados_antes: editing,
          dados_depois: data
        });
      } else {
        const { error } = await supabase
          .from('status_programa')
          .insert([data]);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Status Programa: ${data.status}`,
          dados_antes: null,
          dados_depois: data
        });
      }

      setModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar o status.\n\n${error.message || 'Erro desconhecido'}`
      });
    }
  };

  return (
    <>
      <CrudTable
        title="Status Programa"
        data={statusList}
        columns={[
          { key: 'chave_referencia', label: 'Chave Referência' },
          { key: 'status', label: 'Nível/Categoria' },
          {
            key: 'limite_cpfs_ano',
            label: 'Limite CPFs/Ano',
            render: (item) => item.limite_cpfs_ano || 0
          },
          {
            key: 'created_at',
            label: 'Criado em',
            render: (item) =>
              new Date(item.created_at).toLocaleDateString('pt-BR')
          }
        ]}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Status Programa' : 'Novo Status Programa'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Chave Referência *
            </label>
            <input
              type="text"
              value={formData.chave_referencia}
              onChange={(e) =>
                setFormData({ ...formData, chave_referencia: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: diamond, platinum, gold"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Identificador único (sem espaços, minúsculas)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nível/Categoria *
            </label>
            <input
              type="text"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Diamond, Platinum, Gold"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Limite de CPFs por Ano *
            </label>
            <input
              type="number"
              min="0"
              value={formData.limite_cpfs_ano}
              onChange={(e) =>
                setFormData({ ...formData, limite_cpfs_ano: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 25"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Quantidade máxima de CPFs que cada parceiro pode emitir neste status por ano (0 = ilimitado)
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editing ? 'Salvar' : 'Adicionar'}
            </button>
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
