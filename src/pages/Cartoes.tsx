import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../lib/formatters';
import { getErrorMessage } from '../lib/errorMessages';

type Cartao = {
  id: string;
  cartao: string;
  banco_emissor: string;
  conta_bancaria_id: string | null;
  bandeira?: string | null;
  tipo_cartao?: string;
  cartao_principal_id?: string | null;
  cartao_principal?: { cartao: string };
  status: string;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  valor_mensalidade: number;
  limites: number;
  limite_emergencial: number;
  limite_global: number;
  limite_disponivel: number;
  valor_isencao: number;
  onde_usar: string;
  mes_expiracao?: number | null;
  ano_expiracao?: number | null;
};

type ContaBancaria = {
  id: string;
  nome_banco: string;
  codigo_banco: string;
};

export default function Cartoes() {
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cartao | null>(null);
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
    cartao: '',
    conta_bancaria_id: '',
    bandeira: '',
    tipo_cartao: 'principal',
    cartao_principal_id: '',
    status: 'ativo',
    dia_fechamento: '',
    dia_vencimento: '',
    valor_mensalidade: '',
    limites: '',
    limite_emergencial: '',
    limite_global: '',
    limite_disponivel: '',
    valor_isencao: '',
    onde_usar: '',
    mes_expiracao: '',
    ano_expiracao: ''
  });

  useEffect(() => {
    loadData();
    loadContasBancarias();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('cartoes_credito')
        .select(`
          *,
          conta_bancaria:contas_bancarias(nome_banco, codigo_banco),
          cartao_principal:cartao_principal_id(cartao)
        `)
        .order('cartao');

      const cartoesWithBanco = (data || []).map(item => ({
        ...item,
        banco_emissor: item.conta_bancaria?.nome_banco || item.banco_emissor || ''
      }));

      setCartoes(cartoesWithBanco);
    } finally {
      setLoading(false);
    }
  };

  const loadContasBancarias = async () => {
    const { data } = await supabase.from('contas_bancarias').select('*').order('nome_banco');
    setContasBancarias(data || []);
  };

  const isCartaoExpirado = (cartao: Cartao): boolean => {
    if (!cartao.mes_expiracao || !cartao.ano_expiracao) {
      return false;
    }
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    if (cartao.ano_expiracao < anoAtual) {
      return true;
    }
    if (cartao.ano_expiracao === anoAtual && cartao.mes_expiracao < mesAtual) {
      return true;
    }
    return false;
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({ cartao: '', conta_bancaria_id: '', bandeira: '', tipo_cartao: 'principal', cartao_principal_id: '', status: 'ativo', dia_fechamento: '', dia_vencimento: '', valor_mensalidade: '', limites: '', limite_emergencial: '', limite_global: '', limite_disponivel: '', valor_isencao: '', onde_usar: '', mes_expiracao: '', ano_expiracao: '' });
    setModalOpen(true);
  };

  const handleEdit = (item: Cartao) => {
    if (isCartaoExpirado(item)) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Cartão Expirado',
        message: `Este cartão expirou em ${item.mes_expiracao?.toString().padStart(2, '0')}/${item.ano_expiracao}.\n\nPara editar, você deve atualizar a data de expiração para um período válido.`
      });
    }
    setEditing(item);
    setFormData({
      cartao: item.cartao || '',
      conta_bancaria_id: item.conta_bancaria_id || '',
      bandeira: item.bandeira || '',
      tipo_cartao: item.tipo_cartao || 'principal',
      cartao_principal_id: item.cartao_principal_id || '',
      status: item.status,
      dia_fechamento: item.dia_fechamento?.toString() || '',
      dia_vencimento: item.dia_vencimento?.toString() || '',
      valor_mensalidade: item.valor_mensalidade ? formatCurrency(item.valor_mensalidade) : '',
      limites: item.limites ? formatCurrency(item.limites) : '',
      limite_emergencial: item.limite_emergencial ? formatCurrency(item.limite_emergencial) : '',
      limite_global: item.limite_global ? formatCurrency(item.limite_global) : '',
      limite_disponivel: item.limite_disponivel ? formatCurrency(item.limite_disponivel) : '',
      valor_isencao: item.valor_isencao ? formatCurrency(item.valor_isencao) : '',
      onde_usar: item.onde_usar,
      mes_expiracao: item.mes_expiracao?.toString() || '',
      ano_expiracao: item.ano_expiracao?.toString() || ''
    });
    setModalOpen(true);
  };

  const handleCurrencyChange = (field: string, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const formatted = cleaned ? formatCurrencyInput(cleaned) : '';
    setFormData({ ...formData, [field]: formatted });
  };

  const handleDelete = async (item: Cartao) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusao',
      message: `Deseja realmente excluir o cartao "${item.cartao}"? Esta acao nao pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await supabase.from('cartoes_credito').delete().eq('id', item.id);
          await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'DELETE', linha_afetada: `Cartão: ${item.cartao}`, dados_antes: item, dados_depois: null });
          loadData();
          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Cartao excluido com sucesso!'
          });
        } catch (error: any) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir o cartão.\n\n${getErrorMessage(error)}`
          });
        }
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.mes_expiracao && formData.ano_expiracao) {
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();
      const mesAtual = hoje.getMonth() + 1;
      const mesExp = parseInt(formData.mes_expiracao);
      const anoExp = parseInt(formData.ano_expiracao);

      if (anoExp < anoAtual || (anoExp === anoAtual && mesExp < mesAtual)) {
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Data de Expiração Inválida',
          message: 'Não é possível cadastrar um cartão com data de expiração no passado.\n\nPor favor, verifique o mês e ano de expiração.'
        });
        return;
      }
    }

    const contaBancaria = contasBancarias.find(c => c.id === formData.conta_bancaria_id);
    const data = {
      cartao: formData.cartao,
      conta_bancaria_id: formData.conta_bancaria_id || null,
      banco_emissor: contaBancaria?.nome_banco || '',
      bandeira: formData.bandeira || null,
      tipo_cartao: formData.tipo_cartao,
      cartao_principal_id: formData.cartao_principal_id || null,
      status: formData.status,
      dia_fechamento: formData.dia_fechamento ? parseInt(formData.dia_fechamento) : null,
      dia_vencimento: formData.dia_vencimento ? parseInt(formData.dia_vencimento) : null,
      valor_mensalidade: formData.valor_mensalidade ? parseCurrencyInput(formData.valor_mensalidade) : 0,
      limites: formData.limites ? parseCurrencyInput(formData.limites) : 0,
      limite_emergencial: formData.limite_emergencial ? parseCurrencyInput(formData.limite_emergencial) : 0,
      limite_global: formData.limite_global ? parseCurrencyInput(formData.limite_global) : 0,
      limite_disponivel: formData.limite_disponivel ? parseCurrencyInput(formData.limite_disponivel) : 0,
      valor_isencao: formData.valor_isencao ? parseCurrencyInput(formData.valor_isencao) : 0,
      onde_usar: formData.onde_usar,
      mes_expiracao: formData.mes_expiracao ? parseInt(formData.mes_expiracao) : null,
      ano_expiracao: formData.ano_expiracao ? parseInt(formData.ano_expiracao) : null
    };

    try {
      if (editing) {
        await supabase.from('cartoes_credito').update(data).eq('id', editing.id);
        await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'UPDATE', linha_afetada: `Cartão: ${data.cartao}`, dados_antes: editing, dados_depois: data });
      } else {
        await supabase.from('cartoes_credito').insert([data]);
        await supabase.from('logs').insert({ usuario_id: usuario?.id, usuario_nome: usuario?.nome || '', acao: 'INSERT', linha_afetada: `Cartão: ${data.cartao}`, dados_antes: null, dados_depois: data });
      }
      setModalOpen(false);
      loadData();
      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: `Cartão ${editing ? 'atualizado' : 'cadastrado'} com sucesso!`
      });
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar o cartão.\n\n${getErrorMessage(error)}`
      });
    }
  };

  return (
    <>
      <CrudTable
        title="Cartões de Crédito"
        data={cartoes}
        columns={[
          { key: 'cartao', label: 'Cartão' },
          { key: 'banco_emissor', label: 'Banco Emissor' },
          {
            key: 'status',
            label: 'Status',
            render: (item: Cartao) => {
              const expirado = isCartaoExpirado(item);
              if (expirado) {
                return (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      EXPIRADO
                    </span>
                    <span className="text-slate-600 text-sm">
                      {item.mes_expiracao?.toString().padStart(2, '0')}/{item.ano_expiracao}
                    </span>
                  </div>
                );
              }
              return item.status;
            }
          },
          { key: 'dia_fechamento', label: 'Dia Fechamento' },
          { key: 'dia_vencimento', label: 'Dia Vencimento' },
          {
            key: 'mes_expiracao',
            label: 'Mês Expiração',
            render: (item: Cartao) => {
              if (!item.mes_expiracao) return '-';
              return item.mes_expiracao.toString().padStart(2, '0');
            }
          },
          {
            key: 'ano_expiracao',
            label: 'Ano Expiração',
            render: (item: Cartao) => {
              if (!item.ano_expiracao) return '-';
              return item.ano_expiracao.toString();
            }
          },
          { key: 'valor_mensalidade', label: 'Mensalidade', sumable: true, render: (item) => formatCurrency(item.valor_mensalidade) },
          { key: 'limites', label: 'Limite', sumable: true, render: (item) => formatCurrency(item.limites) },
          { key: 'limite_emergencial', label: 'Limite Emergencial', sumable: true, render: (item) => formatCurrency(item.limite_emergencial) },
          { key: 'limite_global', label: 'Limite Global', sumable: true, render: (item) => formatCurrency(item.limite_global) },
          { key: 'valor_isencao', label: 'Valor Isenção', sumable: true, render: (item) => formatCurrency(item.valor_isencao) },
          { key: 'onde_usar', label: 'Onde Usar' }
        ]}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        showTotals={true}
        recurso="cartoes"
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Cartão' : 'Novo Cartão'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cartão *</label>
              <input type="text" value={formData.cartao} onChange={(e) => setFormData({ ...formData, cartao: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bandeira</label>
              <select
                value={formData.bandeira}
                onChange={(e) => setFormData({ ...formData, bandeira: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="Amex">Amex</option>
                <option value="Elo">Elo</option>
                <option value="Hipercard">Hipercard</option>
                <option value="Diners Club">Diners Club</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Banco Emissão</label>
              <select
                value={formData.conta_bancaria_id}
                onChange={(e) => setFormData({ ...formData, conta_bancaria_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um banco</option>
                {contasBancarias.map(conta => (
                  <option key={conta.id} value={conta.id}>
                    {conta.codigo_banco ? `${conta.codigo_banco} - ${conta.nome_banco}` : conta.nome_banco}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Cartão</label>
              <select
                value={formData.tipo_cartao}
                onChange={(e) => setFormData({ ...formData, tipo_cartao: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="principal">Principal</option>
                <option value="adicional">Adicional</option>
                <option value="virtual">Virtual</option>
              </select>
            </div>
          </div>
          {(formData.tipo_cartao === 'adicional' || formData.tipo_cartao === 'virtual') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cartão Principal</label>
              <select
                value={formData.cartao_principal_id}
                onChange={(e) => setFormData({ ...formData, cartao_principal_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione o cartão principal</option>
                {cartoes.filter(c => c.tipo_cartao === 'principal' && c.id !== editing?.id).map(cartao => (
                  <option key={cartao.id} value={cartao.id}>
                    {cartao.cartao}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="ativo">Ativo</option>
                <option value="titular">Titular</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dia Fechamento</label>
              <input type="number" min="1" max="31" value={formData.dia_fechamento} onChange={(e) => setFormData({ ...formData, dia_fechamento: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dia Vencimento</label>
              <input type="number" min="1" max="31" value={formData.dia_vencimento} onChange={(e) => setFormData({ ...formData, dia_vencimento: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Mensalidade</label>
              <input type="text" value={formData.valor_mensalidade} onChange={(e) => handleCurrencyChange('valor_mensalidade', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="R$ 0,00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Limites</label>
              <input type="text" value={formData.limites} onChange={(e) => handleCurrencyChange('limites', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="R$ 0,00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Limite Emergencial</label>
              <input type="text" value={formData.limite_emergencial} onChange={(e) => handleCurrencyChange('limite_emergencial', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="R$ 0,00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Limite Global</label>
              <input type="text" value={formData.limite_global} onChange={(e) => handleCurrencyChange('limite_global', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="R$ 0,00" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor para Isenção</label>
            <input type="text" value={formData.valor_isencao} onChange={(e) => handleCurrencyChange('valor_isencao', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="R$ 0,00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Onde Usar</label>
            <textarea value={formData.onde_usar} onChange={(e) => setFormData({ ...formData, onde_usar: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mês de Expiração</label>
              <select
                value={formData.mes_expiracao}
                onChange={(e) => setFormData({ ...formData, mes_expiracao: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                  <option key={mes} value={mes}>{mes.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ano de Expiração</label>
              <select
                value={formData.ano_expiracao}
                onChange={(e) => setFormData({ ...formData, ano_expiracao: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() + i).map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
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
