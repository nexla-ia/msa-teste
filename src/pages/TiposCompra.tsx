import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

type TipoCompra = {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  nao_registrar_estoque: boolean;
};

export default function TiposCompra() {
  const [tipos, setTipos] = useState<TipoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TipoCompra | null>(null);
  const { usuario } = useAuth();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [naoRegistrarEstoque, setNaoRegistrarEstoque] = useState(false);

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
      const { data, error } = await supabase.from('tipos_compra').select('*').order('nome');
      if (error) throw error;
      setTipos(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setNome('');
    setDescricao('');
    setAtivo(true);
    setNaoRegistrarEstoque(false);
    setModalOpen(true);
  };

  const handleEdit = (item: TipoCompra) => {
    setEditing(item);
    setNome(item.nome);
    setDescricao(item.descricao || '');
    setAtivo(item.ativo);
    setNaoRegistrarEstoque(item.nao_registrar_estoque);
    setModalOpen(true);
  };

  const handleDelete = async (item: TipoCompra) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir o tipo de compra "${item.nome}"? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await supabase.from('tipos_compra').delete().eq('id', item.id);
          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Tipo de Compra: ${item.nome}`,
            dados_antes: item,
            dados_depois: null
          });
          loadData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Tipo de compra excluído com sucesso!'
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
    try {
      if (editing) {
        await supabase.from('tipos_compra').update({ nome, descricao, ativo, nao_registrar_estoque: naoRegistrarEstoque }).eq('id', editing.id);
        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Tipo de Compra: ${nome}`,
          dados_antes: editing,
          dados_depois: { nome, descricao, ativo, nao_registrar_estoque: naoRegistrarEstoque }
        });
      } else {
        await supabase.from('tipos_compra').insert([{ nome, descricao, ativo, nao_registrar_estoque: naoRegistrarEstoque }]);
        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Tipo de Compra: ${nome}`,
          dados_antes: null,
          dados_depois: { nome, descricao, ativo, nao_registrar_estoque: naoRegistrarEstoque }
        });
      }
      loadData();
      setModalOpen(false);
      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: editing ? 'Tipo de compra atualizado com sucesso!' : 'Tipo de compra criado com sucesso!'
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

  return (
    <>
      <CrudTable
        title="Tipos de Compra"
        description="Gerencie os tipos de compra do sistema"
        data={tipos}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        columns={[
          { key: 'nome', label: 'Nome' },
          { key: 'descricao', label: 'Descrição' },
          {
            key: 'nao_registrar_estoque',
            label: 'Não registra estoque',
            render: (item: TipoCompra) => (
              <span className={`px-2 py-1 text-xs rounded-full ${item.nao_registrar_estoque ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                {item.nao_registrar_estoque ? 'Sim' : 'Não'}
              </span>
            )
          },
          {
            key: 'ativo',
            label: 'Status',
            render: (item: TipoCompra) => (
              <span className={`px-2 py-1 text-xs rounded-full ${item.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {item.ativo ? 'Ativo' : 'Inativo'}
              </span>
            )
          }
        ]}
        recurso="tipos_compra"
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Tipo de Compra' : 'Novo Tipo de Compra'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite o nome do tipo de compra"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite a descrição do tipo de compra"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="naoRegistrarEstoque"
              checked={naoRegistrarEstoque}
              onChange={(e) => setNaoRegistrarEstoque(e.target.checked)}
              className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
            />
            <label htmlFor="naoRegistrarEstoque" className="text-sm font-medium text-slate-700">
              Não registrar no estoque (somente fluxo financeiro)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="ativo" className="text-sm font-medium text-slate-700">
              Ativo
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editing ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
        onConfirm={dialogConfig.onConfirm}
      />
    </>
  );
}
