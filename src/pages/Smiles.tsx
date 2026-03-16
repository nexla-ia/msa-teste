import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCPF, formatCurrency, formatDate, calcularIdade } from '../lib/formatters';

type Parceiro = {
  id: string;
  id_parceiro: string | null;
  nome_parceiro: string;
  telefone: string | null;
  dt_nasc: string | null;
  cpf: string | null;
  rg: string | null;
  email: string | null;
};

type Produto = {
  id: string;
  nome: string;
};

type Cartao = {
  id: string;
  cartao: string;
};

type SmilesMembro = {
  id: string;
  parceiro_id: string;
  parceiro?: Parceiro;
  numero_fidelidade: string;
  senha: string | null;
  conta_familia: string | null;
  data_exclusao_conta_familia: string | null;
  clube_produto_id: string | null;
  clube_produto?: Produto;
  cartao_id: string | null;
  cartao?: Cartao;
  data_ultima_assinatura: string | null;
  dia_cobranca: number | null;
  valor: number | null;
  tempo_clube_meses: number;
  liminar: string | null;
  mudanca_clube: string | null;
  milhas_expirando: string | null;
  observacoes: string | null;
  parceiro_fornecedor: string | null;
  status_conta: string;
  status_restricao: string;
  conferente: string | null;
  ultima_data_conferencia: string | null;
  grupo_liminar: string | null;
  status_programa: string | null;
};

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

const statusRestricaoOptions = ['Com restrição', 'Sem restrição'];

const statusProgramaOptions = ['Diamond', 'Platinum', 'Gold'];

export default function Smiles() {
  const { usuario } = useAuth();
  const [data, setData] = useState<SmilesMembro[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [programaId, setProgramaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmilesMembro | null>(null);

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
    parceiro_id: '',
    numero_fidelidade: '',
    senha: '',
    conta_familia: '',
    data_exclusao_conta_familia: '',
    clube_produto_id: '',
    cartao_id: '',
    data_ultima_assinatura: '',
    dia_cobranca: '',
    valor: '',
    tempo_clube_meses: '0',
    liminar: '',
    mudanca_clube: '',
    milhas_expirando: '',
    observacoes: '',
    parceiro_fornecedor: '',
    status_conta: 'Aguarda Confirmação',
    status_restricao: 'Sem restrição',
    conferente: '',
    ultima_data_conferencia: '',
    grupo_liminar: '',
    status_programa: ''
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [programaRes, parceirosRes, produtosRes, cartoesRes] = await Promise.all([
        supabase.from('programas').select('id').eq('nome_programa', 'Smiles').maybeSingle(),
        supabase.from('parceiros').select('*').order('nome_parceiro'),
        supabase.from('produtos').select('id, nome').order('nome'),
        supabase.from('cartoes_credito').select('id, cartao').order('cartao')
      ]);

      if (programaRes.data) {
        setProgramaId(programaRes.data.id);
        loadData(programaRes.data.id);
      }

      setParceiros(parceirosRes.data || []);
      setProdutos(produtosRes.data || []);
      setCartoes(cartoesRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (progId: string) => {
    try {
      const { data: membros, error } = await supabase
        .from('programas_membros')
        .select(`
          *,
          parceiro:parceiros(*),
          clube_produto:produtos(id, nome),
          cartao:cartoes_credito(id, cartao)
        `)
        .eq('programa_id', progId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(membros || []);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    }
  };

  const handleEdit = (item: SmilesMembro) => {
    setEditing(item);
    setFormData({
      parceiro_id: item.parceiro_id,
      numero_fidelidade: item.numero_fidelidade,
      senha: item.senha || '',
      conta_familia: item.conta_familia || '',
      data_exclusao_conta_familia: item.data_exclusao_conta_familia || '',
      clube_produto_id: item.clube_produto_id || '',
      cartao_id: item.cartao_id || '',
      data_ultima_assinatura: item.data_ultima_assinatura || '',
      dia_cobranca: item.dia_cobranca?.toString() || '',
      valor: item.valor?.toString() || '',
      tempo_clube_meses: item.tempo_clube_meses?.toString() || '0',
      liminar: item.liminar || '',
      mudanca_clube: item.mudanca_clube || '',
      milhas_expirando: item.milhas_expirando || '',
      observacoes: item.observacoes || '',
      parceiro_fornecedor: item.parceiro_fornecedor || '',
      status_conta: item.status_conta,
      status_restricao: item.status_restricao,
      conferente: item.conferente || '',
      ultima_data_conferencia: item.ultima_data_conferencia || '',
      grupo_liminar: item.grupo_liminar || '',
      status_programa: item.status_programa || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: SmilesMembro) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusao',
      message: `Deseja realmente excluir o membro Smiles "${item.numero_fidelidade}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('programas_membros')
            .delete()
            .eq('id', item.id);

          if (error) throw error;

          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Smiles - ${item.parceiro?.nome_parceiro} - ${item.numero_fidelidade}`,
            dados_antes: item,
            dados_depois: null
          });

          if (programaId) loadData(programaId);

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Membro excluido com sucesso!'
          });
        } catch (error: any) {
          console.error('Erro ao excluir:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: `Erro ao excluir registro: ${error.message || 'Erro desconhecido'}`
          });
        }
      }
    });
  };

  const handleOpenModal = () => {
    setEditing(null);
    setFormData({
      parceiro_id: '',
      numero_fidelidade: '',
      senha: '',
      conta_familia: '',
      data_exclusao_conta_familia: '',
      clube_produto_id: '',
      cartao_id: '',
      data_ultima_assinatura: '',
      dia_cobranca: '',
      valor: '',
      tempo_clube_meses: '0',
      liminar: '',
      mudanca_clube: '',
      milhas_expirando: '',
      observacoes: '',
      parceiro_fornecedor: '',
      status_conta: 'Aguarda Confirmação',
      status_restricao: 'Sem restrição',
      conferente: '',
      ultima_data_conferencia: '',
      grupo_liminar: '',
      status_programa: ''
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!programaId) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Programa Smiles nao encontrado'
      });
      return;
    }

    const data = {
      programa_id: programaId,
      parceiro_id: formData.parceiro_id,
      numero_fidelidade: formData.numero_fidelidade,
      senha: formData.senha || null,
      conta_familia: formData.conta_familia || null,
      data_exclusao_conta_familia: formData.data_exclusao_conta_familia || null,
      clube_produto_id: formData.clube_produto_id || null,
      cartao_id: formData.cartao_id || null,
      data_ultima_assinatura: formData.data_ultima_assinatura || null,
      dia_cobranca: formData.dia_cobranca ? parseInt(formData.dia_cobranca) : null,
      valor: formData.valor ? parseFloat(formData.valor) : null,
      tempo_clube_meses: parseInt(formData.tempo_clube_meses) || 0,
      liminar: formData.liminar || null,
      mudanca_clube: formData.mudanca_clube || null,
      milhas_expirando: formData.milhas_expirando || null,
      observacoes: formData.observacoes || null,
      parceiro_fornecedor: formData.parceiro_fornecedor || null,
      status_conta: formData.status_conta,
      status_restricao: formData.status_restricao,
      conferente: formData.conferente || null,
      ultima_data_conferencia: formData.ultima_data_conferencia || null,
      grupo_liminar: formData.grupo_liminar || null,
      status_programa: formData.status_programa || null
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from('programas_membros')
          .update(data)
          .eq('id', editing.id);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Smiles - ${formData.numero_fidelidade}`,
          dados_antes: editing,
          dados_depois: data
        });
      } else {
        const { error } = await supabase.from('programas_membros').insert([data]);
        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Smiles - ${formData.numero_fidelidade}`,
          dados_antes: null,
          dados_depois: data
        });
      }

      setModalOpen(false);
      setEditing(null);
      await loadData(programaId);

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: editing ? 'Membro atualizado com sucesso!' : 'Membro cadastrado com sucesso!'
      });
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: `Erro ao salvar: ${error.message || 'Erro desconhecido'}`
      });
    }
  };


  const columns = [
    {
      key: 'parceiro.id_parceiro',
      label: 'ID Parceiro',
      sortable: true,
      render: (row: SmilesMembro) => row.parceiro?.id_parceiro || '-'
    },
    {
      key: 'parceiro.nome_parceiro',
      label: 'Nome Parceiro',
      sortable: true,
      render: (row: SmilesMembro) => row.parceiro?.nome_parceiro || '-'
    },
    {
      key: 'parceiro.telefone',
      label: 'Telefone',
      sortable: false,
      render: (row: SmilesMembro) => row.parceiro?.telefone || '-'
    },
    {
      key: 'parceiro.dt_nasc',
      label: 'Dt. Nasc.',
      sortable: false,
      render: (row: SmilesMembro) => formatDate(row.parceiro?.dt_nasc)
    },
    {
      key: 'parceiro.cpf',
      label: 'CPF',
      sortable: false,
      render: (row: SmilesMembro) => formatCPF(row.parceiro?.cpf)
    },
    {
      key: 'idade',
      label: 'Idade',
      sortable: false,
      render: (row: SmilesMembro) => calcularIdade(row.parceiro?.dt_nasc || null)
    },
    { key: 'numero_fidelidade', label: 'Nº Fidelidade', sortable: true },
    {
      key: 'clube_produto.nome',
      label: 'Clube',
      sortable: false,
      render: (row: SmilesMembro) => row.clube_produto?.nome || '-'
    },
    {
      key: 'cartao.cartao',
      label: 'Cartão',
      sortable: false,
      render: (row: SmilesMembro) => row.cartao?.cartao || '-'
    },
    {
      key: 'valor',
      label: 'Valor',
      sortable: false,
      sumable: true,
      render: (row: SmilesMembro) => formatCurrency(row.valor)
    },
    { key: 'status_conta', label: 'Status Conta', sortable: true },
    { key: 'status_restricao', label: 'Status Restrição', sortable: true },
    { key: 'status_programa', label: 'Status Programa', sortable: false }
  ];

  return (
    <div className="p-6">
      <CrudTable
        title="Smiles - Membros do Programa"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Parceiro *</label>
                <select
                  value={formData.parceiro_id}
                  onChange={(e) => setFormData({ ...formData, parceiro_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Selecione...</option>
                  {parceiros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id_parceiro ? `${p.id_parceiro} - ` : ''}{p.nome_parceiro}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nº Fidelidade *</label>
                <input
                  type="text"
                  value={formData.numero_fidelidade}
                  onChange={(e) => setFormData({ ...formData, numero_fidelidade: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Senha</label>
                <input
                  type="text"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Conta Família</label>
                <input
                  type="text"
                  value={formData.conta_familia}
                  onChange={(e) => setFormData({ ...formData, conta_familia: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Data Exclusão Conta Família</label>
                <input
                  type="date"
                  value={formData.data_exclusao_conta_familia}
                  onChange={(e) => setFormData({ ...formData, data_exclusao_conta_familia: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Clube (Produto)</label>
                <select
                  value={formData.clube_produto_id}
                  onChange={(e) => setFormData({ ...formData, clube_produto_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Selecione...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Cartão</label>
                <select
                  value={formData.cartao_id}
                  onChange={(e) => setFormData({ ...formData, cartao_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Selecione...</option>
                  {cartoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cartao}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Data Última Assinatura</label>
                <input
                  type="date"
                  value={formData.data_ultima_assinatura}
                  onChange={(e) => setFormData({ ...formData, data_ultima_assinatura: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
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
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tempo de Clube (Meses)</label>
                <input
                  type="number"
                  value={formData.tempo_clube_meses}
                  onChange={(e) => setFormData({ ...formData, tempo_clube_meses: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Liminar</label>
                <input
                  type="text"
                  value={formData.liminar}
                  onChange={(e) => setFormData({ ...formData, liminar: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">DownGrade/UpGrade Clube</label>
                <input
                  type="text"
                  value={formData.mudanca_clube}
                  onChange={(e) => setFormData({ ...formData, mudanca_clube: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Milhas Expirando</label>
                <input
                  type="text"
                  value={formData.milhas_expirando}
                  onChange={(e) => setFormData({ ...formData, milhas_expirando: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Parceiro/Fornecedor</label>
                <select
                  value={formData.parceiro_fornecedor}
                  onChange={(e) => setFormData({ ...formData, parceiro_fornecedor: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Selecione...</option>
                  <option value="Parceiro">Parceiro</option>
                  <option value="Fornecedor">Fornecedor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status da Conta</label>
                <select
                  value={formData.status_conta}
                  onChange={(e) => setFormData({ ...formData, status_conta: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {statusContaOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status de Restrição</label>
                <select
                  value={formData.status_restricao}
                  onChange={(e) => setFormData({ ...formData, status_restricao: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {statusRestricaoOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Conferente</label>
                <input
                  type="text"
                  value={formData.conferente}
                  onChange={(e) => setFormData({ ...formData, conferente: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Última Data de Conferência</label>
                <input
                  type="date"
                  value={formData.ultima_data_conferencia}
                  onChange={(e) => setFormData({ ...formData, ultima_data_conferencia: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Grupo Liminar</label>
                <input
                  type="text"
                  value={formData.grupo_liminar}
                  onChange={(e) => setFormData({ ...formData, grupo_liminar: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status no Programa</label>
                <select
                  value={formData.status_programa}
                  onChange={(e) => setFormData({ ...formData, status_programa: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Selecione...</option>
                  {statusProgramaOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
              />
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
  );
}
