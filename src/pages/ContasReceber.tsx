import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, DollarSign, TrendingUp, AlertCircle, CheckCircle, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/formatters';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

type ContaReceber = {
  id: string;
  parent_conta_id: string | null;
  venda_id: string | null;
  data_vencimento: string;
  valor_parcela: number;
  numero_parcela: number;
  total_parcelas: number;
  forma_pagamento: string | null;
  conta_bancaria_id: string | null;
  cartao_id: string | null;
  status_pagamento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  observacao: string | null;
  origem_tipo: string | null;
  origem_id: string | null;
  created_at: string;
  // Computed/joined
  parceiro_nome?: string;
  programa_nome?: string;
  origem_descricao?: string;
};

type RecebimentoForm = {
  tipo_pagamento: 'total' | 'parcial';
  data_pagamento: string;
  valor_pago: number;
  nova_data_vencimento: string;
  observacao: string;
};

export default function ContasReceber() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'pago' | 'atrasado' | 'parcial'>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<'todos' | 'venda' | 'transferencia_pessoas'>('todos');
  const [contaSelecionada, setContaSelecionada] = useState<ContaReceber | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showRecebimentoModal, setShowRecebimentoModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [recebimentoForm, setRecebimentoForm] = useState<RecebimentoForm>({
    tipo_pagamento: 'total',
    data_pagamento: new Date().toISOString().split('T')[0],
    valor_pago: 0,
    nova_data_vencimento: '',
    observacao: ''
  });
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    carregarContas();
  }, []);

  const carregarContas = async () => {
    try {
      setLoading(true);

      // Buscar contas sem join aninhado para evitar erros de relacionamento
      const { data, error } = await supabase
        .from('contas_receber')
        .select('*')
        .not('status_pagamento', 'eq', 'cancelado')
        .order('data_vencimento', { ascending: true });

      if (error) throw error;

      const registros = data || [];

      // Buscar vendas separadamente
      const vendaIds = registros
        .filter(c => (c.origem_tipo === 'venda' || c.venda_id) && (c.origem_id || c.venda_id))
        .map(c => c.origem_id || c.venda_id)
        .filter(Boolean) as string[];

      let vendaMap: Record<string, any> = {};
      if (vendaIds.length > 0) {
        const { data: vendas } = await supabase
          .from('vendas')
          .select('id, parceiro_id, programa_id, parceiros(nome_parceiro), programas_fidelidade(nome), clientes(nome_cliente)')
          .in('id', vendaIds);

        (vendas || []).forEach(v => {
          vendaMap[v.id] = v;
        });
      }

      // Buscar dados de transferencia_pessoas separadamente
      const transferIds = registros
        .filter(c => c.origem_tipo === 'transferencia_pessoas' && c.origem_id)
        .map(c => c.origem_id as string);

      let transferMap: Record<string, any> = {};
      if (transferIds.length > 0) {
        const { data: transferencias } = await supabase
          .from('transferencia_pessoas')
          .select(`
            id,
            origem_parceiro:parceiros!origem_parceiro_id(nome_parceiro),
            destino_parceiro:parceiros!destino_parceiro_id(nome_parceiro),
            programas_fidelidade(nome)
          `)
          .in('id', transferIds);

        (transferencias || []).forEach(t => {
          transferMap[t.id] = t;
        });
      }

      const hoje = new Date().toISOString().split('T')[0];

      const contasFormatadas: ContaReceber[] = registros.map(conta => {
        let parceiro_nome = '-';
        let programa_nome = '-';
        let origem_descricao = 'Outro';

        const origemTipo = conta.origem_tipo || (conta.venda_id ? 'venda' : null);

        if (origemTipo === 'venda') {
          const vendaId = conta.origem_id || conta.venda_id;
          const venda = vendaId ? vendaMap[vendaId] : null;
          if (venda) {
            const nome = (venda.parceiros as any)?.nome_parceiro || (venda.clientes as any)?.nome_cliente;
            parceiro_nome = nome || '-';
            programa_nome = (venda.programas_fidelidade as any)?.nome || '-';
          }
          origem_descricao = 'Venda';
        } else if (origemTipo === 'transferencia_pessoas' && conta.origem_id) {
          const t = transferMap[conta.origem_id];
          if (t) {
            const origemNome = (t.origem_parceiro as any)?.nome_parceiro || '-';
            const destinoNome = (t.destino_parceiro as any)?.nome_parceiro || '-';
            parceiro_nome = `${origemNome} → ${destinoNome}`;
            programa_nome = (t.programas_fidelidade as any)?.nome || '-';
          }
          origem_descricao = 'Transferência';
        }

        // Calcular status real
        let status = conta.status_pagamento;
        if (status === 'pendente' && conta.data_vencimento < hoje) {
          status = 'atrasado';
        }

        return {
          ...conta,
          status_pagamento: status,
          parceiro_nome,
          programa_nome,
          origem_descricao,
        };
      });

      setContas(contasFormatadas);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirRecebimento = (conta: ContaReceber) => {
    setContaSelecionada(conta);
    setRecebimentoForm({
      tipo_pagamento: 'total',
      data_pagamento: new Date().toISOString().split('T')[0],
      valor_pago: conta.valor_parcela,
      nova_data_vencimento: '',
      observacao: ''
    });
    setShowRecebimentoModal(true);
  };

  const registrarRecebimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contaSelecionada) return;

    const isParcial =
      recebimentoForm.tipo_pagamento === 'parcial' &&
      recebimentoForm.valor_pago < contaSelecionada.valor_parcela;

    if (isParcial && !recebimentoForm.nova_data_vencimento) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Campo obrigatório',
        message: 'Informe a nova data de vencimento para o saldo restante.'
      });
      return;
    }

    try {
      setSalvando(true);

      if (isParcial) {
        const saldoRestante = contaSelecionada.valor_parcela - recebimentoForm.valor_pago;

        // Atualizar conta atual como parcialmente paga
        const { error: errUpdate } = await supabase
          .from('contas_receber')
          .update({
            status_pagamento: 'parcial',
            data_pagamento: recebimentoForm.data_pagamento,
            valor_pago: recebimentoForm.valor_pago,
            observacao: recebimentoForm.observacao || contaSelecionada.observacao,
            updated_at: new Date().toISOString()
          })
          .eq('id', contaSelecionada.id);

        if (errUpdate) throw errUpdate;

        // Criar nova conta para o saldo restante
        const { error: errInsert } = await supabase
          .from('contas_receber')
          .insert({
            venda_id: contaSelecionada.venda_id,
            origem_tipo: contaSelecionada.origem_tipo,
            origem_id: contaSelecionada.origem_id,
            data_vencimento: recebimentoForm.nova_data_vencimento,
            valor_parcela: saldoRestante,
            numero_parcela: contaSelecionada.numero_parcela,
            total_parcelas: contaSelecionada.total_parcelas,
            forma_pagamento: contaSelecionada.forma_pagamento,
            conta_bancaria_id: contaSelecionada.conta_bancaria_id,
            cartao_id: contaSelecionada.cartao_id,
            status_pagamento: 'pendente',
            parent_conta_id: contaSelecionada.id,
            observacao: `Saldo restante de pagamento parcial em ${recebimentoForm.data_pagamento}`
          });

        if (errInsert) throw errInsert;
      } else {
        // Pagamento total
        const { error } = await supabase
          .from('contas_receber')
          .update({
            status_pagamento: 'pago',
            data_pagamento: recebimentoForm.data_pagamento,
            valor_pago: recebimentoForm.valor_pago,
            observacao: recebimentoForm.observacao || contaSelecionada.observacao,
            updated_at: new Date().toISOString()
          })
          .eq('id', contaSelecionada.id);

        if (error) throw error;
      }

      setShowRecebimentoModal(false);
      setContaSelecionada(null);
      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: isParcial
          ? `Pagamento parcial registrado! Saldo restante de ${formatCurrency(contaSelecionada.valor_parcela - recebimentoForm.valor_pago)} criado com vencimento em ${formatDate(recebimentoForm.nova_data_vencimento)}.`
          : 'Recebimento registrado com sucesso!'
      });
      await carregarContas();
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Registrar',
        message: error.message || 'Ocorreu um erro ao registrar o recebimento.'
      });
    } finally {
      setSalvando(false);
    }
  };

  const confirmarEstorno = (conta: ContaReceber) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Estorno',
      message: `Deseja estornar o recebimento de ${formatCurrency(conta.valor_pago ?? conta.valor_parcela)} desta conta? O status voltará para Pendente.`,
      onConfirm: () => estornarRecebimento(conta)
    });
  };

  const estornarRecebimento = async (conta: ContaReceber) => {
    try {
      const { error } = await supabase
        .from('contas_receber')
        .update({
          status_pagamento: 'pendente',
          data_pagamento: null,
          valor_pago: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', conta.id);

      if (error) throw error;

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'Recebimento estornado com sucesso!'
      });
      await carregarContas();
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Estornar',
        message: error.message || 'Ocorreu um erro ao estornar o recebimento.'
      });
    }
  };

  const contasFiltradas = contas.filter(conta => {
    const matchBusca =
      busca === '' ||
      conta.parceiro_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      conta.programa_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      conta.origem_descricao?.toLowerCase().includes(busca.toLowerCase());

    const matchStatus = filtroStatus === 'todos' || conta.status_pagamento === filtroStatus;

    const origemTipo = conta.origem_tipo || (conta.venda_id ? 'venda' : 'outro');
    const matchOrigem = filtroOrigem === 'todos' || origemTipo === filtroOrigem;

    return matchBusca && matchStatus && matchOrigem;
  });

  const totais = {
    pendente: contas
      .filter(c => c.status_pagamento === 'pendente')
      .reduce((s, c) => s + c.valor_parcela, 0),
    pago: contas
      .filter(c => c.status_pagamento === 'pago')
      .reduce((s, c) => s + (c.valor_pago ?? c.valor_parcela), 0),
    atrasado: contas
      .filter(c => c.status_pagamento === 'atrasado')
      .reduce((s, c) => s + c.valor_parcela, 0),
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pago':     return { label: 'Pago',     color: 'bg-green-100 text-green-800' };
      case 'parcial':  return { label: 'Parcial',  color: 'bg-blue-100 text-blue-800' };
      case 'atrasado': return { label: 'Atrasado', color: 'bg-red-100 text-red-800' };
      case 'cancelado':return { label: 'Cancelado',color: 'bg-slate-100 text-slate-600' };
      default:         return { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' };
    }
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
        <h1 className="text-3xl font-bold text-slate-900">Contas a Receber</h1>
        <p className="text-slate-600 mt-2">Gerencie recebimentos de vendas e transferências entre pessoas</p>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">A Receber</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(totais.pendente)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {contas.filter(c => c.status_pagamento === 'pendente').length} parcela(s)
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Já Recebido</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totais.pago)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {contas.filter(c => c.status_pagamento === 'pago').length} parcela(s)
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Em Atraso</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totais.atrasado)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {contas.filter(c => c.status_pagamento === 'atrasado').length} parcela(s)
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por parceiro, programa ou origem..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filtroOrigem}
              onChange={(e) => setFiltroOrigem(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todas as origens</option>
              <option value="venda">Vendas</option>
              <option value="transferencia_pessoas">Transferências</option>
            </select>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
              <option value="parcial">Parcial</option>
              <option value="pago">Pago</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Origem</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Parceiro / Partes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Programa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Parcela</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vencimento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Forma Pgto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Recebido em</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {(() => {
                if (contasFiltradas.length === 0) {
                  return (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                        Nenhuma conta encontrada
                      </td>
                    </tr>
                  );
                }

                // Separar filhos (têm parent_conta_id) dos pais/independentes
                const filhosMap: Record<string, ContaReceber[]> = {};
                const filhoIds = new Set<string>();
                for (const c of contasFiltradas) {
                  if (c.parent_conta_id) {
                    filhoIds.add(c.id);
                    if (!filhosMap[c.parent_conta_id]) filhosMap[c.parent_conta_id] = [];
                    filhosMap[c.parent_conta_id].push(c);
                  }
                }
                const principais = contasFiltradas.filter(c => !filhoIds.has(c.id));

                const renderAcao = (conta: ContaReceber) => {
                  if (conta.status_pagamento === 'pago') {
                    return (
                      <button onClick={() => confirmarEstorno(conta)} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors" title="Estornar">
                        <RotateCcw className="w-4 h-4" /> Estornar
                      </button>
                    );
                  }
                  if (conta.status_pagamento === 'parcial') {
                    return <span className="text-xs text-blue-600 font-medium">Pgto parcial</span>;
                  }
                  return (
                    <button onClick={() => abrirRecebimento(conta)} className="flex items-center gap-1 text-green-600 hover:text-green-800 font-medium transition-colors">
                      <CheckCircle className="w-4 h-4" /> Registrar
                    </button>
                  );
                };

                const renderOrigem = (conta: ContaReceber) => (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    conta.origem_descricao === 'Venda' ? 'bg-blue-100 text-blue-700'
                    : conta.origem_descricao === 'Transferência' ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-100 text-slate-600'
                  }`}>{conta.origem_descricao}</span>
                );

                const rows: React.ReactNode[] = [];

                for (const conta of principais) {
                  const filhos = filhosMap[conta.id] || [];
                  const temFilhos = filhos.length > 0;
                  const expandido = expandedIds.has(conta.id);
                  const statusInfo = getStatusInfo(conta.status_pagamento);

                  rows.push(
                    <tr key={conta.id} className={`hover:bg-slate-50 ${temFilhos ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {temFilhos && (
                            <button
                              onClick={() => setExpandedIds(prev => {
                                const next = new Set(prev);
                                next.has(conta.id) ? next.delete(conta.id) : next.add(conta.id);
                                return next;
                              })}
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                              title={expandido ? 'Recolher' : 'Expandir pagamentos parciais'}
                            >
                              {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                          {renderOrigem(conta)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-900 max-w-[200px] truncate" title={conta.parceiro_nome}>{conta.parceiro_nome}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900">{conta.programa_nome}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{conta.numero_parcela}/{conta.total_parcelas}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                        {formatCurrency(conta.valor_parcela)}
                        {conta.status_pagamento === 'parcial' && conta.valor_pago != null && (
                          <div className="text-xs font-normal text-blue-600">
                            Pago: {formatCurrency(conta.valor_pago)} | Restante: {formatCurrency(conta.valor_parcela - conta.valor_pago)}
                          </div>
                        )}
                        {conta.status_pagamento === 'pago' && conta.valor_pago != null && conta.valor_pago !== conta.valor_parcela && (
                          <div className="text-xs font-normal text-green-600">Recebido: {formatCurrency(conta.valor_pago)}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900">{formatDate(conta.data_vencimento)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{conta.forma_pagamento || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{conta.data_pagamento ? formatDate(conta.data_pagamento) : '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">{renderAcao(conta)}</td>
                    </tr>
                  );

                  // Sub-linhas (filhos) — só mostrar se expandido
                  if (temFilhos && expandido) {
                    for (const filho of filhos) {
                      const filhoStatus = getStatusInfo(filho.status_pagamento);
                      rows.push(
                        <tr key={filho.id} className="bg-slate-50 border-l-4 border-blue-200">
                          <td className="px-4 py-3 whitespace-nowrap pl-10">
                            <span className="text-xs text-slate-400 italic">↳ saldo restante</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{filho.parceiro_nome}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{filho.programa_nome}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{filho.numero_parcela}/{filho.total_parcelas}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(filho.valor_parcela)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{formatDate(filho.data_vencimento)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{filho.forma_pagamento || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{filho.data_pagamento ? formatDate(filho.data_pagamento) : '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${filhoStatus.color}`}>{filhoStatus.label}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{renderAcao(filho)}</td>
                        </tr>
                      );
                    }
                  }
                }

                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Recebimento */}
      <Modal
        isOpen={showRecebimentoModal}
        onClose={() => { setShowRecebimentoModal(false); setContaSelecionada(null); }}
        title="Registrar Recebimento"
      >
        {contaSelecionada && (
          <form onSubmit={registrarRecebimento} className="space-y-5">
            {/* Resumo da conta */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Origem</span>
                <span className="font-medium">{contaSelecionada.origem_descricao}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Parceiro / Partes</span>
                <span className="font-medium text-right max-w-[60%]">{contaSelecionada.parceiro_nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Programa</span>
                <span className="font-medium">{contaSelecionada.programa_nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Parcela</span>
                <span className="font-medium">{contaSelecionada.numero_parcela}/{contaSelecionada.total_parcelas}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-500">Valor da Parcela</span>
                <span className="font-bold text-slate-900">{formatCurrency(contaSelecionada.valor_parcela)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vencimento</span>
                <span className={`font-medium ${contaSelecionada.status_pagamento === 'atrasado' ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatDate(contaSelecionada.data_vencimento)}
                  {contaSelecionada.status_pagamento === 'atrasado' && ' (vencido)'}
                </span>
              </div>
            </div>

            {/* Tipo de pagamento */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Pagamento</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo_pagamento"
                    value="total"
                    checked={recebimentoForm.tipo_pagamento === 'total'}
                    onChange={() => setRecebimentoForm({
                      ...recebimentoForm,
                      tipo_pagamento: 'total',
                      valor_pago: contaSelecionada.valor_parcela
                    })}
                    className="accent-green-600"
                  />
                  <span className="text-sm text-slate-700">Pagamento total</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo_pagamento"
                    value="parcial"
                    checked={recebimentoForm.tipo_pagamento === 'parcial'}
                    onChange={() => setRecebimentoForm({
                      ...recebimentoForm,
                      tipo_pagamento: 'parcial',
                      valor_pago: 0
                    })}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">Pagamento parcial</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data do Recebimento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={recebimentoForm.data_pagamento}
                onChange={(e) => setRecebimentoForm({ ...recebimentoForm, data_pagamento: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valor Recebido <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500 text-sm">R$</span>
                <input
                  type="text"
                  value={recebimentoForm.valor_pago ? formatCurrency(recebimentoForm.valor_pago).replace('R$', '').trim() : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setRecebimentoForm({ ...recebimentoForm, valor_pago: Number(val) / 100 });
                  }}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {recebimentoForm.tipo_pagamento === 'parcial' && recebimentoForm.valor_pago > 0 && recebimentoForm.valor_pago < contaSelecionada.valor_parcela && (
                <p className="text-xs text-blue-600 mt-1">
                  Saldo restante: {formatCurrency(contaSelecionada.valor_parcela - recebimentoForm.valor_pago)}
                </p>
              )}
              {recebimentoForm.tipo_pagamento === 'total' && recebimentoForm.valor_pago !== contaSelecionada.valor_parcela && (
                <p className="text-xs text-amber-600 mt-1">
                  Valor diferente do esperado ({formatCurrency(contaSelecionada.valor_parcela)})
                </p>
              )}
            </div>

            {/* Nova data de vencimento — só aparece no pagamento parcial */}
            {recebimentoForm.tipo_pagamento === 'parcial' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nova data de vencimento (saldo restante) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={recebimentoForm.nova_data_vencimento}
                  onChange={(e) => setRecebimentoForm({ ...recebimentoForm, nova_data_vencimento: e.target.value })}
                  required={recebimentoForm.tipo_pagamento === 'parcial'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
              <textarea
                value={recebimentoForm.observacao}
                onChange={(e) => setRecebimentoForm({ ...recebimentoForm, observacao: e.target.value })}
                rows={2}
                placeholder="Observações sobre o recebimento (opcional)..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button
                type="button"
                onClick={() => { setShowRecebimentoModal(false); setContaSelecionada(null); }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {salvando ? 'Salvando...' : recebimentoForm.tipo_pagamento === 'parcial' ? 'Confirmar Pagamento Parcial' : 'Confirmar Recebimento'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
        onConfirm={dialogConfig.onConfirm ? () => {
          dialogConfig.onConfirm!();
          setDialogConfig({ ...dialogConfig, isOpen: false });
        } : undefined}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
      />
    </div>
  );
}
