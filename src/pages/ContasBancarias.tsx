import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatDate } from '../lib/formatters';
import { getErrorMessage } from '../lib/errorMessages';

type ContaBancaria = {
  id: string;
  nome_banco: string;
  codigo_banco: string;
  agencia: string;
  numero_conta: string;
  chave_pix: string;
  saldo_inicial: number;
  data_saldo_inicial: string | null;
};

export default function ContasBancarias() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
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
    nome_banco: '',
    codigo_banco: '',
    agencia: '',
    numero_conta: '',
    chave_pix: '',
    saldo_inicial: '',
    data_saldo_inicial: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('contas_bancarias').select('*').order('nome_banco');
      setContas(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({ nome_banco: '', codigo_banco: '', agencia: '', numero_conta: '', chave_pix: '', saldo_inicial: '', data_saldo_inicial: '' });
    setModalOpen(true);
  };

  const handleEdit = (item: ContaBancaria) => {
    setEditing(item);
    setFormData({
      nome_banco: item.nome_banco || '',
      codigo_banco: item.codigo_banco || '',
      agencia: item.agencia || '',
      numero_conta: item.numero_conta || '',
      chave_pix: item.chave_pix || '',
      saldo_inicial: item.saldo_inicial?.toString() || '',
      data_saldo_inicial: item.data_saldo_inicial || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: ContaBancaria) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusao',
      message: `Deseja realmente excluir a conta bancaria "${item.nome_banco}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await supabase.from('contas_bancarias').delete().eq('id', item.id);
          await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'DELETE', linha_afetada: `Conta: ${item.nome_banco}`, dados_antes: item, dados_depois: null });
          loadData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Conta bancaria excluida com sucesso!'
          });
        } catch (error: any) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir a conta bancária.\n\n${getErrorMessage(error)}`
          });
        }
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const data = {
      nome_banco: formData.nome_banco,
      codigo_banco: formData.codigo_banco,
      agencia: formData.agencia,
      numero_conta: formData.numero_conta,
      chave_pix: formData.chave_pix,
      saldo_inicial: formData.saldo_inicial ? parseFloat(formData.saldo_inicial) : 0,
      data_saldo_inicial: formData.data_saldo_inicial || null
    };

    try {
      if (editing) {
        const { error } = await supabase.from('contas_bancarias').update(data).eq('id', editing.id);
        if (error) throw error;
        await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'UPDATE', linha_afetada: `Conta: ${data.nome_banco}`, dados_antes: editing, dados_depois: data });
      } else {
        const { error } = await supabase.from('contas_bancarias').insert([data]);
        if (error) throw error;
        await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'INSERT', linha_afetada: `Conta: ${data.nome_banco}`, dados_antes: null, dados_depois: data });
      }
      setModalOpen(false);
      loadData();
      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: `Conta bancária ${editing ? 'atualizada' : 'cadastrada'} com sucesso!`
      });
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar a conta bancária.\n\n${getErrorMessage(error)}`
      });
    }
  };

  return (
    <>
      <CrudTable
        title="Banco Emissor"
        data={contas}
        columns={[
          { key: 'nome_banco', label: 'Nome do Banco' },
          { key: 'codigo_banco', label: 'Código Banco' },
          { key: 'agencia', label: 'Agência' },
          { key: 'numero_conta', label: 'No Conta' },
          { key: 'chave_pix', label: 'Chave Pix' },
          { key: 'saldo_inicial', label: 'Saldo Inicial', sumable: true, render: (item) => formatCurrency(item.saldo_inicial) },
          { key: 'data_saldo_inicial', label: 'Data Saldo Inicial', render: (item) => formatDate(item.data_saldo_inicial) }
        ]}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        showTotals={true}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Banco Emissor' : 'Novo Banco Emissor'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Banco *</label>
              <input type="text" value={formData.nome_banco} onChange={(e) => setFormData({ ...formData, nome_banco: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código Banco</label>
              <input type="text" value={formData.codigo_banco} onChange={(e) => setFormData({ ...formData, codigo_banco: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Agência</label>
              <input type="text" value={formData.agencia} onChange={(e) => setFormData({ ...formData, agencia: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">No Conta</label>
              <input type="text" value={formData.numero_conta} onChange={(e) => setFormData({ ...formData, numero_conta: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chave Pix</label>
            <input type="text" value={formData.chave_pix} onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial</label>
              <input
                type="text"
                value={formData.saldo_inicial ? Number(formData.saldo_inicial).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\./g, '').replace(',', '.');
                  if (rawValue === '' || !isNaN(Number(rawValue))) {
                    setFormData({ ...formData, saldo_inicial: rawValue });
                  }
                }}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data do Saldo Inicial</label>
              <input type="date" value={formData.data_saldo_inicial} onChange={(e) => setFormData({ ...formData, data_saldo_inicial: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
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
