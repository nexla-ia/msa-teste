import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from './CrudTable';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import ParceiroSearch from './ParceiroSearch';
import { formatCPF, formatCurrency, formatDate, calcularIdade } from '../lib/formatters';

type ProgramaMembro = {
  id: string;
  id_transacao: string;
  parceiro_id: string | null;
  nome_parceiro: string;
  telefone: string;
  dt_nasc: string | null;
  cpf: string;
  rg: string;
  email: string;
  idade: number;
  programa: string;
  n_fidelidade: string;
  senha: string;
  conta_familia: string;
  data_exclusao_cf: string | null;
  clube: string;
  cartao: string;
  data_ultima_assinatura: string | null;
  dia_cobranca: number | null;
  valor: number;
  tempo_clube_mes: number;
  liminar: string;
  atualizado_em: string | null;
  obs: string;
  parceiro_fornecedor: string;
  status_conta: string;
  status_restricao: string;
  conferente: string;
  ultima_data_conferencia: string | null;
  grupo_liminar: string;
  status_programa?: string;
};

type Parceiro = {
  id: string;
  nome_parceiro: string;
};

type Cartao = {
  id: string;
  cartao: string;
  mes_expiracao?: number | null;
  ano_expiracao?: number | null;
};

type Produto = {
  id: string;
  nome: string;
};

type StatusPrograma = {
  id: string;
  chave_referencia: string;
  status: string;
};

type ProgramaConfig = {
  nome: string;
  tabela: string;
  temStatusPrograma: boolean;
};

export default function ProgramaFidelidadeGenerico({ config }: { config: ProgramaConfig }) {
  const [data, setData] = useState<ProgramaMembro[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [statusProgramaList, setStatusProgramaList] = useState<StatusPrograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramaMembro | null>(null);
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

  const statusContaOptions = [
    'Aguarda Confirmação',
    'Alteração Cadastral',
    'Ativo',
    'YAHOO - BLOQUEADA',
    'Autenticação',
    'Bloqueado',
    'Cancelado',
    'Em Revisão',
    'Erro',
    'Não Tem',
    'Restrito para Emissão'
  ];

  const statusRestricaoOptions = [
    'Com Restrição',
    'Sem Restrição'
  ];

  const [formData, setFormData] = useState({
    id_transacao: '',
    parceiro_id: '',
    nome_parceiro: '',
    telefone: '',
    dt_nasc: '',
    cpf: '',
    rg: '',
    email: '',
    idade: '',
    programa: config.nome,
    n_fidelidade: '',
    senha: '',
    conta_familia: '',
    data_exclusao_cf: '',
    clube: '',
    cartao: '',
    data_ultima_assinatura: '',
    dia_cobranca: '',
    valor: '',
    tempo_clube_mes: '',
    liminar: '',
    obs: '',
    parceiro_fornecedor: '',
    status_conta: '',
    status_restricao: '',
    conferente: '',
    ultima_data_conferencia: '',
    grupo_liminar: '',
    status_programa: ''
  });

  useEffect(() => {
    loadData();
    loadParceiros();
    loadCartoes();
    loadProdutos();
    if (config.temStatusPrograma) {
      loadStatusPrograma();
    }
  }, []);

  const loadData = async () => {
    try {
      const { data: members, error } = await supabase
        .from(config.tabela)
        .select('*')
        .order('nome_parceiro');

      if (error) {
        console.error('Error loading data:', error);
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Carregar Dados',
          message: `Não foi possível carregar os dados.\n\n${error.message}`
        });
      }

      setData(members || []);
    } catch (err) {
      console.error('Exception loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadParceiros = async () => {
    const { data } = await supabase.from('parceiros').select('id, nome_parceiro').order('nome_parceiro');
    setParceiros(data || []);
  };

  const loadCartoes = async () => {
    const { data } = await supabase
      .from('cartoes_credito')
      .select('id, cartao, mes_expiracao, ano_expiracao')
      .order('cartao');

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    const cartoesAtivos = (data || []).filter(cartao => {
      if (!cartao.mes_expiracao || !cartao.ano_expiracao) {
        return true;
      }
      if (cartao.ano_expiracao < anoAtual) {
        return false;
      }
      if (cartao.ano_expiracao === anoAtual && cartao.mes_expiracao < mesAtual) {
        return false;
      }
      return true;
    });

    setCartoes(cartoesAtivos);
  };

  const loadProdutos = async () => {
    const { data } = await supabase.from('produtos').select('id, nome').order('nome');
    setProdutos(data || []);
  };

  const loadStatusPrograma = async () => {
    const { data } = await supabase
      .from('status_programa')
      .select('id, chave_referencia, status')
      .order('status');
    setStatusProgramaList(data || []);
  };

  const handleOpenModal = () => {
    setEditing(null);
    setFormData({
      id_transacao: '',
      parceiro_id: '',
      nome_parceiro: '',
      telefone: '',
      dt_nasc: '',
      cpf: '',
      rg: '',
      email: '',
      idade: '',
      programa: config.nome,
      n_fidelidade: '',
      senha: '',
      conta_familia: '',
      data_exclusao_cf: '',
      clube: '',
      cartao: '',
      data_ultima_assinatura: '',
      dia_cobranca: '',
      valor: '',
      tempo_clube_mes: '',
      liminar: '',
      obs: '',
      parceiro_fornecedor: '',
      status_conta: '',
      status_restricao: '',
      conferente: '',
      ultima_data_conferencia: '',
      grupo_liminar: '',
      status_programa: ''
    });
    setModalOpen(true);
  };

  const handleEdit = (item: ProgramaMembro) => {
    setEditing(item);
    setFormData({
      id_transacao: item.id_transacao || '',
      parceiro_id: item.parceiro_id || '',
      nome_parceiro: item.nome_parceiro || '',
      telefone: item.telefone || '',
      dt_nasc: item.dt_nasc || '',
      cpf: item.cpf || '',
      rg: item.rg || '',
      email: item.email || '',
      idade: item.idade?.toString() || '',
      programa: item.programa || config.nome,
      n_fidelidade: item.n_fidelidade || '',
      senha: item.senha || '',
      conta_familia: item.conta_familia || '',
      data_exclusao_cf: item.data_exclusao_cf || '',
      clube: item.clube || '',
      cartao: item.cartao || '',
      data_ultima_assinatura: item.data_ultima_assinatura || '',
      dia_cobranca: item.dia_cobranca?.toString() || '',
      valor: item.valor?.toString() || '',
      tempo_clube_mes: item.tempo_clube_mes?.toString() || '',
      liminar: item.liminar || '',
      obs: item.obs || '',
      parceiro_fornecedor: item.parceiro_fornecedor || '',
      status_conta: item.status_conta || '',
      status_restricao: item.status_restricao || '',
      conferente: item.conferente || '',
      ultima_data_conferencia: item.ultima_data_conferencia || '',
      grupo_liminar: item.grupo_liminar || '',
      status_programa: item.status_programa || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: ProgramaMembro) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir o membro "${item.nome_parceiro}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from(config.tabela).delete().eq('id', item.id);
          if (error) throw error;

          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `${config.nome}: ${item.nome_parceiro}`,
            dados_antes: item,
            dados_depois: null
          });
          loadData();
        } catch (error: any) {
          console.error('Error deleting:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir o membro.\n\n${error.message}`
          });
        }
      }
    });
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleParceiroChange = (parceiroId: string) => {
    const parceiro = parceiros.find(p => p.id === parceiroId);
    setFormData({
      ...formData,
      parceiro_id: parceiroId,
      nome_parceiro: parceiro?.nome_parceiro || '',
      id_transacao: parceiroId
    });
  };

  const handleCPFChange = (value: string) => {
    const cpfFormatado = formatCPF(value);
    setFormData({ ...formData, cpf: cpfFormatado });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const dataToSave = {
        ...formData,
        cpf: formData.cpf.replace(/\D/g, ''),
        idade: formData.idade ? parseInt(formData.idade) : 0,
        dia_cobranca: formData.dia_cobranca ? parseInt(formData.dia_cobranca) : null,
        valor: formData.valor ? parseFloat(formData.valor) : 0,
        tempo_clube_mes: formData.tempo_clube_mes ? parseInt(formData.tempo_clube_mes) : 0,
        dt_nasc: formData.dt_nasc || null,
        data_exclusao_cf: formData.data_exclusao_cf || null,
        data_ultima_assinatura: formData.data_ultima_assinatura || null,
        ultima_data_conferencia: formData.ultima_data_conferencia || null,
        atualizado_em: new Date().toISOString()
      };

      if (editing) {
        const { error } = await supabase.from(config.tabela).update(dataToSave).eq('id', editing.id);
        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `${config.nome}: ${dataToSave.nome_parceiro}`,
          dados_antes: editing,
          dados_depois: dataToSave
        });
      } else {
        const { error } = await supabase.from(config.tabela).insert([dataToSave]);
        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `${config.nome}: ${dataToSave.nome_parceiro}`,
          dados_antes: null,
          dados_depois: dataToSave
        });
      }
      setModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar o registro.\n\n${error.message}`
      });
    }
  };

  const columns = [
    { key: 'id_transacao', label: 'ID Transação' },
    { key: 'nome_parceiro', label: 'Nome Parceiro' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'dt_nasc', label: 'Dt Nasc', render: (row: ProgramaMembro) => formatDate(row.dt_nasc) },
    { key: 'cpf', label: 'CPF', render: (row: ProgramaMembro) => formatCPF(row.cpf) },
    { key: 'email', label: 'Email' },
    { key: 'idade', label: 'Idade', render: (row: ProgramaMembro) => calcularIdade(row.dt_nasc) },
    { key: 'n_fidelidade', label: 'Nº Fidelidade' },
    { key: 'conta_familia', label: 'Conta Família' },
    { key: 'clube', label: 'Clube' },
    { key: 'cartao', label: 'Cartão' },
    {
      key: 'valor',
      label: 'Valor',
      sortable: false,
      sumable: true,
      render: (row: ProgramaMembro) => formatCurrency(row.valor)
    },
    { key: 'tempo_clube_mes', label: 'Tempo Clube (Meses)' },
    { key: 'status_conta', label: 'Status Conta', sortable: true },
    { key: 'status_restricao', label: 'Status Restrição', sortable: true }
  ];

  if (config.temStatusPrograma) {
    columns.push({ key: 'status_programa', label: 'Status Programa', sortable: false });
  }

  return (
    <div className="p-6">
      <CrudTable
        title={`${config.nome} - Membros do Programa`}
        data={data}
        columns={columns}
        onAdd={handleOpenModal}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        showTotals={true}
      />

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editing ? 'Editar Membro' : 'Novo Membro'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Parceiro *</label>
            <ParceiroSearch
              parceiros={parceiros}
              value={formData.parceiro_id}
              onChange={(parceiroId) => handleParceiroChange(parceiroId)}
              placeholder="Digite para buscar parceiro..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CPF</label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => handleCPFChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                maxLength={14}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">RG</label>
              <input
                type="text"
                value={formData.rg}
                onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Nascimento</label>
              <input
                type="date"
                value={formData.dt_nasc}
                onChange={(e) => setFormData({ ...formData, dt_nasc: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nº Fidelidade</label>
              <input
                type="text"
                value={formData.n_fidelidade}
                onChange={(e) => setFormData({ ...formData, n_fidelidade: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Senha</label>
              <input
                type="text"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Conta Família</label>
              <input
                type="text"
                value={formData.conta_familia}
                onChange={(e) => setFormData({ ...formData, conta_familia: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data Exclusão CF</label>
              <input
                type="date"
                value={formData.data_exclusao_cf}
                onChange={(e) => setFormData({ ...formData, data_exclusao_cf: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Clube</label>
              <select
                value={formData.clube}
                onChange={(e) => setFormData({ ...formData, clube: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um clube</option>
                {produtos.map(p => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cartão</label>
              <select
                value={formData.cartao}
                onChange={(e) => setFormData({ ...formData, cartao: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um cartão</option>
                {cartoes.map(c => (
                  <option key={c.id} value={c.cartao}>{c.cartao}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Última Assinatura</label>
              <input
                type="date"
                value={formData.data_ultima_assinatura}
                onChange={(e) => setFormData({ ...formData, data_ultima_assinatura: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dia da Cobrança</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.dia_cobranca}
                onChange={(e) => setFormData({ ...formData, dia_cobranca: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor</label>
              <input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tempo de Clube (Meses)</label>
              <input
                type="number"
                value={formData.tempo_clube_mes}
                onChange={(e) => setFormData({ ...formData, tempo_clube_mes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Liminar</label>
              <input
                type="text"
                value={formData.liminar}
                onChange={(e) => setFormData({ ...formData, liminar: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grupo Liminar</label>
              <input
                type="text"
                value={formData.grupo_liminar}
                onChange={(e) => setFormData({ ...formData, grupo_liminar: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status da Conta</label>
              <select
                value={formData.status_conta}
                onChange={(e) => setFormData({ ...formData, status_conta: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um status</option>
                {statusContaOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status de Restrição</label>
              <select
                value={formData.status_restricao}
                onChange={(e) => setFormData({ ...formData, status_restricao: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um status</option>
                {statusRestricaoOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Parceiro/Fornecedor</label>
              <input
                type="text"
                value={formData.parceiro_fornecedor}
                onChange={(e) => setFormData({ ...formData, parceiro_fornecedor: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {config.temStatusPrograma && (
            <div>
              <label className="block text-sm font-medium mb-1">Status no Programa</label>
              <select
                value={formData.status_programa}
                onChange={(e) => setFormData({ ...formData, status_programa: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {statusProgramaList.map((status) => (
                  <option key={status.id} value={status.status}>
                    {status.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Conferente</label>
              <input
                type="text"
                value={formData.conferente}
                onChange={(e) => setFormData({ ...formData, conferente: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Última Data de Conferência</label>
              <input
                type="date"
                value={formData.ultima_data_conferencia}
                onChange={(e) => setFormData({ ...formData, ultima_data_conferencia: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea
              value={formData.obs}
              onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
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
    </div>
  );
}
