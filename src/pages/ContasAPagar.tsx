import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, DollarSign, TrendingDown, AlertCircle, Calendar, CheckCircle, X, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import ConfirmDialog from '../components/ConfirmDialog';

type ContaPagar = {
  id: string;
  origem_tipo: string;
  origem_id: string;
  parceiro_id: string | null;
  programa_id: string | null;
  descricao: string;
  data_vencimento: string;
  valor_parcela: number;
  numero_parcela: number;
  total_parcelas: number;
  forma_pagamento: string | null;
  cartao_id: string | null;
  conta_bancaria_id: string | null;
  status_pagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  data_pagamento: string | null;
  valor_pago: number | null;
  observacao: string | null;
  created_at: string;
  parceiro?: { nome_parceiro: string };
  programa?: { nome: string };
  cartao?: { cartao: string };
  conta_bancaria?: { nome_banco: string };
  criado_por?: { nome: string };
};

export default function ContasAPagar() {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPagamento, setFiltroPagamento] = useState('');
  const [filtroVencDe, setFiltroVencDe] = useState('');
  const [filtroVencAte, setFiltroVencAte] = useState('');
  const [filtroGeradoDe, setFiltroGeradoDe] = useState('');
  const [filtroGeradoAte, setFiltroGeradoAte] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<ContaPagar | null>(null);
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [valorPagamento, setValorPagamento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  useEffect(() => {
    carregarContas();
  }, []);

  const carregarContas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contas_a_pagar')
        .select(`
          *,
          parceiro:parceiros(nome_parceiro),
          programa:programas_fidelidade(nome),
          cartao:cartoes_credito(cartao),
          conta_bancaria:contas_bancarias(nome_banco),
          criado_por:usuarios!contas_a_pagar_created_by_fkey(nome)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContas(data || []);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
      setConfirmDialog({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Erro ao carregar contas a pagar.'
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirModalPagar = (conta: ContaPagar) => {
    setContaSelecionada(conta);
    setValorPagamento(conta.valor_parcela.toString());
    setDataPagamento(new Date().toISOString().split('T')[0]);
    setShowPagarModal(true);
  };

  const registrarPagamento = async () => {
    if (!contaSelecionada) return;

    try {
      const { error } = await supabase
        .from('contas_a_pagar')
        .update({
          status_pagamento: 'pago',
          data_pagamento: dataPagamento,
          valor_pago: parseFloat(valorPagamento)
        })
        .eq('id', contaSelecionada.id);

      if (error) throw error;

      setConfirmDialog({
        isOpen: true,
        type: 'success',
        title: 'Pagamento Registrado',
        message: 'Pagamento registrado com sucesso!'
      });

      setShowPagarModal(false);
      await carregarContas();
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      setConfirmDialog({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Erro ao registrar pagamento.'
      });
    }
  };

  const cancelarConta = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contas_a_pagar')
        .update({ status_pagamento: 'cancelado' })
        .eq('id', id);

      if (error) throw error;

      setConfirmDialog({
        isOpen: true,
        type: 'success',
        title: 'Conta Cancelada',
        message: 'Conta cancelada com sucesso!'
      });

      await carregarContas();
    } catch (error) {
      console.error('Erro ao cancelar conta:', error);
      setConfirmDialog({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Erro ao cancelar conta.'
      });
    }
  };

  const formasPagamento = [...new Set(contas.map(c => c.forma_pagamento).filter(Boolean))] as string[];

  const contasFiltradas = contas.filter(conta => {
    if (busca) {
      const q = busca.toLowerCase();
      const match =
        conta.descricao.toLowerCase().includes(q) ||
        conta.parceiro?.nome_parceiro?.toLowerCase().includes(q) ||
        conta.programa?.nome?.toLowerCase().includes(q) ||
        conta.forma_pagamento?.toLowerCase().includes(q) ||
        conta.cartao?.cartao?.toLowerCase().includes(q) ||
        conta.criado_por?.nome?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filtroStatus && conta.status_pagamento !== filtroStatus) return false;
    if (filtroTipo && conta.origem_tipo !== filtroTipo) return false;
    if (filtroPagamento && conta.forma_pagamento !== filtroPagamento) return false;
    if (filtroVencDe && conta.data_vencimento < filtroVencDe) return false;
    if (filtroVencAte && conta.data_vencimento > filtroVencAte) return false;
    if (filtroGeradoDe && conta.created_at.split('T')[0] < filtroGeradoDe) return false;
    if (filtroGeradoAte && conta.created_at.split('T')[0] > filtroGeradoAte) return false;
    return true;
  });

  const filtrosAtivos = [filtroStatus, filtroTipo, filtroPagamento, filtroVencDe, filtroVencAte, filtroGeradoDe, filtroGeradoAte].filter(Boolean).length;

  const limparFiltros = () => {
    setFiltroStatus('');
    setFiltroTipo('');
    setFiltroPagamento('');
    setFiltroVencDe('');
    setFiltroVencAte('');
    setFiltroGeradoDe('');
    setFiltroGeradoAte('');
  };

  const calcularTotais = () => {
    const totalPendente = contasFiltradas
      .filter(c => c.status_pagamento === 'pendente')
      .reduce((sum, c) => sum + c.valor_parcela, 0);

    const totalPago = contasFiltradas
      .filter(c => c.status_pagamento === 'pago')
      .reduce((sum, c) => sum + (c.valor_pago || 0), 0);

    const hoje = new Date();
    const totalVencido = contasFiltradas
      .filter(c => c.status_pagamento === 'pendente' && new Date(c.data_vencimento) < hoje)
      .reduce((sum, c) => sum + c.valor_parcela, 0);

    return { totalPendente, totalPago, totalVencido, totalGeral: totalPendente + totalPago };
  };

  const { totalPendente, totalPago, totalVencido, totalGeral } = calcularTotais();

  const getStatusConta = (conta: ContaPagar) => {
    if (conta.status_pagamento === 'pago') return { label: 'Pago', color: 'bg-green-100 text-green-800' };
    if (conta.status_pagamento === 'cancelado') return { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' };

    const hoje = new Date();
    const vencimento = new Date(conta.data_vencimento);

    if (vencimento < hoje) {
      return { label: 'Vencido', color: 'bg-red-100 text-red-800' };
    }

    return { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' };
  };

  const formatDescricao = (desc: string) =>
    desc.replace(/([\d]+(?:\.\d+)?)\s*pontos\/milhas/g, (_, num) =>
      `${parseFloat(num).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} pontos/milhas`
    );

  const getTipoOrigemLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      'compra': 'Compra de Pontos',
      'compra_bonificada': 'Compra Bonificada',
      'clube': 'Mensalidade Clube',
      'transferencia_pontos': 'Transferência',
      'ajuste': 'Ajuste',
      'outro': 'Outro'
    };
    return tipos[tipo] || tipo;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Contas a Pagar</h1>
        <p className="text-slate-600 mt-2">Gerencie suas contas a pagar e despesas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Total a Pagar</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(totalPendente)}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Total Pago</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(totalPago)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Valores Vencidos</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {formatCurrency(totalVencido)}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Total Geral</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(totalGeral)}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 space-y-3">
          {/* Busca + botão filtros */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por descrição, parceiro, programa, cartão..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <button
              onClick={() => setShowFiltros(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${showFiltros ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {filtrosAtivos > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{filtrosAtivos}</span>
              )}
              {showFiltros ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Painel de filtros avançados */}
          {showFiltros && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos</option>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                  <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos</option>
                    <option value="compra">Compra de Pontos</option>
                    <option value="compra_bonificada">Compra Bonificada</option>
                    <option value="clube">Mensalidade Clube</option>
                    <option value="transferencia_pontos">Transferência</option>
                    <option value="ajuste">Ajuste</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Forma de Pagamento</label>
                  <select value={filtroPagamento} onChange={e => setFiltroPagamento(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Todas</option>
                    {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento de</label>
                  <input type="date" value={filtroVencDe} onChange={e => setFiltroVencDe(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento até</label>
                  <input type="date" value={filtroVencAte} onChange={e => setFiltroVencAte(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Gerado de</label>
                  <input type="date" value={filtroGeradoDe} onChange={e => setFiltroGeradoDe(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Gerado até</label>
                  <input type="date" value={filtroGeradoAte} onChange={e => setFiltroGeradoAte(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {filtrosAtivos > 0 && (
                <div className="flex justify-end">
                  <button onClick={limparFiltros}
                    className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1">
                    <X className="w-3 h-3" /> Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Parcela
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Pagamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Gerado em / Por
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {contasFiltradas.map((conta) => {
                const status = getStatusConta(conta);
                return (
                  <tr key={conta.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {getTipoOrigemLabel(conta.origem_tipo)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="max-w-xs">
                        <p className="font-medium truncate">{formatDescricao(conta.descricao)}</p>
                        {conta.parceiro && (
                          <p className="text-xs text-slate-500">{conta.parceiro.nome_parceiro}</p>
                        )}
                        {conta.programa && (
                          <p className="text-xs text-slate-500">{conta.programa.nome}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {formatCurrency(conta.valor_parcela)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {conta.numero_parcela}/{conta.total_parcelas}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div>
                        <p>{conta.forma_pagamento || '-'}</p>
                        {conta.cartao && (
                          <p className="text-xs text-slate-500">{conta.cartao.cartao}</p>
                        )}
                        {conta.conta_bancaria && (
                          <p className="text-xs text-slate-500">{conta.conta_bancaria.nome_banco}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      <div>
                        <p>{new Date(conta.created_at).toLocaleDateString('pt-BR')}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(conta.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {conta.criado_por?.nome && (
                          <p className="text-xs text-slate-400">{conta.criado_por.nome}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {conta.status_pagamento === 'pendente' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => abrirModalPagar(conta)}
                            className="text-green-600 hover:text-green-800"
                            title="Registrar Pagamento"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => cancelarConta(conta.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Cancelar"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {conta.status_pagamento === 'pago' && conta.data_pagamento && (
                        <div className="text-xs text-slate-500">
                          Pago em: {new Date(conta.data_pagamento).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {contasFiltradas.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              Nenhuma conta encontrada
            </div>
          )}
        </div>
      </div>

      {showPagarModal && contaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Registrar Pagamento</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descrição
                </label>
                <p className="text-sm text-slate-600">{contaSelecionada.descricao}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Valor Original
                </label>
                <p className="text-sm text-slate-900 font-medium">
                  {formatCurrency(contaSelecionada.valor_parcela)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Valor Pago *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={valorPagamento}
                  onChange={(e) => setValorPagamento(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data do Pagamento *
                </label>
                <input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPagarModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={registrarPagamento}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        type={confirmDialog.type}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
