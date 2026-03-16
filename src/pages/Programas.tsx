import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

type Programa = {
  id: string;
  nome_programa: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export default function Programas() {
  const { usuario } = useAuth();
  const [data, setData] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Programa | null>(null);

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
    nome_programa: '',
    descricao: '',
    ativo: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: programas, error } = await supabase
        .from('programas')
        .select('*')
        .order('nome_programa');

      if (error) throw error;
      setData(programas || []);
    } catch (error) {
      console.error('Erro ao carregar programas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Programa) => {
    setEditing(item);
    setFormData({
      nome_programa: item.nome_programa,
      descricao: item.descricao || '',
      ativo: item.ativo
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: Programa) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusao',
      message: `Deseja realmente excluir o programa "${item.nome_programa}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('programas')
            .delete()
            .eq('id', item.id);

          if (error) throw error;

          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Programa: ${item.nome_programa}`,
            dados_antes: item,
            dados_depois: null
          });

          loadData();

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Programa excluido com sucesso!'
          });
        } catch (error: any) {
          console.error('Erro ao excluir:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: `Erro ao excluir programa: ${error.message || 'Erro desconhecido'}`
          });
        }
      }
    });
  };

  const handleOpenModal = () => {
    setEditing(null);
    setFormData({
      nome_programa: '',
      descricao: '',
      ativo: true
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      nome_programa: formData.nome_programa,
      descricao: formData.descricao || null,
      ativo: formData.ativo
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from('programas')
          .update(data)
          .eq('id', editing.id);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Programa: ${data.nome_programa}`,
          dados_antes: editing,
          dados_depois: data
        });
      } else {
        const { error } = await supabase.from('programas').insert([data]);
        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Programa: ${data.nome_programa}`,
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
        message: editing ? 'Programa atualizado com sucesso!' : 'Programa cadastrado com sucesso!'
      });
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: `Erro ao salvar programa: ${error.message || 'Erro desconhecido'}`
      });
    }
  };

  const columns = [
    { key: 'nome_programa', label: 'Programa', sortable: true },
    { key: 'descricao', label: 'Descrição', sortable: false },
    {
      key: 'ativo',
      label: 'Status',
      sortable: true,
      render: (value: boolean) => (
        <span className={`px-2 py-1 rounded text-xs ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {value ? 'Ativo' : 'Inativo'}
        </span>
      )
    }
  ];

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Programas de Fidelidade</h1>
          <button
            onClick={handleOpenModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={20} />
            Novo Programa
          </button>
        </div>

        <CrudTable
          data={data}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={loading}
        />

        <Modal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          title={editing ? 'Editar Programa' : 'Novo Programa'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nome do Programa *
              </label>
              <input
                type="text"
                value={formData.nome_programa}
                onChange={(e) => setFormData({ ...formData, nome_programa: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Descrição
              </label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="ativo" className="text-sm font-medium">
                Programa Ativo
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editing ? 'Atualizar' : 'Salvar'}
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
      </div>
    </Layout>
  );
}
