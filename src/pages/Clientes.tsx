import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCPFCNPJ, formatCPFCNPJInput, formatNumberInput, parseNumberInput } from '../lib/formatters';
import { getErrorMessage } from '../lib/errorMessages';
import { Landmark } from 'lucide-react';

type Cliente = {
  id: string;
  nome_cliente: string;
  chave_referencia: string;
  cnpj_cpf: string;
  endereco: string;
  email: string;
  telefone: string;
  whatsapp: string;
  contato: string;
  site: string;
  instagram: string;
  inscricao_municipal?: string;
  obs: string;
  banco?: string;
  agencia?: string;
  tipo_conta?: string;
  numero_conta?: string;
  pix?: string;
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [bankInfoModalOpen, setBankInfoModalOpen] = useState(false);
  const [viewingBankInfo, setViewingBankInfo] = useState<Cliente | null>(null);
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
    nome_cliente: '',
    chave_referencia: '',
    cnpj_cpf: '',
    endereco: '',
    email: '',
    telefone: '',
    whatsapp: '',
    contato: '',
    site: '',
    instagram: '',
    inscricao_municipal: '',
    obs: '',
    banco: '',
    agencia: '',
    tipo_conta: '',
    numero_conta: '',
    pix: ''
  });

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome_cliente');

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error loading clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCliente(null);
    setFormData({
      nome_cliente: '',
      chave_referencia: '',
      cnpj_cpf: '',
      endereco: '',
      email: '',
      telefone: '',
      whatsapp: '',
      contato: '',
      site: '',
      instagram: '',
      inscricao_municipal: '',
      obs: '',
      banco: '',
      agencia: '',
      tipo_conta: '',
      numero_conta: '',
      pix: ''
    });
    setModalOpen(true);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome_cliente: cliente.nome_cliente || '',
      chave_referencia: cliente.chave_referencia || '',
      cnpj_cpf: cliente.cnpj_cpf ? formatCPFCNPJInput(cliente.cnpj_cpf) : '',
      endereco: cliente.endereco || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      whatsapp: cliente.whatsapp || '',
      contato: cliente.contato || '',
      site: cliente.site || '',
      instagram: cliente.instagram || '',
      inscricao_municipal: cliente.inscricao_municipal || '',
      obs: cliente.obs || '',
      banco: cliente.banco || '',
      agencia: cliente.agencia || '',
      tipo_conta: cliente.tipo_conta || '',
      numero_conta: cliente.numero_conta || '',
      pix: cliente.pix || ''
    });
    setModalOpen(true);
  };

  const handleViewBankInfo = (cliente: Cliente) => {
    setViewingBankInfo(cliente);
    setBankInfoModalOpen(true);
  };

  const handleDelete = async (cliente: Cliente) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir o cliente "${cliente.nome_cliente}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', cliente.id);

          if (error) throw error;

          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Cliente: ${cliente.nome_cliente}`,
            dados_antes: cliente,
            dados_depois: null
          });

          loadClientes();

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Cliente excluído com sucesso!'
          });
        } catch (error: any) {
          console.error('Error deleting cliente:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir o cliente.\n\n${error.message || 'Erro desconhecido'}`
          });
        }
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const dataToSave = {
      ...formData,
      cnpj_cpf: formData.cnpj_cpf ? formData.cnpj_cpf.replace(/\D/g, '') : ''
    };

    try {
      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', editingCliente.id);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Cliente: ${formData.nome_cliente}`,
          dados_antes: editingCliente,
          dados_depois: dataToSave
        });
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([dataToSave]);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Cliente: ${formData.nome_cliente}`,
          dados_antes: null,
          dados_depois: dataToSave
        });
      }

      setModalOpen(false);
      loadClientes();

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: `Cliente ${editingCliente ? 'atualizado' : 'cadastrado'} com sucesso!`
      });
    } catch (error: any) {
      console.error('Error saving cliente:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar o cliente.\n\n${getErrorMessage(error)}`
      });
    }
  };

  const columns = [
    { key: 'chave_referencia', label: 'Chave Referência' },
    { key: 'nome_cliente', label: 'Nome Cliente' },
    {
      key: 'cnpj_cpf',
      label: 'CNPJ/CPF',
      render: (item: Cliente) => formatCPFCNPJ(item.cnpj_cpf)
    },
    { key: 'endereco', label: 'Endereço' },
    { key: 'email', label: 'Email' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'whatsapp', label: 'Whatsapp' },
    { key: 'contato', label: 'Contato' },
    { key: 'site', label: 'Site' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'obs', label: 'Observações' }
  ];

  return (
    <>
      <CrudTable
        title="Clientes"
        data={clientes}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        extraActions={(cliente) => (
          <button
            onClick={() => handleViewBankInfo(cliente)}
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="Ver informações bancárias"
          >
            <Landmark className="w-4 h-4" />
          </button>
        )}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome Cliente *
              </label>
              <input
                type="text"
                value={formData.nome_cliente}
                onChange={(e) => setFormData({ ...formData, nome_cliente: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Chave Referência *
              </label>
              <input
                type="text"
                value={formData.chave_referencia}
                onChange={(e) => setFormData({ ...formData, chave_referencia: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: CLI001, REF123"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ/CPF</label>
            <input
              type="text"
              value={formData.cnpj_cpf}
              onChange={(e) => setFormData({ ...formData, cnpj_cpf: formatCPFCNPJInput(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: 00.000.000/0000-00 ou 000.000.000-00"
              maxLength={18}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
            <input
              type="text"
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Whatsapp</label>
              <input
                type="text"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contato</label>
              <input
                type="text"
                value={formData.contato}
                onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
              <input
                type="text"
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instagram</label>
              <input
                type="text"
                value={formData.instagram}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Inscrição Municipal</label>
            <input
              type="text"
              value={formData.inscricao_municipal ? formatNumberInput(formData.inscricao_municipal) : ''}
              onChange={(e) => {
                const numValue = e.target.value ? parseNumberInput(e.target.value).toString() : '';
                setFormData({ ...formData, inscricao_municipal: numValue });
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Número da inscrição municipal"
            />
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Dados Bancários</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                <input
                  type="text"
                  value={formData.banco}
                  onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Banco do Brasil, Itaú"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Agência</label>
                <input
                  type="text"
                  value={formData.agencia}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    const formatted = value.length <= 4 ? value : value.slice(0, 4) + '-' + value.slice(4, 5);
                    setFormData({ ...formData, agencia: formatted });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 1234-5"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Conta</label>
                <select
                  value={formData.tipo_conta}
                  onChange={(e) => setFormData({ ...formData, tipo_conta: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione</option>
                  <option value="Corrente">Corrente</option>
                  <option value="Poupança">Poupança</option>
                  <option value="Salário">Salário</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número da Conta</label>
                <input
                  type="text"
                  value={formData.numero_conta}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    const formatted = value.length <= 6 ? value : value.slice(0, -1) + '-' + value.slice(-1);
                    setFormData({ ...formData, numero_conta: formatted });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 123456-7"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">PIX</label>
              <input
                type="text"
                value={formData.pix}
                onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              value={formData.obs}
              onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
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
              {editingCliente ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={bankInfoModalOpen}
        onClose={() => setBankInfoModalOpen(false)}
        title="Informações Bancárias"
      >
        {viewingBankInfo && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-600 rounded-lg">
                  <Landmark className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-800">{viewingBankInfo.nome_cliente}</h3>
                  <p className="text-sm text-slate-600">Dados Bancários</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Banco</label>
                  <p className="text-slate-800 font-medium mt-1">{viewingBankInfo.banco || '—'}</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Agência</label>
                  <p className="text-slate-800 font-medium mt-1">{viewingBankInfo.agencia || '—'}</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo de Conta</label>
                  <p className="text-slate-800 font-medium mt-1">{viewingBankInfo.tipo_conta || '—'}</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Número da Conta</label>
                  <p className="text-slate-800 font-medium mt-1">{viewingBankInfo.numero_conta || '—'}</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm md:col-span-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Chave PIX</label>
                  <p className="text-slate-800 font-medium mt-1 break-all">{viewingBankInfo.pix || '—'}</p>
                </div>
              </div>

              {!viewingBankInfo.banco && !viewingBankInfo.agencia && !viewingBankInfo.tipo_conta && !viewingBankInfo.numero_conta && !viewingBankInfo.pix && (
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">Nenhuma informação bancária cadastrada</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setBankInfoModalOpen(false)}
                className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
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
