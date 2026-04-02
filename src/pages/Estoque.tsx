import { useState, useEffect } from 'react';
import { Package, TrendingUp, TrendingDown, History, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/formatters';
import { FilterBar } from '../components/FilterCombobox';

interface EstoqueItem {
  parceiro_id: string;
  parceiro_nome: string;
  programa_id: string;
  programa_nome: string;
  estoque_atual: number;
  venda_consignada: number;
  saldo_final: number;
  cpfs_disponiveis: number;
  emissao_ideal: number;
  custo_medio: number;
}

interface Movimentacao {
  id: string;
  data: string;
  tipo: string;
  parceiro_nome: string;
  programa_nome: string;
  quantidade: number;
  valor_total?: number;
  origem?: string;
  observacao?: string;
  localizador?: string;
}

export default function Estoque() {
  const [estoques, setEstoques] = useState<EstoqueItem[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'estoque' | 'historico'>('estoque');

  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroPrograma, setFiltroPrograma] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    fetchData();

    const handleVisibilityChange = () => {
      if (!document.hidden) fetchData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(() => {
      if (!document.hidden) fetchData();
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchEstoques(), fetchMovimentacoes()]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstoques = async () => {
    const [
      { data: estoquesCPFsView },
      { data: programasClubesData },
      { data: estoquePontosData, error: estoquePontosError },
      { data: comprasAtivas },
    ] = await Promise.all([
      supabase.from('estoque_cpfs_disponiveis').select('*'),
      supabase.from('programas_clubes').select('parceiro_id, programa_id, liminar'),
      supabase.from('estoque_pontos').select(`
        parceiro_id,
        programa_id,
        saldo_atual,
        custo_medio,
        parceiros!estoque_pontos_parceiro_id_fkey (nome_parceiro),
        programas_fidelidade!estoque_pontos_programa_id_fkey (nome)
      `),
      supabase.from('compras').select('parceiro_id, programa_id, saldo_atual, valor_milheiro').eq('status', 'Concluído').gt('saldo_atual', 0).neq('observacao', 'Compra no Carrinho'),
    ]);

    if (estoquePontosError) throw estoquePontosError;

    // Calcular custo médio dinâmico (média ponderada) por (parceiro, programa) a partir dos lotes ativos
    const custoMedioDinamico: Record<string, { totalPts: number; totalValor: number }> = {};
    for (const c of (comprasAtivas || []) as any[]) {
      const key = `${c.parceiro_id}_${c.programa_id}`;
      if (!custoMedioDinamico[key]) custoMedioDinamico[key] = { totalPts: 0, totalValor: 0 };
      const pts = Number(c.saldo_atual || 0);
      custoMedioDinamico[key].totalPts += pts;
      custoMedioDinamico[key].totalValor += pts * Number(c.valor_milheiro || 0);
    }

    const estoquesComCPFs = (estoquePontosData || []).map((estoque: any) => {
      const cpfsInfo = estoquesCPFsView?.find(
        (item: any) => item.parceiro_id === estoque.parceiro_id && item.programa_id === estoque.programa_id
      );
      const clubeInfo = programasClubesData?.find(
        (item: any) => item.parceiro_id === estoque.parceiro_id && item.programa_id === estoque.programa_id
      );
      const temLiminar = clubeInfo?.liminar === true;
      const saldoAtual = Number(estoque.saldo_atual || 0);
      const key = `${estoque.parceiro_id}_${estoque.programa_id}`;
      const din = custoMedioDinamico[key];
      const custoMedio = din && din.totalPts > 0
        ? din.totalValor / din.totalPts
        : Number(estoque.custo_medio || 0);
      const cpfsDisponiveis = temLiminar ? 999999 : (cpfsInfo?.cpfs_disponiveis ?? 0);
      const vendaConsignada = 0;
      const saldoFinal = saldoAtual - vendaConsignada;
      const emissaoIdeal = cpfsDisponiveis > 0 ? saldoFinal / cpfsDisponiveis : 0;

      return {
        parceiro_id: estoque.parceiro_id,
        parceiro_nome: estoque.parceiros?.nome_parceiro || 'N/A',
        programa_id: estoque.programa_id,
        programa_nome: estoque.programas_fidelidade?.nome || 'N/A',
        estoque_atual: saldoAtual,
        venda_consignada: vendaConsignada,
        saldo_final: saldoFinal,
        cpfs_disponiveis: cpfsDisponiveis,
        emissao_ideal: emissaoIdeal,
        custo_medio: custoMedio,
      };
    });

    estoquesComCPFs.sort((a, b) => b.estoque_atual - a.estoque_atual);
    setEstoques(estoquesComCPFs);
  };

  const fetchMovimentacoes = async () => {
    const { data: movimentacoesData, error } = await supabase
      .from('estoque_movimentacoes')
      .select(`
        id,
        created_at,
        data_operacao,
        tipo,
        quantidade,
        valor_total,
        origem,
        observacao,
        referencia_id,
        referencia_tabela,
        parceiros!estoque_movimentacoes_parceiro_id_fkey (nome_parceiro),
        programas_fidelidade!estoque_movimentacoes_programa_id_fkey (nome)
      `)
      .order('data_operacao', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Erro ao buscar movimentações:', error);
      setMovimentacoes([]);
      return;
    }

    const vendaIds = (movimentacoesData || [])
      .filter((m: any) => m.referencia_tabela === 'vendas' && m.referencia_id)
      .map((m: any) => m.referencia_id);

    const localizadorMap: Record<string, string> = {};
    if (vendaIds.length > 0) {
      const { data: localizadores } = await supabase
        .from('localizadores')
        .select('venda_id, codigo_localizador')
        .in('venda_id', vendaIds);

      (localizadores || []).forEach((l: any) => {
        localizadorMap[l.venda_id] = l.codigo_localizador;
      });
    }

    const tipoMap: Record<string, string> = {
      entrada: 'Entrada',
      saida: 'Saída',
      transferencia_entrada: 'Transferência - Entrada',
      transferencia_saida: 'Transferência - Saída',
      transferencia_pessoas_entrada: 'Transfer. Pessoas - Entrada',
      transferencia_pessoas_saida: 'Transfer. Pessoas - Saída',
    };

    const movimentacoesArray: Movimentacao[] = (movimentacoesData || []).map((mov: any) => {
      const tipoFormatado = tipoMap[mov.tipo] || mov.tipo;
      const localizador = mov.referencia_tabela === 'vendas' && mov.referencia_id
        ? localizadorMap[mov.referencia_id]
        : undefined;

      return {
        id: mov.id,
        data: mov.data_operacao || mov.created_at,
        tipo: tipoFormatado,
        parceiro_nome: mov.parceiros?.nome_parceiro || 'N/A',
        programa_nome: mov.programas_fidelidade?.nome || 'N/A',
        quantidade: Math.abs(Number(mov.quantidade)),
        valor_total: mov.valor_total ? Number(mov.valor_total) : undefined,
        origem: mov.origem,
        observacao: mov.observacao,
        localizador,
      };
    });

    setMovimentacoes(movimentacoesArray);
  };

  const parceirosUnicos = Array.from(new Set(
    (activeTab === 'estoque' ? estoques : movimentacoes).map(i => i.parceiro_nome)
  )).sort();

  const programasUnicos = Array.from(new Set(
    (activeTab === 'estoque' ? estoques : movimentacoes).map(i => i.programa_nome)
  )).sort();

  const tiposUnicos = Array.from(new Set(movimentacoes.map(m => m.tipo))).sort();

  const estoquesFiltrados = estoques.filter(item =>
    (!filtroParceiro || item.parceiro_nome === filtroParceiro) &&
    (!filtroPrograma || item.programa_nome === filtroPrograma)
  );

  const movimentacoesFiltradas = movimentacoes.filter(item =>
    (!filtroParceiro || item.parceiro_nome === filtroParceiro) &&
    (!filtroPrograma || item.programa_nome === filtroPrograma) &&
    (!filtroTipo || item.tipo === filtroTipo)
  );

  const totalEstoque = estoques.reduce((sum, item) => sum + item.estoque_atual, 0);
  const totalSaldoFinal = estoques.reduce((sum, item) => sum + item.saldo_final, 0);
  const totalCPFs = estoques.reduce((sum, item) => sum + item.cpfs_disponiveis, 0);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard de Estoque</h1>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Estoque Total</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalEstoque.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Saldo Final</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalSaldoFinal.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">CPFs Disponíveis</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalCPFs}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Parceiros Ativos</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{estoques.length}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <History className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('estoque')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'estoque' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Estoque
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'historico' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Histórico de Movimentações
            </button>
          </div>
        </div>

        <div className="p-4">
          <FilterBar
            filters={[
              { label: 'Parceiro', options: parceirosUnicos, value: filtroParceiro, onChange: setFiltroParceiro },
              { label: 'Programa', options: programasUnicos, value: filtroPrograma, onChange: setFiltroPrograma },
              ...(activeTab === 'historico' ? [{ label: 'Tipo', options: tiposUnicos, value: filtroTipo, onChange: setFiltroTipo }] : []),
            ]}
            onClear={() => { setFiltroParceiro(''); setFiltroPrograma(''); setFiltroTipo(''); }}
          />
        </div>

        {activeTab === 'estoque' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Parceiro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Programa</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Estoque Atual</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Venda Consignada</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Saldo Final</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">CPFs Disponíveis</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Emissão Ideal</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Custo Médio (mil)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {estoquesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum estoque encontrado</td>
                  </tr>
                ) : (
                  estoquesFiltrados.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.parceiro_nome}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.programa_nome}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-900 font-medium">{item.estoque_atual.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-600">{item.venda_consignada.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-green-600">{item.saldo_final.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-900">{item.cpfs_disponiveis}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                        {item.emissao_ideal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-600">{formatCurrency(item.custo_medio)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Parceiro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Programa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Origem/Destino</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Quantidade</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Valor Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Vlr Milheiro</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {movimentacoesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhuma movimentação encontrada</td>
                  </tr>
                ) : (
                  movimentacoesFiltradas.map((mov) => {
                    const isEntrada = mov.tipo === 'Entrada' || mov.tipo === 'Crédito Clube' || mov.tipo === 'Crédito' || mov.tipo.includes('Entrada');
                    const isSaida = mov.tipo === 'Saída' || mov.tipo.includes('Saída');
                    const isVenda = isSaida && mov.localizador;
                    const isCarrinho = mov.tipo === 'Entrada' && mov.observacao === 'Compra no Carrinho';
                    const tipoLabel = isCarrinho ? 'Entrada - Compra Carrinho' : mov.tipo;

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                          {(() => {
                            const d = mov.data;
                            // data_operacao vem como "YYYY-MM-DD" (date) ou timestamptz
                            const dateStr = typeof d === 'string' && d.length >= 10 ? d.substring(0, 10) : d;
                            const [y, m, day] = dateStr.split('-');
                            return `${day}/${m}/${y}`;
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isCarrinho ? 'bg-orange-100 text-orange-700'
                            : isEntrada ? 'bg-green-100 text-green-700'
                            : isSaida ? 'bg-red-100 text-red-700'
                            : mov.tipo.includes('Transferência') || mov.tipo.includes('Transfer.')
                            ? 'bg-blue-100 text-blue-700'
                            : mov.tipo === 'Lembrete' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-700'
                          }`}>
                            {tipoLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">{mov.parceiro_nome}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{mov.programa_nome}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {isVenda ? (
                            <div className="flex items-center gap-2">
                              <span>{mov.observacao || '-'}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                {mov.localizador}
                              </span>
                            </div>
                          ) : (
                            mov.observacao || '-'
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-slate-900">
                          {isEntrada ? '+' : isSaida ? '-' : ''}
                          {mov.quantidade.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-900">
                          {mov.valor_total ? formatCurrency(mov.valor_total) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-900">
                          {mov.valor_total && mov.quantidade > 0
                            ? formatCurrency((mov.valor_total / mov.quantidade) * 1000)
                            : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
