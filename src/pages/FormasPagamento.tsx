import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { CreditCard } from 'lucide-react';

type FormaPagamento = {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  registrar_fluxo_caixa: boolean;
  ordem?: number;
};

export default function FormasPagamento() {
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FormaPagamento | null>(null);
  const { usuario } = useAuth();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [registrarFluxoCaixa, setRegistrarFluxoCaixa] = useState(true);
  const [ordem, setOrdem] = useState<number | undefined>(undefined);

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
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      setFormas(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setNome('');
    setDescricao('');
    setAtivo(true);
    setRegistrarFluxoCaixa(true);
    setOrdem(undefined);
    setModalOpen(true);
  };

  const handleEdit = (item: FormaPagamento) => {
    setEditing(item);
    setNome(item.nome);
    setDescricao(item.descricao || '');
    setAtivo(item.ativo);
    setRegistrarFluxoCaixa(item.registrar_fluxo_caixa);
    setOrdem(item.ordem);
    setModalOpen(true);
  };

  const handleDelete = async (item: FormaPagamento) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir a forma de pagamento "${item.nome}"? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await supabase.from('formas_pagamento').delete().eq('id', item.id);
          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Forma de Pagamento: ${item.nome}`,
            dados_antes: item,
            dados_depois: null
          });
          loadData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Forma de pagamento excluída com sucesso!'
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
      const formData: Partial<FormaPagamento> = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        ativo,
        registrar_fluxo_caixa: registrarFluxoCaixa,
        ordem: ordem || null
      };

      if (editing) {
        const { error } = await supabase
          .from('formas_pagamento')
          .update(formData)
          .eq('id', editing.id);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Forma de Pagamento: ${nome}`,
          dados_antes: editing,
          dados_depois: formData
        });

        setDialogConfig({
          isOpen: true,
          type: 'success',
          title: 'Sucesso',
          message: 'Forma de pagamento atualizada com sucesso!'
        });
      } else {
        const { error } = await supabase.from('formas_pagamento').insert(formData);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Forma de Pagamento: ${nome}`,
          dados_antes: null,
          dados_depois: formData
        });

        setDialogConfig({
          isOpen: true,
          type: 'success',
          title: 'Sucesso',
          message: 'Forma de pagamento criada com sucesso!'
        });
      }

      setModalOpen(false);
      loadData();
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: error.message || 'Erro desconhecido'
      });
    }
  };

  return (
    <>
      <CrudTable
        title="Formas de Pagamento"
        data={formas}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        recurso="formas_pagamento"
        columns={[
          { key: 'ordem', label: 'Ordem' },
          { key: 'nome', label: 'Nome' },
          { key: 'descricao', label: 'Descrição' },
          {
            key: 'registrar_fluxo_caixa',
            label: 'Registra Fluxo de Caixa',
            render: (item: FormaPagamento) => (
              <span className={`px-2 py-1 text-xs rounded-full ${item.registrar_fluxo_caixa ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                {item.registrar_fluxo_caixa ? 'Sim' : 'Não'}
              </span>
            )
          },
          {
            key: 'ativo',
            label: 'Status',
            render: (item: FormaPagamento) => (
              <span className={`px-2 py-1 text-xs rounded-full ${item.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {item.ativo ? 'Ativo' : 'Inativo'}
              </span>
            )
          }
        ]}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
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
              placeholder="Ex: PIX, Dinheiro, Crédito"
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
              placeholder="Descrição opcional"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ordem
            </label>
            <input
              type="number"
              value={ordem || ''}
              onChange={(e) => setOrdem(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1, 2, 3..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="registrar_fluxo_caixa"
              checked={registrarFluxoCaixa}
              onChange={(e) => setRegistrarFluxoCaixa(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="registrar_fluxo_caixa" className="text-sm font-medium text-slate-700">
              Registrar no Fluxo de Caixa
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
              {editing ? 'Salvar Alterações' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onConfirm={dialogConfig.onConfirm}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
      />
    </>
  );
}
