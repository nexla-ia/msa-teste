import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import DocumentUpload from '../components/DocumentUpload';
import { formatCPFCNPJ, formatTelefone, formatCEP, calculateAge } from '../lib/formatters';
import { getErrorMessage } from '../lib/errorMessages';
import { FileText } from 'lucide-react';

const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  }
  return value;
};

const formatRG = (value: string | null | undefined) => {
  if (!value) return '';
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  if (numbers.length <= 9) {
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1-$2')
      .replace(/(-\d{1})\d+?$/, '$1');
  }
  return value;
};

const ESTADOS = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
];

type Parceiro = {
  id: string;
  id_parceiro: string;
  nome_parceiro: string;
  telefone: string;
  dt_nasc: string | null;
  cpf: string;
  rg: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  nome_mae: string;
  nome_pai: string;
  tipo: string;
  obs: string;
};

export default function Parceiros() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Parceiro | null>(null);
  const { usuario } = useAuth();
  const [showEstadoDropdown, setShowEstadoDropdown] = useState(false);
  const [filteredEstados, setFilteredEstados] = useState(ESTADOS);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [selectedParceiro, setSelectedParceiro] = useState<Parceiro | null>(null);

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
    id_parceiro: '',
    nome_parceiro: '',
    telefone: '',
    dt_nasc: '',
    cpf: '',
    rg: '',
    email: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    nome_mae: '',
    nome_pai: '',
    tipo: 'Parceiro',
    obs: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('parceiros').select('*').order('nome_parceiro');
      setParceiros(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({
      id_parceiro: '',
      nome_parceiro: '',
      telefone: '',
      dt_nasc: '',
      cpf: '',
      rg: '',
      email: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      nome_mae: '',
      nome_pai: '',
      tipo: 'Parceiro',
      obs: ''
    });
    setFilteredEstados(ESTADOS);
    setModalOpen(true);
  };

  const handleEstadoChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setFormData({ ...formData, estado: upperValue });

    if (upperValue === '') {
      setFilteredEstados(ESTADOS);
    } else {
      const filtered = ESTADOS.filter(
        estado =>
          estado.sigla.startsWith(upperValue) ||
          estado.nome.toUpperCase().includes(upperValue)
      );
      setFilteredEstados(filtered);
    }
    setShowEstadoDropdown(true);
  };

  const selectEstado = (sigla: string) => {
    setFormData({ ...formData, estado: sigla });
    setShowEstadoDropdown(false);
    setFilteredEstados(ESTADOS);
  };

  const handleEdit = (item: Parceiro) => {
    setEditing(item);
    setFormData({
      id_parceiro: item.id_parceiro || '',
      nome_parceiro: item.nome_parceiro || '',
      telefone: formatTelefone(item.telefone),
      dt_nasc: item.dt_nasc || '',
      cpf: formatCPF(item.cpf),
      rg: formatRG(item.rg),
      email: item.email || '',
      endereco: item.endereco || '',
      numero: item.numero || '',
      complemento: item.complemento || '',
      bairro: item.bairro || '',
      cidade: item.cidade || '',
      estado: item.estado || '',
      cep: formatCEP(item.cep),
      nome_mae: item.nome_mae || '',
      nome_pai: item.nome_pai || '',
      tipo: item.tipo || 'Parceiro',
      obs: item.obs || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (item: Parceiro) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir o parceiro "${item.nome_parceiro}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        await supabase.from('parceiros').delete().eq('id', item.id);
        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'DELETE',
          linha_afetada: `Parceiro: ${item.nome_parceiro}`,
          dados_antes: item,
          dados_depois: null
        });
        loadData();
      }
    });
  };

  const handleOpenDocuments = (item: Parceiro) => {
    setSelectedParceiro(item);
    setDocumentModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.id_parceiro || !formData.nome_parceiro || !formData.telefone || !formData.dt_nasc ||
        !formData.cpf || !formData.rg || !formData.email || !formData.tipo || !formData.endereco ||
        !formData.numero || !formData.complemento || !formData.bairro || !formData.cidade ||
        !formData.estado || !formData.cep || !formData.nome_mae || !formData.nome_pai) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Campos Obrigatórios',
        message: 'Por favor, preencha todos os campos obrigatórios.\n\nApenas o campo "Observações" é opcional.'
      });
      return;
    }

    const cpfLimpo = formData.cpf.replace(/\D/g, '');

    const { data: cpfExistente } = await supabase
      .from('parceiros')
      .select('id, nome_parceiro')
      .eq('cpf', cpfLimpo)
      .maybeSingle();

    if (cpfExistente && (!editing || cpfExistente.id !== editing.id)) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'CPF Duplicado',
        message: `Já existe um parceiro cadastrado com este CPF:\n\n${cpfExistente.nome_parceiro}\n\nCada CPF pode ser cadastrado apenas uma vez no sistema.`
      });
      return;
    }

    const { data: idExistente } = await supabase
      .from('parceiros')
      .select('id, nome_parceiro')
      .eq('id_parceiro', formData.id_parceiro.trim())
      .maybeSingle();

    if (idExistente && (!editing || idExistente.id !== editing.id)) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'ID Referência Duplicado',
        message: `Já existe um parceiro cadastrado com este ID Referência:\n\n${idExistente.nome_parceiro}\n\nCada ID Referência pode ser cadastrado apenas uma vez no sistema.`
      });
      return;
    }

    const data = {
      ...formData,
      id_parceiro: formData.id_parceiro.trim() || null,
      telefone: formData.telefone.replace(/\D/g, ''),
      cpf: cpfLimpo,
      rg: formData.rg.replace(/\D/g, ''),
      cep: formData.cep.replace(/\D/g, ''),
      dt_nasc: formData.dt_nasc || null
    };

    try {
      if (editing) {
        const { error } = await supabase.from('parceiros').update(data).eq('id', editing.id);
        if (error) throw error;
        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Parceiro: ${data.nome_parceiro}`,
          dados_antes: editing,
          dados_depois: data
        });
      } else {
        const { error } = await supabase.from('parceiros').insert([data]);
        if (error) throw error;
        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Parceiro: ${data.nome_parceiro}`,
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
        message: `Parceiro ${editing ? 'atualizado' : 'cadastrado'} com sucesso!`
      });
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar o parceiro.\n\n${getErrorMessage(error)}`
      });
    }
  };

  return (
    <>
      <CrudTable
        title="Parceiros"
        data={parceiros}
        columns={[
          { key: 'id_parceiro', label: 'ID Parceiro' },
          { key: 'nome_parceiro', label: 'Nome' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'telefone', label: 'Telefone' },
          {
            key: 'dt_nasc',
            label: 'Data Nasc./Idade',
            render: (item) => {
              if (!item.dt_nasc) return '-';
              const age = calculateAge(item.dt_nasc);
              return `${new Date(item.dt_nasc).toLocaleDateString('pt-BR')} (${age} anos)`;
            }
          },
          { key: 'cpf', label: 'CPF', render: (item) => formatCPF(item.cpf) },
          { key: 'rg', label: 'RG', render: (item) => formatRG(item.rg) },
          { key: 'email', label: 'Email' },
          { key: 'endereco', label: 'Endereço' },
          { key: 'numero', label: 'Nº' },
          { key: 'complemento', label: 'Complemento' },
          { key: 'bairro', label: 'Bairro' },
          { key: 'cidade', label: 'Cidade' },
          { key: 'estado', label: 'Estado' },
          { key: 'cep', label: 'CEP' },
          { key: 'nome_mae', label: 'Nome Mãe' },
          { key: 'nome_pai', label: 'Nome Pai' },
          { key: 'obs', label: 'Observações' }
        ]}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        recurso="parceiros"
        extraActions={(item) => (
          <button
            onClick={() => handleOpenDocuments(item)}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Documentos"
          >
            <FileText className="w-4 h-4" />
          </button>
        )}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Parceiro' : 'Novo Parceiro'}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input
                type="text"
                value={formData.nome_parceiro}
                onChange={(e) => setFormData({ ...formData, nome_parceiro: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ID Parceiro *</label>
              <input
                type="text"
                value={formData.id_parceiro}
                onChange={(e) => setFormData({ ...formData, id_parceiro: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: PARC001"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Parceiro">Parceiro</option>
                <option value="Fornecedor">Fornecedor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone *</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="(00) 00000-0000"
                maxLength={15}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Nascimento *</label>
              <input
                type="date"
                value={formData.dt_nasc}
                onChange={(e) => setFormData({ ...formData, dt_nasc: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Idade</label>
              <input
                type="text"
                value={formData.dt_nasc ? `${calculateAge(formData.dt_nasc)} anos` : ''}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                disabled
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPF *</label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">RG *</label>
              <input
                type="text"
                value={formData.rg}
                onChange={(e) => setFormData({ ...formData, rg: formatRG(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="00.000.000-0"
                maxLength={12}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Endereço *</label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número *</label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Complemento *</label>
              <input
                type="text"
                value={formData.complemento}
                onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bairro *</label>
              <input
                type="text"
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cidade *</label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Digite a Cidade"
                required
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado *</label>
              <input
                type="text"
                value={formData.estado}
                onChange={(e) => handleEstadoChange(e.target.value)}
                onFocus={() => setShowEstadoDropdown(true)}
                onBlur={() => setTimeout(() => setShowEstadoDropdown(false), 200)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Digite a sigla ou nome"
                maxLength={2}
                required
              />
              {showEstadoDropdown && filteredEstados.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredEstados.map((estado) => (
                    <div
                      key={estado.sigla}
                      onClick={() => selectEstado(estado.sigla)}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                    >
                      <span className="font-medium text-slate-900">{estado.sigla}</span>
                      <span className="text-sm text-slate-600">{estado.nome}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CEP *</label>
              <input
                type="text"
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: formatCEP(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="00000-000"
                required
                maxLength={9}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Mãe *</label>
              <input
                type="text"
                value={formData.nome_mae}
                onChange={(e) => setFormData({ ...formData, nome_mae: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Pai *</label>
              <input
                type="text"
                value={formData.nome_pai}
                onChange={(e) => setFormData({ ...formData, nome_pai: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              value={formData.obs}
              onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
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

      {selectedParceiro && (
        <DocumentUpload
          parceiroId={selectedParceiro.id}
          parceiroNome={selectedParceiro.nome_parceiro}
          isOpen={documentModalOpen}
          onClose={() => {
            setDocumentModalOpen(false);
            setSelectedParceiro(null);
          }}
        />
      )}

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
