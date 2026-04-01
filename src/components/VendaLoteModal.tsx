import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, CheckSquare, Square, ShoppingCart, ArrowLeftRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatNumberDisplay } from '../lib/formatters';
import ParceiroSearch from './ParceiroSearch';
import Modal from './Modal';

interface Parceiro {
  id: string;
  nome_parceiro: string;
}

interface CompraLote {
  id: string;
  data_entrada: string;
  pontos_milhas: number;
  bonus: number;
  total_pontos: number;
  valor_total: number;
  valor_milheiro: number;
  status: string;
  tipo: string;
  programas_fidelidade: { id: string; nome: string } | null;
  parceiros: { nome_parceiro: string } | null;
  saldo_atual?: number;
  saldo_disponivel?: number;
  origem?: 'compra' | 'transferencia';
  transferencia_origem?: string;
}

interface Cliente {
  id: string;
  nome_cliente: string;
}

interface Cartao {
  id: string;
  cartao: string;
}

interface Usuario {
  id: string;
  nome: string;
}

interface Programa {
  id: string;
  nome: string;
}

interface VendaLoteFormData {
  parceiro_id: string;
  cliente_id: string;
  cartao_id: string;
  data_venda: string;
  ordem_compra: string;
  programa_id: string;
  cia_parceira: string;
  quantidade_milhas: number;
  valor_milheiro: number;
  valor_total: number;
  taxa_embarque: number;
  taxa_resgate: number;
  taxa_bagagem: number;
  cartao_taxa_embarque_id: string;
  cartao_taxa_embarque_tipo: 'debito' | 'credito' | '';
  cartao_taxa_embarque_parcelas: number;
  cartao_taxa_bagagem_id: string;
  cartao_taxa_bagagem_tipo: 'debito' | 'credito' | '';
  cartao_taxa_bagagem_parcelas: number;
  cartao_taxa_resgate_id: string;
  cartao_taxa_resgate_tipo: 'debito' | 'credito' | '';
  cartao_taxa_resgate_parcelas: number;
  data_voo_ida: string;
  data_voo_volta: string;
  nome_passageiro: string;
  quantidade_passageiros: number;
  trecho: string;
  tarifa_diamante: number;
  milhas_bonus: number;
  custo_emissao: number;
  emissor: string;
  observacao: string;
  localizador: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parceiros: Parceiro[];
  clientes: Cliente[];
  cartoes: Cartao[];
  usuarios: Usuario[];
}

export default function VendaLoteModal({ isOpen, onClose, onSuccess, parceiros, clientes, cartoes, usuarios }: Props) {
  const { usuario } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [parceiroId, setParceiroId] = useState('');
  const [programaFiltroId, setProgramaFiltroId] = useState('');
  const [programasDisponiveis, setProgramasDisponiveis] = useState<Programa[]>([]);
  const [saldoPorPrograma, setSaldoPorPrograma] = useState<Record<string, number>>({});
  const [compras, setCompras] = useState<CompraLote[]>([]);
  const [selectedCompras, setSelectedCompras] = useState<Set<string>>(new Set());
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saldoAtual, setSaldoAtual] = useState(0);
  const [custoMedio, setCustoMedio] = useState(0);
  const [lucroReal, setLucroReal] = useState(0);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [lotesParaVender, setLotesParaVender] = useState<CompraLote[]>([]);

  const [rawValorMilheiro, setRawValorMilheiro] = useState('');
  const [rawTaxaEmbarque, setRawTaxaEmbarque] = useState('');
  const [rawTaxaResgate, setRawTaxaResgate] = useState('');
  const [rawTaxaBagagem, setRawTaxaBagagem] = useState('');
  const [rawCustoEmissao, setRawCustoEmissao] = useState('');

  const [formData, setFormData] = useState<VendaLoteFormData>({
    parceiro_id: '',
    cliente_id: '',
    cartao_id: '',
    data_venda: new Date().toISOString().split('T')[0],
    ordem_compra: '',
    programa_id: '',
    cia_parceira: '',
    quantidade_milhas: 0,
    valor_milheiro: 0,
    valor_total: 0,
    taxa_embarque: 0,
    taxa_resgate: 0,
    taxa_bagagem: 0,
    cartao_taxa_embarque_id: '',
    cartao_taxa_embarque_tipo: '',
    cartao_taxa_embarque_parcelas: 1,
    cartao_taxa_bagagem_id: '',
    cartao_taxa_bagagem_tipo: '',
    cartao_taxa_bagagem_parcelas: 1,
    cartao_taxa_resgate_id: '',
    cartao_taxa_resgate_tipo: '',
    cartao_taxa_resgate_parcelas: 1,
    data_voo_ida: '',
    data_voo_volta: '',
    nome_passageiro: '',
    quantidade_passageiros: 1,
    trecho: '',
    tarifa_diamante: 0,
    milhas_bonus: 0,
    custo_emissao: 0,
    emissor: usuario?.nome || '',
    observacao: '',
    localizador: '',
  });

  useEffect(() => {
    if (!isOpen) {
      resetAll();
    }
  }, [isOpen]);

  useEffect(() => {
    if (parceiroId) {
      fetchProgramasDisponiveis(parceiroId);
      fetchComprasDoParceiro(parceiroId);
    } else {
      setCompras([]);
      setSelectedCompras(new Set());
      setProgramasDisponiveis([]);
      setProgramaFiltroId('');
    }
  }, [parceiroId]);

  useEffect(() => {
    setSelectedCompras(new Set());
  }, [programaFiltroId, parceiroId]);

  useEffect(() => {
    if (formData.parceiro_id && formData.programa_id) {
      carregarSaldoECusto();
    }
  }, [formData.parceiro_id, formData.programa_id]);

  useEffect(() => {
    if (formData.quantidade_milhas > 0 && formData.valor_milheiro > 0) {
      const valorTotal = (formData.valor_milheiro * formData.quantidade_milhas) / 1000;
      setFormData(prev => ({ ...prev, valor_total: Number(valorTotal.toFixed(2)) }));
    }
  }, [formData.quantidade_milhas, formData.valor_milheiro]);

  useEffect(() => {
    const custo = (0.1 * formData.quantidade_milhas) / 1000;
    const custoFormatado = Number(custo.toFixed(2));
    setFormData(prev => ({ ...prev, custo_emissao: custoFormatado }));
    setRawCustoEmissao(custoFormatado > 0 ? formatNumberDisplay(custoFormatado) : '');
  }, [formData.quantidade_milhas]);

  const valorMilheiroLotes = useMemo(() => {
    if (lotesParaVender.length === 0) return 0;
    const qty = formData.quantidade_milhas;
    const lotesOrdenados = [...lotesParaVender].sort(
      (a, b) => new Date(a.data_entrada).getTime() - new Date(b.data_entrada).getTime()
    );
    let restante = qty > 0 ? qty : Infinity;
    let totalPts = 0;
    let totalValor = 0;
    for (const lote of lotesOrdenados) {
      if (restante <= 0) break;
      const disponivel = lote.saldo_disponivel ?? lote.total_pontos ?? lote.pontos_milhas;
      const consumir = Math.min(restante, disponivel);
      totalPts += consumir;
      totalValor += consumir * (lote.valor_milheiro || 0);
      restante -= consumir;
    }
    return totalPts > 0 ? totalValor / totalPts : 0;
  }, [formData.quantidade_milhas, lotesParaVender]);

  useEffect(() => {
    if (formData.quantidade_milhas > 0 && formData.valor_milheiro > 0) {
      const custoArredondado = Math.round(valorMilheiroLotes * 100) / 100;
      const lucro = (formData.valor_milheiro - custoArredondado) * formData.quantidade_milhas / 1000;
      setLucroReal(Number(lucro.toFixed(2)));
    } else {
      setLucroReal(0);
    }
  }, [formData.valor_milheiro, formData.quantidade_milhas, valorMilheiroLotes]);

  const resetAll = () => {
    setStep(1);
    setParceiroId('');
    setProgramaFiltroId('');
    setProgramasDisponiveis([]);
    setSaldoPorPrograma({});
    setCompras([]);
    setSelectedCompras(new Set());
    setError('');
    setSaldoAtual(0);
    setCustoMedio(0);
    setLucroReal(0);
    setRawValorMilheiro('');
    setRawTaxaEmbarque('');
    setRawTaxaResgate('');
    setRawTaxaBagagem('');
    setRawCustoEmissao('');
    setFormData({
      parceiro_id: '',
      cliente_id: '',
      cartao_id: '',
      data_venda: new Date().toISOString().split('T')[0],
      ordem_compra: '',
      programa_id: '',
      cia_parceira: '',
      quantidade_milhas: 0,
      valor_milheiro: 0,
      valor_total: 0,
      taxa_embarque: 0,
      taxa_resgate: 0,
      taxa_bagagem: 0,
      cartao_taxa_embarque_id: '',
      cartao_taxa_embarque_tipo: '',
      cartao_taxa_embarque_parcelas: 1,
      cartao_taxa_bagagem_id: '',
      cartao_taxa_bagagem_tipo: '',
      cartao_taxa_bagagem_parcelas: 1,
      cartao_taxa_resgate_id: '',
      cartao_taxa_resgate_tipo: '',
      cartao_taxa_resgate_parcelas: 1,
      data_voo_ida: '',
      data_voo_volta: '',
      nome_passageiro: '',
      quantidade_passageiros: 1,
      trecho: '',
      tarifa_diamante: 0,
      milhas_bonus: 0,
      custo_emissao: 0,
      emissor: usuario?.nome || '',
      observacao: '',
      localizador: '',
    });
  };

  const fetchProgramasDisponiveis = async (id: string) => {
    const { data } = await supabase
      .from('estoque_pontos')
      .select('programa_id, saldo_atual, programas_fidelidade(id, nome)')
      .eq('parceiro_id', id)
      .gt('saldo_atual', 0);

    if (data) {
      const unicos: Programa[] = [];
      const vistos = new Set<string>();
      const saldoMap: Record<string, number> = {};
      for (const item of data as any[]) {
        const p = item.programas_fidelidade;
        if (p && !vistos.has(p.id)) {
          vistos.add(p.id);
          unicos.push({ id: p.id, nome: p.nome });
        }
        if (p) {
          saldoMap[p.id] = (saldoMap[p.id] || 0) + Number(item.saldo_atual);
        }
      }
      setProgramasDisponiveis(unicos);
      setSaldoPorPrograma(saldoMap);
      if (unicos.length === 1) {
        setProgramaFiltroId(unicos[0].id);
      }
    }
  };

  const fetchComprasDoParceiro = async (id: string) => {
    setLoadingCompras(true);
    try {
      const [comprasRes, transferenciasRes, transferPessoasRes, estoqueRes] = await Promise.all([
        supabase
          .from('compras')
          .select('id, data_entrada, pontos_milhas, bonus, total_pontos, saldo_atual, valor_total, valor_milheiro, status, tipo, programas_fidelidade(id, nome), parceiros(nome_parceiro)')
          .eq('parceiro_id', id)
          .eq('status', 'Concluído')
          .order('data_entrada', { ascending: true }),
        supabase
          .from('transferencia_pontos')
          .select('id, data_transferencia, destino_quantidade, destino_quantidade_bonus, status, programas_fidelidade!destino_programa_id(id, nome), parceiro_origem:parceiros!parceiro_id(nome_parceiro), origem_programa:programas_fidelidade!origem_programa_id(nome)')
          .eq('parceiro_id', id)
          .eq('status', 'Concluído')
          .order('data_transferencia', { ascending: true }),
        supabase
          .from('transferencia_pessoas')
          .select('id, data_transferencia, quantidade, bonus_destino, status, programas_fidelidade!transferencia_pessoas_destino_programa_id_fkey(id, nome), origem_parceiro:parceiros!transferencia_pessoas_origem_parceiro_id_fkey(nome_parceiro)')
          .eq('destino_parceiro_id', id)
          .eq('status', 'Concluído')
          .order('data_transferencia', { ascending: true }),
        supabase
          .from('estoque_pontos')
          .select('programa_id, saldo_atual')
          .eq('parceiro_id', id),
      ]);

      const saldoEstoqueMap: Record<string, number> = {};
      for (const ep of (estoqueRes.data || []) as any[]) {
        saldoEstoqueMap[ep.programa_id] = Number(ep.saldo_atual) || 0;
      }

      const comprasMapped: CompraLote[] = (comprasRes.data || [])
        .map((c: any) => ({
          ...c,
          origem: 'compra' as const,
          saldo_disponivel: Number(c.saldo_atual) || 0,
        }))
        .filter((c: CompraLote) => (c.saldo_disponivel ?? 0) > 0);

      const saldoConsumidoPorPrograma: Record<string, number> = {};
      for (const c of comprasMapped) {
        const pid = c.programas_fidelidade?.id;
        if (!pid) continue;
        saldoConsumidoPorPrograma[pid] = (saldoConsumidoPorPrograma[pid] || 0) + (c.saldo_disponivel ?? 0);
      }

      const saldoRestanteParaTransferencias: Record<string, number> = {};
      for (const pid of Object.keys(saldoEstoqueMap)) {
        saldoRestanteParaTransferencias[pid] = Math.max(0, saldoEstoqueMap[pid] - (saldoConsumidoPorPrograma[pid] || 0));
      }

      // Buscar custo por milheiro das transferências de pontos via estoque_movimentacoes
      const transferPontosIds = (transferenciasRes.data || []).map((t: any) => t.id);
      const custoMapPontos: Record<string, number> = {};
      if (transferPontosIds.length > 0) {
        const { data: movsPontos } = await supabase
          .from('estoque_movimentacoes')
          .select('referencia_id, valor_total, quantidade')
          .in('referencia_id', transferPontosIds)
          .eq('referencia_tabela', 'transferencia_pontos')
          .in('tipo', ['transferencia_entrada', 'transferencia_bonus', 'bumerangue_retorno'])
          .eq('parceiro_id', id);
        const totaisMapPontos: Record<string, { totalQtd: number; totalValor: number }> = {};
        for (const mov of (movsPontos || []) as any[]) {
          const qtd = Number(mov.quantidade) || 0;
          const val = Number(mov.valor_total) || 0;
          if (qtd > 0) {
            if (!totaisMapPontos[mov.referencia_id]) totaisMapPontos[mov.referencia_id] = { totalQtd: 0, totalValor: 0 };
            totaisMapPontos[mov.referencia_id].totalQtd += qtd;
            totaisMapPontos[mov.referencia_id].totalValor += val;
          }
        }
        for (const [refId, totais] of Object.entries(totaisMapPontos)) {
          if (totais.totalQtd > 0) custoMapPontos[refId] = (totais.totalValor / totais.totalQtd) * 1000;
        }
      }

      const transferenciasMapped: CompraLote[] = (transferenciasRes.data || []).map((t: any) => {
        const totalRecebido = (Number(t.destino_quantidade) || 0) + (Number(t.destino_quantidade_bonus) || 0);
        const origemNome = (t.origem_programa as any)?.nome || 'outro programa';
        return {
          id: t.id,
          data_entrada: t.data_transferencia,
          pontos_milhas: Number(t.destino_quantidade) || 0,
          bonus: Number(t.destino_quantidade_bonus) || 0,
          total_pontos: totalRecebido,
          valor_total: 0,
          valor_milheiro: custoMapPontos[t.id] || 0,
          status: t.status,
          tipo: 'Transferência de Pontos',
          programas_fidelidade: t.programas_fidelidade as { id: string; nome: string } | null,
          parceiros: t.parceiro_origem as { nome_parceiro: string } | null,
          origem: 'transferencia' as const,
          transferencia_origem: origemNome,
        };
      });

      // Buscar custo por milheiro das transferências entre pessoas via estoque_movimentacoes
      const transferPessoasIds = (transferPessoasRes.data || []).map((t: any) => t.id);
      const custoMapPessoas: Record<string, number> = {};
      if (transferPessoasIds.length > 0) {
        const { data: movs } = await supabase
          .from('estoque_movimentacoes')
          .select('referencia_id, valor_total, quantidade')
          .in('referencia_id', transferPessoasIds)
          .eq('referencia_tabela', 'transferencia_pessoas')
          .eq('tipo', 'Entrada')
          .eq('parceiro_id', id);
        const totaisMap: Record<string, { totalQtd: number; totalValor: number }> = {};
        for (const mov of (movs || []) as any[]) {
          const qtd = Number(mov.quantidade) || 0;
          const val = Number(mov.valor_total) || 0;
          if (qtd > 0) {
            if (!totaisMap[mov.referencia_id]) {
              totaisMap[mov.referencia_id] = { totalQtd: 0, totalValor: 0 };
            }
            totaisMap[mov.referencia_id].totalQtd += qtd;
            totaisMap[mov.referencia_id].totalValor += val;
          }
        }
        for (const [refId, totais] of Object.entries(totaisMap)) {
          if (totais.totalQtd > 0) {
            custoMapPessoas[refId] = (totais.totalValor / totais.totalQtd) * 1000;
          }
        }
      }

      const transferPessoasMapped: CompraLote[] = (transferPessoasRes.data || []).map((t: any) => {
        const quantidade = Number(t.quantidade) || 0;
        const bonusDestino = Number(t.bonus_destino) || 0;
        const totalRecebido = quantidade + bonusDestino;
        const origemNome = t.origem_parceiro?.nome_parceiro || 'outro parceiro';
        const custoMilheiro = custoMapPessoas[t.id] || 0;
        return {
          id: t.id,
          data_entrada: t.data_transferencia,
          pontos_milhas: quantidade,
          bonus: bonusDestino,
          total_pontos: totalRecebido,
          valor_total: 0,
          valor_milheiro: custoMilheiro,
          status: t.status,
          tipo: 'Transferência entre Pessoas',
          programas_fidelidade: t.programas_fidelidade as { id: string; nome: string } | null,
          parceiros: null,
          origem: 'transferencia' as const,
          transferencia_origem: origemNome + ' (pessoa)',
        };
      });

      const transferenciasOrdenadas = [...transferenciasMapped, ...transferPessoasMapped].sort(
        (a, b) => new Date(a.data_entrada).getTime() - new Date(b.data_entrada).getTime()
      );

      const lotesTransferencias: CompraLote[] = [];
      for (const lote of transferenciasOrdenadas) {
        const programaId = lote.programas_fidelidade?.id;
        if (!programaId) continue;
        const pontosLote = lote.total_pontos || lote.pontos_milhas || 0;
        const saldoDisp = saldoRestanteParaTransferencias[programaId] ?? 0;
        if (saldoDisp <= 0) continue;
        const saldoLote = Math.min(pontosLote, saldoDisp);
        saldoRestanteParaTransferencias[programaId] = saldoDisp - saldoLote;
        lotesTransferencias.push({ ...lote, saldo_disponivel: saldoLote });
      }

      const todosLotes = [...comprasMapped, ...lotesTransferencias].sort(
        (a, b) => new Date(b.data_entrada).getTime() - new Date(a.data_entrada).getTime()
      );

      setCompras(todosLotes);
    } catch (err) {
      console.error('Erro ao carregar compras:', err);
    } finally {
      setLoadingCompras(false);
    }
  };

  const carregarProgramasDoParceiro = async (id: string) => {
    const { data } = await supabase
      .from('programas_clubes')
      .select('programa_id, programas_fidelidade(id, nome)')
      .eq('parceiro_id', id);

    if (data) {
      const unicos = data
        .filter((item: any) => item.programas_fidelidade)
        .map((item: any) => ({ id: item.programas_fidelidade.id, nome: item.programas_fidelidade.nome }))
        .filter((p: Programa, i: number, self: Programa[]) => i === self.findIndex(x => x.id === p.id));
      setProgramas(unicos);
    }
  };

  const carregarSaldoECusto = async () => {
    const { data } = await supabase
      .from('estoque_pontos')
      .select('saldo_atual, custo_medio')
      .eq('parceiro_id', formData.parceiro_id)
      .eq('programa_id', formData.programa_id)
      .maybeSingle();

    if (data) {
      setSaldoAtual(Number(data.saldo_atual || 0));
      setCustoMedio(Number(data.custo_medio || 0));
    } else {
      setSaldoAtual(0);
      setCustoMedio(0);
    }
  };

  const toggleCompra = (id: string) => {
    setSelectedCompras(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const filtered = programaFiltroId
      ? compras.filter(c => c.programas_fidelidade?.id === programaFiltroId)
      : compras;
    const allSelected = filtered.every(c => selectedCompras.has(c.id)) && filtered.length > 0;
    if (allSelected) {
      setSelectedCompras(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedCompras(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const getTotaisSelecionados = () => {
    const selecionadas = compras.filter(c => selectedCompras.has(c.id));
    const totalPontos = selecionadas.reduce((acc, c) => acc + (c.saldo_disponivel ?? c.total_pontos ?? c.pontos_milhas), 0);
    const valorMilheiroMedio = totalPontos > 0
      ? selecionadas.reduce((acc, c) => {
          const pts = c.saldo_disponivel ?? c.total_pontos ?? c.pontos_milhas;
          return acc + (c.valor_milheiro || 0) * pts;
        }, 0) / totalPontos
      : 0;
    return { totalPontos, valorMilheiroMedio, count: selecionadas.length };
  };

  const handleAvancar = async () => {
    if (selectedCompras.size === 0) {
      setError('Selecione ao menos uma compra ou transferência.');
      return;
    }

    const selecionadas = compras.filter(c => selectedCompras.has(c.id));
    const programaId = selecionadas[0]?.programas_fidelidade?.id || programaFiltroId;

    const saldoRealPrograma = programaId ? (saldoPorPrograma[programaId] || 0) : 0;

    if (saldoRealPrograma <= 0) {
      setError('Saldo insuficiente neste programa para realizar a venda.');
      return;
    }

    await carregarProgramasDoParceiro(parceiroId);
    setLotesParaVender(selecionadas);

    setFormData(prev => ({
      ...prev,
      parceiro_id: parceiroId,
      programa_id: programaId,
      quantidade_milhas: totalPontos,
      valor_milheiro: 0,
    }));

    setRawValorMilheiro('');

    setError('');
    setStep(2);
  };

  const calcularValorTotalVendas = () => {
    return formData.valor_total + formData.taxa_embarque + formData.taxa_resgate + formData.taxa_bagagem;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (formData.localizador) {
        const { data: localizadorExiste } = await supabase
          .from('vendas')
          .select('id')
          .eq('localizador', formData.localizador)
          .maybeSingle();
        if (localizadorExiste) {
          throw new Error(`Já existe uma venda com o Localizador "${formData.localizador}".`);
        }
      }

      if (formData.ordem_compra) {
        const { data: ocExiste } = await supabase
          .from('vendas')
          .select('id')
          .eq('ordem_compra', formData.ordem_compra)
          .maybeSingle();
        if (ocExiste) {
          throw new Error(`Já existe uma venda com a Ordem de Compra "${formData.ordem_compra}".`);
        }
      }

      const { data: estoqueCheck } = await supabase
        .from('estoque_pontos')
        .select('id')
        .eq('parceiro_id', formData.parceiro_id)
        .eq('programa_id', formData.programa_id)
        .maybeSingle();

      if (!estoqueCheck) {
        throw new Error('Parceiro não possui estoque cadastrado neste programa.');
      }

      if (formData.quantidade_milhas > saldoAtual) {
        throw new Error(`Saldo insuficiente. Saldo disponível: ${saldoAtual.toLocaleString('pt-BR')}`);
      }

      if (formData.quantidade_milhas <= 0) throw new Error('Quantidade de milhas deve ser maior que zero.');
      if (formData.valor_milheiro <= 0) throw new Error('Valor do milheiro deve ser maior que zero.');

      const vendaData = {
        parceiro_id: formData.parceiro_id,
        cliente_id: formData.cliente_id || null,
        data_venda: formData.data_venda,
        ordem_compra: formData.ordem_compra || null,
        programa_id: formData.programa_id,
        cia_parceira: formData.cia_parceira || null,
        quantidade_milhas: formData.quantidade_milhas,
        valor_milheiro: formData.valor_milheiro,
        valor_total: formData.valor_total,
        taxa_embarque: formData.taxa_embarque,
        taxa_resgate: formData.taxa_resgate,
        taxa_bagagem: formData.taxa_bagagem,
        cartao_taxa_embarque_id: formData.cartao_taxa_embarque_id || null,
        cartao_taxa_bagagem_id: formData.cartao_taxa_bagagem_id || null,
        cartao_taxa_resgate_id: formData.cartao_taxa_resgate_id || null,
        data_voo_ida: formData.data_voo_ida || null,
        data_voo_volta: formData.data_voo_volta || null,
        nome_passageiro: formData.nome_passageiro || null,
        quantidade_passageiros: formData.quantidade_passageiros,
        trecho: formData.trecho || null,
        tarifa_diamante: formData.tarifa_diamante,
        milhas_bonus: formData.milhas_bonus,
        custo_emissao: formData.custo_emissao,
        emissor: formData.emissor || null,
        observacao: formData.observacao || null,
        custo_medio: custoMedio,
        lucro_real: lucroReal,
        status: 'concluida',
        created_by: usuario?.id,
      };

      const { data: vendaCriada, error: vendaError } = await supabase
        .from('vendas')
        .insert([vendaData])
        .select()
        .single();

      if (vendaError) throw vendaError;

      const vendaLotesInserts: any[] = [];

      // Lotes de compra: debitar saldo e registrar (FIFO)
      const lotesCompras = lotesParaVender
        .filter(l => l.origem === 'compra')
        .sort((a, b) => new Date(a.data_entrada).getTime() - new Date(b.data_entrada).getTime());
      if (lotesCompras.length > 0) {
        let pontosRestantes = formData.quantidade_milhas;
        for (const lote of lotesCompras) {
          if (pontosRestantes <= 0) break;
          const saldoAtualLote = Number(lote.saldo_atual ?? lote.saldo_disponivel ?? 0);
          const deduzir = Math.min(saldoAtualLote, pontosRestantes);
          const novoSaldo = saldoAtualLote - deduzir;
          pontosRestantes -= deduzir;
          await supabase.from('compras').update({ saldo_atual: novoSaldo }).eq('id', lote.id);
          vendaLotesInserts.push({
            venda_id: vendaCriada.id,
            compra_id: lote.id,
            referencia_id: lote.id,
            referencia_tipo: 'compra',
            tipo_origem: 'Compra de Pontos/Milhas',
            pontos_usados: deduzir,
            pontos_total_lote: saldoAtualLote,
            valor_milheiro: lote.valor_milheiro || 0,
            data_entrada: lote.data_entrada,
          });
        }
      }

      // Lotes de transferência: apenas registrar (sem debitar saldo aqui)
      const lotesTransferencias = lotesParaVender.filter(l => l.origem === 'transferencia');
      for (const lote of lotesTransferencias) {
        const pontos = lote.saldo_disponivel ?? lote.total_pontos ?? lote.pontos_milhas ?? 0;
        const totalLote = lote.total_pontos ?? lote.pontos_milhas ?? pontos;
        vendaLotesInserts.push({
          venda_id: vendaCriada.id,
          compra_id: null,
          referencia_id: lote.id,
          referencia_tipo: lote.tipo === 'Transferência de Pontos' ? 'transferencia_pontos' : 'transferencia_pessoas',
          tipo_origem: lote.transferencia_origem ? `Transferência de ${lote.transferencia_origem}` : lote.tipo,
          pontos_usados: pontos,
          pontos_total_lote: totalLote,
          valor_milheiro: lote.valor_milheiro || 0,
          data_entrada: lote.data_entrada,
        });
      }

      if (vendaLotesInserts.length > 0) {
        await supabase.from('venda_lotes').insert(vendaLotesInserts);
      }

      if (formData.localizador) {
        await supabase.from('localizadores').insert([{
          venda_id: vendaCriada.id,
          codigo_localizador: formData.localizador,
          status: 'emitido',
        }]);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar venda');
    } finally {
      setSaving(false);
    }
  };

  const { totalPontos, valorMilheiroMedio, count } = getTotaisSelecionados();
  const parceiroNome = parceiros.find(p => p.id === parceiroId)?.nome_parceiro || '';

  const comprasFiltradas = programaFiltroId
    ? compras.filter(c => c.programas_fidelidade?.id === programaFiltroId)
    : compras;

  const groupedByPrograma = comprasFiltradas.reduce((acc, c) => {
    const nome = c.programas_fidelidade?.nome || 'Sem Programa';
    if (!acc[nome]) acc[nome] = [];
    acc[nome].push(c);
    return acc;
  }, {} as Record<string, CompraLote[]>);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Venda por Lote">
      {step === 1 ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold">1</div>
            <div>
              <p className="text-sm font-medium text-blue-900">Selecionar Compras</p>
              <p className="text-xs text-blue-700">Escolha o parceiro e selecione as compras para vender</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parceiro <span className="text-red-500">*</span>
              </label>
              <ParceiroSearch
                parceiros={parceiros}
                value={parceiroId}
                onChange={(id) => {
                  setParceiroId(id);
                  setSelectedCompras(new Set());
                  setProgramaFiltroId('');
                }}
                placeholder="Digite para buscar parceiro..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Programa <span className="text-red-500">*</span>
              </label>
              <select
                value={programaFiltroId}
                onChange={(e) => setProgramaFiltroId(e.target.value)}
                disabled={!parceiroId || programasDisponiveis.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!parceiroId ? 'Selecione um parceiro primeiro' : programasDisponiveis.length === 0 ? 'Nenhum programa disponível' : 'Todos os programas'}
                </option>
                {programasDisponiveis.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — Saldo: {(saldoPorPrograma[p.id] || 0).toLocaleString('pt-BR')} pts
                  </option>
                ))}
              </select>
              {programaFiltroId && saldoPorPrograma[programaFiltroId] !== undefined && (() => {
                const saldo = saldoPorPrograma[programaFiltroId] || 0;
                const totalCompras = compras
                  .filter(c => c.programas_fidelidade?.id === programaFiltroId && c.origem === 'compra')
                  .reduce((acc, c) => acc + (c.total_pontos || c.pontos_milhas || 0), 0);
                const temDiferenca = totalCompras > saldo;
                return (
                  <div className="mt-1.5 space-y-1">
                    <p className={`text-xs font-medium rounded px-2 py-1 ${temDiferenca ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'}`}>
                      Saldo disponivel para venda: <span className="font-bold">{saldo.toLocaleString('pt-BR')} pontos</span>
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {parceiroId && (
            <div>
              {loadingCompras ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-sm text-gray-500">Carregando compras...</span>
                </div>
              ) : comprasFiltradas.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Nenhuma compra ou transferência encontrada para este parceiro</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Historico de <span className="text-blue-700">{parceiroNome}</span>
                      </span>
                      <span className="block text-xs text-gray-400">Selecione para confirmar a origem — o saldo vendido será o disponível no estoque</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {comprasFiltradas.length > 0 && comprasFiltradas.every(c => selectedCompras.has(c.id)) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      {comprasFiltradas.length > 0 && comprasFiltradas.every(c => selectedCompras.has(c.id)) ? 'Desmarcar tudo' : 'Selecionar tudo'}
                    </button>
                  </div>

                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                    {Object.entries(groupedByPrograma).map(([programa, items]) => (
                      <div key={programa}>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">{programa}</div>
                        <div className="rounded-lg border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="w-8 px-3 py-2"></th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Data</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tipo / Origem</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Pontos</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Vlr Milheiro</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Valor Residual</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {items.map(compra => (
                                <tr
                                  key={compra.id}
                                  onClick={() => toggleCompra(compra.id)}
                                  className={`cursor-pointer transition-colors ${
                                    selectedCompras.has(compra.id)
                                      ? compra.origem === 'transferencia' ? 'bg-amber-50' : 'bg-blue-50'
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <td className="px-3 py-2">
                                    {selectedCompras.has(compra.id) ? (
                                      <CheckSquare className={`w-4 h-4 ${compra.origem === 'transferencia' ? 'text-amber-600' : 'text-blue-600'}`} />
                                    ) : (
                                      <Square className="w-4 h-4 text-gray-400" />
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700">
                                    {new Date(compra.data_entrada + 'T00:00:00').toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="px-3 py-2">
                                    {compra.origem === 'transferencia' ? (
                                      <div className="flex items-center gap-1.5">
                                        <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                        <div>
                                          <span className="text-xs font-medium text-amber-700">Transferência</span>
                                          <span className="block text-xs text-gray-400">de {compra.transferencia_origem}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-600 text-xs">{compra.tipo}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                                    {(compra.saldo_disponivel ?? compra.total_pontos ?? compra.pontos_milhas).toLocaleString('pt-BR')}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {compra.origem === 'transferencia' && !compra.valor_milheiro ? (
                                      <span className="text-xs text-gray-400 italic">custo médio</span>
                                    ) : (
                                      formatCurrency(compra.valor_milheiro || 0)
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {compra.origem === 'transferencia' && !compra.valor_milheiro ? (
                                      <span className="text-xs text-gray-400 italic">-</span>
                                    ) : (
                                      formatCurrency(((compra.saldo_disponivel ?? compra.total_pontos ?? compra.pontos_milhas) * (compra.valor_milheiro || 0)) / 1000)
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>

                  {count > 0 && (() => {
                    const temTransferencia = compras.filter(c => selectedCompras.has(c.id)).some(c => c.origem === 'transferencia');
                    return (
                      <div className={`mt-3 p-3 border rounded-lg ${temTransferencia ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Lotes: </span>
                              <span className={`font-semibold ${temTransferencia ? 'text-amber-700' : 'text-blue-700'}`}>{count}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Total pontos: </span>
                              <span className={`font-semibold ${temTransferencia ? 'text-amber-700' : 'text-blue-700'}`}>{totalPontos.toLocaleString('pt-BR')}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Milheiro médio/estoque atual: </span>
                              <span className={`font-semibold ${temTransferencia ? 'text-amber-700' : 'text-blue-700'}`}>{valorMilheiroMedio > 0 ? formatCurrency(valorMilheiroMedio) : '—'}</span>
                            </div>
                          </div>
                          {temTransferencia && (
                            <div className="flex items-center gap-1 text-xs text-amber-700">
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              <span>Inclui transferencia — custo pelo custo medio</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAvancar}
              disabled={count === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Avançar
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-0">
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg mb-5">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold">2</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Finalizar Venda</p>
              <p className="text-xs text-green-700">
                {count} lote(s) &bull; {totalPontos.toLocaleString('pt-BR')} pontos &bull; {parceiroNome}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
          )}

          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Campos Obrigatórios</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.cliente_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, cliente_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_cliente}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Emissão <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.data_venda}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_venda: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ordem de Compra <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.ordem_compra}
                    onChange={(e) => setFormData(prev => ({ ...prev, ordem_compra: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="000.000.000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Localizador <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.localizador}
                    onChange={(e) => setFormData(prev => ({ ...prev, localizador: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ABC.123.XYZ"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Programa Fidelidade <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.programa_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, programa_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione</option>
                    {programas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cia Parceira <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.cia_parceira}
                    onChange={(e) => setFormData(prev => ({ ...prev, cia_parceira: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Qte Milhas <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.quantidade_milhas ? formData.quantidade_milhas.toLocaleString('pt-BR') : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData(prev => ({ ...prev, quantidade_milhas: Number(value) }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor Venda Milheiro <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      required
                      value={rawValorMilheiro}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9,]/g, '');
                        setRawValorMilheiro(val);
                        setFormData(prev => ({ ...prev, valor_milheiro: parseFloat(val.replace(',', '.')) || 0 }));
                      }}
                      onBlur={() => { if (formData.valor_milheiro) setRawValorMilheiro(formatNumberDisplay(formData.valor_milheiro)); }}
                      onFocus={() => { setRawValorMilheiro(formData.valor_milheiro ? String(formData.valor_milheiro).replace('.', ',') : ''); }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Atual</label>
                  <input type="text" value={saldoAtual.toLocaleString('pt-BR')} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Milheiro Médio Estoque</label>
                  <input type="text" value={formatCurrency(valorMilheiroLotes)} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lucro</label>
                  <input type="text" value={formatCurrency(lucroReal)} readOnly className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 font-medium" />
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Campos Opcionais</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor da Venda</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input type="text" value={formData.valor_total ? formData.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} readOnly className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taxa de Embarque R$</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={rawTaxaEmbarque}
                      onChange={(e) => { const val = e.target.value.replace(/[^0-9,]/g, ''); setRawTaxaEmbarque(val); setFormData(prev => ({ ...prev, taxa_embarque: parseFloat(val.replace(',', '.')) || 0 })); }}
                      onBlur={() => { if (formData.taxa_embarque) setRawTaxaEmbarque(formatNumberDisplay(formData.taxa_embarque)); }}
                      onFocus={() => { setRawTaxaEmbarque(formData.taxa_embarque ? String(formData.taxa_embarque).replace('.', ',') : ''); }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taxa de Resgate R$</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={rawTaxaResgate}
                      onChange={(e) => { const val = e.target.value.replace(/[^0-9,]/g, ''); setRawTaxaResgate(val); setFormData(prev => ({ ...prev, taxa_resgate: parseFloat(val.replace(',', '.')) || 0 })); }}
                      onBlur={() => { if (formData.taxa_resgate) setRawTaxaResgate(formatNumberDisplay(formData.taxa_resgate)); }}
                      onFocus={() => { setRawTaxaResgate(formData.taxa_resgate ? String(formData.taxa_resgate).replace('.', ',') : ''); }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bagagem/Tx Cancel./Assentos R$</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={rawTaxaBagagem}
                      onChange={(e) => { const val = e.target.value.replace(/[^0-9,]/g, ''); setRawTaxaBagagem(val); setFormData(prev => ({ ...prev, taxa_bagagem: parseFloat(val.replace(',', '.')) || 0 })); }}
                      onBlur={() => { if (formData.taxa_bagagem) setRawTaxaBagagem(formatNumberDisplay(formData.taxa_bagagem)); }}
                      onFocus={() => { setRawTaxaBagagem(formData.taxa_bagagem ? String(formData.taxa_bagagem).replace('.', ',') : ''); }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Cartão TX Embarque</label>
                  <select value={formData.cartao_taxa_embarque_id} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_embarque_id: e.target.value, cartao_taxa_embarque_tipo: '', cartao_taxa_embarque_parcelas: 1 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione o cartão</option>
                    {cartoes.map(c => <option key={c.id} value={c.id}>{c.cartao}</option>)}
                  </select>
                  {formData.cartao_taxa_embarque_id && (
                    <div className="flex gap-2">
                      <select value={formData.cartao_taxa_embarque_tipo} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_embarque_tipo: e.target.value as 'debito' | 'credito' | '', cartao_taxa_embarque_parcelas: 1 }))} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="">Tipo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                      </select>
                      {formData.cartao_taxa_embarque_tipo === 'credito' && (
                        <select value={formData.cartao_taxa_embarque_parcelas} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_embarque_parcelas: Number(e.target.value) }))} className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}x</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Cartão Tx Bagagem</label>
                  <select value={formData.cartao_taxa_bagagem_id} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_bagagem_id: e.target.value, cartao_taxa_bagagem_tipo: '', cartao_taxa_bagagem_parcelas: 1 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione o cartão</option>
                    {cartoes.map(c => <option key={c.id} value={c.id}>{c.cartao}</option>)}
                  </select>
                  {formData.cartao_taxa_bagagem_id && (
                    <div className="flex gap-2">
                      <select value={formData.cartao_taxa_bagagem_tipo} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_bagagem_tipo: e.target.value as 'debito' | 'credito' | '', cartao_taxa_bagagem_parcelas: 1 }))} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="">Tipo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                      </select>
                      {formData.cartao_taxa_bagagem_tipo === 'credito' && (
                        <select value={formData.cartao_taxa_bagagem_parcelas} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_bagagem_parcelas: Number(e.target.value) }))} className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}x</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Cartão Tx Resgate</label>
                  <select value={formData.cartao_taxa_resgate_id} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_resgate_id: e.target.value, cartao_taxa_resgate_tipo: '', cartao_taxa_resgate_parcelas: 1 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione o cartão</option>
                    {cartoes.map(c => <option key={c.id} value={c.id}>{c.cartao}</option>)}
                  </select>
                  {formData.cartao_taxa_resgate_id && (
                    <div className="flex gap-2">
                      <select value={formData.cartao_taxa_resgate_tipo} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_resgate_tipo: e.target.value as 'debito' | 'credito' | '', cartao_taxa_resgate_parcelas: 1 }))} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="">Tipo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                      </select>
                      {formData.cartao_taxa_resgate_tipo === 'credito' && (
                        <select value={formData.cartao_taxa_resgate_parcelas} onChange={(e) => setFormData(prev => ({ ...prev, cartao_taxa_resgate_parcelas: Number(e.target.value) }))} className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}x</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor Total Vendas</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input type="text" value={calcularValorTotalVendas().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-medium" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dt Voo Ida</label>
                  <input type="date" value={formData.data_voo_ida} min={new Date().toISOString().split('T')[0]} onChange={(e) => setFormData(prev => ({ ...prev, data_voo_ida: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dt Voo Volta</label>
                  <input type="date" value={formData.data_voo_volta} onChange={(e) => setFormData(prev => ({ ...prev, data_voo_volta: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Passageiro</label>
                  <input type="text" value={formData.nome_passageiro} onChange={(e) => setFormData(prev => ({ ...prev, nome_passageiro: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Qte Passageiro</label>
                  <input type="number" min="1" value={formData.quantidade_passageiros} onChange={(e) => setFormData(prev => ({ ...prev, quantidade_passageiros: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Trecho</label>
                  <input type="text" value={formData.trecho} onChange={(e) => setFormData(prev => ({ ...prev, trecho: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: GRU-MIA" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarifa Diamante</label>
                  <input type="number" min="0" step="1" value={formData.tarifa_diamante || ''} onChange={(e) => setFormData(prev => ({ ...prev, tarifa_diamante: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Milhas Bonus</label>
                  <input
                    type="text"
                    value={formData.milhas_bonus ? formData.milhas_bonus.toLocaleString('pt-BR') : ''}
                    onChange={(e) => { const value = e.target.value.replace(/\D/g, ''); setFormData(prev => ({ ...prev, milhas_bonus: Number(value) })); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custo Milheiro</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input type="text" value={formatCurrency(custoMedio)} readOnly className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custo Emissão</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={rawCustoEmissao}
                      onChange={(e) => { const val = e.target.value.replace(/[^0-9,]/g, ''); setRawCustoEmissao(val); setFormData(prev => ({ ...prev, custo_emissao: parseFloat(val.replace(',', '.')) || 0 })); }}
                      onBlur={() => { if (formData.custo_emissao) setRawCustoEmissao(formatNumberDisplay(formData.custo_emissao)); }}
                      onFocus={() => { setRawCustoEmissao(formData.custo_emissao ? String(formData.custo_emissao).replace('.', ',') : ''); }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Emissor</label>
                  <select value={formData.emissor} onChange={(e) => setFormData(prev => ({ ...prev, emissor: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    {usuarios.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observação</label>
              <textarea value={formData.observacao} onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Venda'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
