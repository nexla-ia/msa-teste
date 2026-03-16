import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../lib/formatters';
import { getErrorMessage } from '../lib/errorMessages';

type Produto = { id: string; nome: string; valor_unitario: number; };

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const { usuario } = useAuth();
  const [formData, setFormData] = useState({ nome: '', valor_unitario: '' });

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
      const { data } = await supabase.from('produtos').select('*').order('nome');
      setProdutos(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => { setEditing(null); setFormData({ nome: '', valor_unitario: '' }); setModalOpen(true); };

  const handleEdit = (item: Produto) => {
    setEditing(item);
    setFormData({
      nome: item.nome,
      valor_unitario: formatCurrencyInput((item.valor_unitario * 100).toString())
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: Produto) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusao',
      message: `Deseja realmente excluir o produto "${item.nome}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await supabase.from('produtos').delete().eq('id', item.id);
          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Produto: ${item.nome}`,
            dados_antes: item,
            dados_depois: null
          });
          loadData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Produto excluido com sucesso!'
          });
        } catch (error: any) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir o produto.\n\n${getErrorMessage(error)}`
          });
        }
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const data = { nome: formData.nome, valor_unitario: parseCurrencyInput(formData.valor_unitario) };
    if (editing) {
      await supabase.from('produtos').update(data).eq('id', editing.id);
      await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'UPDATE', linha_afetada: `Produto: ${data.nome}`, dados_antes: editing, dados_depois: data });
    } else {
      await supabase.from('produtos').insert([data]);
      await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'INSERT', linha_afetada: `Produto: ${data.nome}`, dados_antes: null, dados_depois: data });
    }
    setModalOpen(false);
    loadData();
  };

  return (
    <>
      <CrudTable title="Produtos" data={produtos} columns={[{ key: 'nome', label: 'Nome do Produto' }, { key: 'valor_unitario', label: 'Valor Unitário', render: (item: Produto) => formatCurrency(item.valor_unitario) }]} onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete} loading={loading} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Produto' : 'Novo Produto'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto *</label>
            <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unitário *</label>
            <input
              type="text"
              value={formData.valor_unitario}
              onChange={(e) => setFormData({ ...formData, valor_unitario: formatCurrencyInput(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="R$ 0,00"
              required
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
