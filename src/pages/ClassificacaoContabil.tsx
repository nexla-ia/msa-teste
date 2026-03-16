import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

type Classificacao = {
  id: string;
  chave_referencia: string;
  categoria: string;
  classificacao: string;
  descricao: string;
};

export default function ClassificacaoContabil() {
  const [classificacoes, setClassificacoes] = useState<Classificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classificacao | null>(null);
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
    categoria: '',
    classificacao: '',
    descricao: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('classificacao_contabil')
        .select('*')
        .order('categoria')
        .order('classificacao');

      if (error) throw error;
      setClassificacoes(data || []);
    } catch (error) {
      console.error('Error loading classificacoes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({
      chave_referencia: '',
      categoria: '',
      classificacao: '',
      descricao: ''
    });
    setModalOpen(true);
  };

  const handleEdit = (item: Classificacao) => {
    setEditing(item);
    setFormData({
      chave_referencia: item.chave_referencia || '',
      categoria: item.categoria || '',
      classificacao: item.classificacao || '',
      descricao: item.descricao || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: Classificacao) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir "${item.classificacao}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('classificacao_contabil')
            .delete()
            .eq('id', item.id);

          if (error) throw error;

          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Classificação Contábil: ${item.classificacao}`,
            dados_antes: item,
            dados_depois: null
          });

          loadData();
        } catch (error: any) {
          console.error('Error deleting classificacao:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir a classificação.\n\n${error.message || 'Erro desconhecido'}`
          });
        }
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      if (editing) {
        const { error } = await supabase
          .from('classificacao_contabil')
          .update(formData)
          .eq('id', editing.id);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Classificação Contábil: ${formData.classificacao}`,
          dados_antes: editing,
          dados_depois: formData
        });
      } else {
        const { error } = await supabase
          .from('classificacao_contabil')
          .insert([formData]);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Classificação Contábil: ${formData.classificacao}`,
          dados_antes: null,
          dados_depois: formData
        });
      }

      setModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving classificacao:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar a classificação.\n\n${error.message || 'Erro desconhecido'}`
      });
    }
  };

  const columns = [
    { key: 'chave_referencia', label: 'Chave Referência' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'classificacao', label: 'Classificação' },
    { key: 'descricao', label: 'Descrição' }
  ];

  return (
    <>
      <CrudTable
        title="Classificação Contábil"
        data={classificacoes}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Classificação' : 'Nova Classificação'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Chave Referência *
            </label>
            <input
              type="text"
              value={formData.chave_referencia}
              onChange={(e) => setFormData({ ...formData, chave_referencia: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: CAP-001, RH-001"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Categoria *
            </label>
            <input
              type="text"
              value={formData.categoria}
              onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Capital, Recursos Humanos"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Classificação *
            </label>
            <input
              type="text"
              value={formData.classificacao}
              onChange={(e) => setFormData({ ...formData, classificacao: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Sócios, Salários"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descrição
            </label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Descrição detalhada da classificação"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
