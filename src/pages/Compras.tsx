import { useState, useEffect } from 'react';
import { Plus, ShoppingCart, Info, Upload, FileSpreadsheet, Download, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ParceiroSearch from '../components/ParceiroSearch';
import CartaoSearch from '../components/CartaoSearch';
import BancoSearch from '../components/BancoSearch';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/formatters';
import { FilterBar } from '../components/FilterCombobox';
import * as XLSX from 'xlsx';

interface Parceiro {
  id: string;
  nome_parceiro: string;
  cpf?: string;
  ultima_movimentacao?: string;
}

interface Programa {
  id: string;
  nome: string;
}

interface ClassificacaoContabil {
  id: string;
  classificacao: string;
  descricao: string;
}

interface TipoCompra {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Cartao {
  id: string;
  cartao: string;
  banco_emissor: string;
  dia_vencimento?: number;
  dia_fechamento?: number;
}

interface BancoEmissor {
  id: string;
  nome_banco: string;
}

interface FormaPagamento {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Compra {
  id: string;
  parceiro_id?: string;
  programa_id?: string;
  tipo: string;
  data_entrada: string;
  pontos_milhas: number;
  bonus?: number;
  origem_bonus?: string;
  total_pontos?: number;
  valor_total?: number;
  valor_milheiro?: number;
  tipo_valor?: 'VT' | 'VM';
  saldo_atual?: number;
  custo_medio?: number;
  data_limite_bonus?: string;
  status?: string;
  forma_pagamento?: string;
  cartao_id?: string;
  conta_bancaria_id?: string;
  quantidade_parcelas?: number;
  data_vencimento_manual?: string;
  classificacao_contabil_id?: string;
  observacao?: string;
  agendar_entrada: boolean;
  agendamento_recorrente: boolean;
  periodicidade?: string;
  quantidade_recorrencia?: number;
  created_at: string;
  parceiros?: {
    nome_parceiro: string;
  };
  programas_fidelidade?: {
    nome: string;
  };
}

const TIPOS_ENTRADA = [
  'Compra de Pontos/Milhas',
  'Compra Bonificada',
  'Transferência entre Contas',
  'Assinatura de Clube',
  'Intermediação',
  'Bônus Cartão',
  'Ajuste de Saldo'
];

const PERIODICIDADES = [
  'Semanal',
  'Quinzenal',
  'Mensal',
  'Bimestral',
  'Trimestral',
  'Semestral',
  'Anual'
];

export default function Compras() {
  const { usuario, isAdmin } = useAuth();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroPrograma, setFiltroPrograma] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [tiposCompra, setTiposCompra] = useState<TipoCompra[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [bancosEmissores, setBancosEmissores] = useState<BancoEmissor[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [classificacoesContabeis, setClassificacoesContabeis] = useState<ClassificacaoContabil[]>([]);
  const [classificacaoSearch, setClassificacaoSearch] = useState('');
  const [showClassificacaoDropdown, setShowClassificacaoDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Compra | null>(null);
  const [formData, setFormData] = useState<Partial<Compra>>({
    agendar_entrada: false,
    agendamento_recorrente: false,
    tipo_valor: 'VT',
    tipo: 'Compra de Pontos/Milhas',
    data_entrada: new Date().toISOString().split('T')[0],
    pontos_milhas: 0,
    bonus: 0,
    valor_total: 0,
    valor_milheiro: 0,
    quantidade_recorrencia: 1,
    quantidade_parcelas: 1,
    status: 'Concluído',
    data_vencimento_manual: '',
  });

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [multipleEntries, setMultipleEntries] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [batchParceiroId, setBatchParceiroId] = useState<string>('');
  const [batchProgramaId, setBatchProgramaId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.classificacao-autocomplete')) {
        setShowClassificacaoDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isModalOpen && formData.parceiro_id) {
      carregarProgramasDoParceiro(formData.parceiro_id);
    } else if (isModalOpen && batchParceiroId) {
      carregarProgramasDoParceiro(batchParceiroId);
    } else if (!isModalOpen) {
      setProgramas([]);
    }
  }, [isModalOpen, formData.parceiro_id, batchParceiroId]);

  useEffect(() => {
    calcularSaldoECusto(formData.parceiro_id, formData.programa_id);
  }, [formData.parceiro_id, formData.programa_id]);

  useEffect(() => {
    if (formData.tipo_valor === 'VT' && formData.valor_total && formData.pontos_milhas && formData.pontos_milhas > 0) {
      const valorMilheiro = (formData.valor_total / formData.pontos_milhas) * 1000;
      setFormData(prev => ({ ...prev, valor_milheiro: Number(valorMilheiro.toFixed(2)) }));
    } else if (formData.tipo_valor === 'VM' && formData.valor_milheiro && formData.pontos_milhas && formData.pontos_milhas > 0) {
      const valorTotal = (formData.valor_milheiro * formData.pontos_milhas) / 1000;
      setFormData(prev => ({ ...prev, valor_total: Number(valorTotal.toFixed(2)) }));
    }
  }, [formData.valor_total, formData.valor_milheiro, formData.pontos_milhas, formData.tipo_valor]);

  const carregarProgramasDoParceiro = async (parceiroId: string) => {
    if (!parceiroId) {
      setProgramas([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('programas_clubes')
        .select('programa_id, programas_fidelidade(id, nome)')
        .eq('parceiro_id', parceiroId);

      if (error) throw error;

      if (data) {
        const programasUnicos = data
          .filter(item => item.programas_fidelidade)
          .map(item => ({
            id: (item.programas_fidelidade as any).id,
            nome: (item.programas_fidelidade as any).nome
          }))
          .filter((programa, index, self) =>
            index === self.findIndex(p => p.id === programa.id)
          );

        setProgramas(programasUnicos);
      }
    } catch (error) {
      console.error('Erro ao carregar programas do parceiro:', error);
      setProgramas([]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const [comprasRes, tiposCompraRes, cartoesRes, bancosRes, classificacoesRes, formasPagRes, parceirosRes] = await Promise.all([
        supabase.from('compras').select('*, parceiros(nome_parceiro), programas_fidelidade(nome)').order('data_entrada', { ascending: false }),
        supabase.from('tipos_compra').select('id, nome, ativo').eq('ativo', true).order('nome'),
        supabase.from('cartoes_credito').select('id, cartao, banco_emissor, dia_vencimento, dia_fechamento').order('cartao'),
        supabase.from('contas_bancarias').select('id, nome_banco').order('nome_banco'),
        supabase.from('classificacao_contabil').select('id, classificacao, descricao').order('classificacao'),
        supabase.from('formas_pagamento').select('id, nome, ativo').eq('ativo', true).order('ordem', { ascending: true }),
        supabase.from('parceiros').select('id, nome_parceiro, cpf').order('nome_parceiro')
      ]);

      setParceiros(parceirosRes.data || []);

      if (comprasRes.data) setCompras(comprasRes.data);
      if (tiposCompraRes.data) setTiposCompra(tiposCompraRes.data);
      if (cartoesRes.data) setCartoes(cartoesRes.data as any);
      if (bancosRes.data) setBancosEmissores(bancosRes.data);
      if (classificacoesRes.data) setClassificacoesContabeis(classificacoesRes.data);
      if (formasPagRes.data) setFormasPagamento(formasPagRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularSaldoECusto = async (parceiroId?: string, programaId?: string) => {
    if (!parceiroId || !programaId) {
      setFormData(prev => ({ ...prev, saldo_atual: 0, custo_medio: 0 }));
      return;
    }

    try {
      const { data } = await supabase
        .from('estoque_pontos')
        .select('saldo_atual, custo_medio')
        .eq('parceiro_id', parceiroId)
        .eq('programa_id', programaId)
        .maybeSingle();

      if (data) {
        setFormData(prev => ({
          ...prev,
          saldo_atual: Number(data.saldo_atual) || 0,
          custo_medio: Number(data.custo_medio) || 0
        }));
      } else {
        setFormData(prev => ({ ...prev, saldo_atual: 0, custo_medio: 0 }));
      }
    } catch (error) {
      console.error('Erro ao calcular saldo e custo:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (multipleEntries) {
      if (!batchParceiroId || !batchProgramaId) {
        setDialogConfig({
          isOpen: true,
          type: 'warning',
          title: 'Atenção',
          message: 'Por favor, selecione o Parceiro e o Programa antes de continuar.'
        });
        return;
      }

      if (excelData.length === 0) {
        setDialogConfig({
          isOpen: true,
          type: 'warning',
          title: 'Atenção',
          message: 'Por favor, faça o upload de uma planilha com os dados das compras.'
        });
        return;
      }
    } else {
      // Validar forma de pagamento (obrigatória)
      if (!formData.forma_pagamento) {
        setDialogConfig({
          isOpen: true,
          type: 'warning',
          title: 'Forma de Pagamento Obrigatória',
          message: 'Selecione a forma de pagamento para esta compra.'
        });
        return;
      }

      // Validar data de vencimento para pagamento em dinheiro
      if (formData.forma_pagamento === 'Dinheiro' && !formData.data_vencimento_manual) {
        setDialogConfig({
          isOpen: true,
          type: 'warning',
          title: 'Data de Vencimento Obrigatória',
          message: 'Informe a data de vencimento para pagamento em dinheiro.'
        });
        return;
      }

      // Validar se o valor total é zero para compra individual
      if (!formData.valor_total || formData.valor_total === 0) {
        setDialogConfig({
          isOpen: true,
          type: 'confirm',
          title: 'Confirmar Valor Zero',
          message: 'O valor total desta compra é R$ 0,00. Isso significa que não haverá custo financeiro associado a esta entrada de pontos. Tem certeza que deseja continuar?',
          onConfirm: () => {
            setDialogConfig({ ...dialogConfig, isOpen: false });
            setShowSaveConfirmation(true);
          },
          onCancel: () => {
            setDialogConfig({ ...dialogConfig, isOpen: false });
          }
        });
        return;
      }
    }

    setShowSaveConfirmation(true);
  };

  const confirmAndSaveCompra = async () => {
    try {
      if (multipleEntries && excelData.length > 0) {
        const hoje = new Date().toISOString().split('T')[0];
        const dataToInsert = excelData.map(row => {
          const dataEntrada = row.data_entrada;
          const dataLimiteBonus = row.data_limite_bonus;
          const hasBonus = row.bonus && row.bonus > 0;

          // Define status baseado nas datas
          let status = 'Concluído';
          if (dataEntrada > hoje || (hasBonus && dataLimiteBonus && dataLimiteBonus > hoje)) {
            status = 'Pendente';
          }

          return {
            parceiro_id: batchParceiroId,
            programa_id: batchProgramaId,
            tipo: row.tipo || 'Compra de Pontos/Milhas',
            data_entrada: dataEntrada,
            pontos_milhas: row.pontos_milhas,
            bonus: row.bonus || 0,
            total_pontos: (row.pontos_milhas || 0) + (row.bonus || 0),
            valor_total: row.valor_total,
            valor_milheiro: row.valor_milheiro,
            tipo_valor: row.tipo_valor || 'VT',
            status: status,
            forma_pagamento: row.forma_pagamento,
            quantidade_parcelas: row.quantidade_parcelas || 1,
            observacao: row.observacao,
            data_limite_bonus: dataLimiteBonus,
            agendar_entrada: false,
            agendamento_recorrente: false,
            created_by: usuario?.id,
            updated_at: new Date().toISOString()
          };
        });

        const { error } = await supabase
          .from('compras')
          .insert(dataToInsert);

        if (error) throw error;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Compra: ${excelData.length} registros (importação em lote)`,
          dados_antes: null,
          dados_depois: dataToInsert
        });

        setDialogConfig({
          isOpen: true,
          type: 'success',
          title: 'Sucesso',
          message: `${excelData.length} compra(s) registrada(s) com sucesso! Estas operações não poderão ser editadas ou excluídas.`
        });
      } else {
        // Validar data limite bônus se houver bônus
        if (formData.bonus && formData.bonus > 0 && !formData.data_limite_bonus) {
          setDialogConfig({
            isOpen: true,
            type: 'warning',
            title: 'Atenção',
            message: 'Quando há bônus, a Data Limite do Bônus é obrigatória.'
          });
          setShowSaveConfirmation(false);
          return;
        }

        const hoje = new Date().toISOString().split('T')[0];
        const dataEntrada = formData.data_entrada || hoje;
        const dataLimiteBonus = formData.data_limite_bonus;
        const hasBonus = formData.bonus && formData.bonus > 0;

        // Define status baseado nas datas
        const pontosAtrasados = dataEntrada > hoje;
        const bonusFuturo = hasBonus && dataLimiteBonus && dataLimiteBonus > hoje;
        // Cenário de divisão: pontos para hoje/passado + bônus para data futura
        const deveDividir = !pontosAtrasados && bonusFuturo;

        let status = 'Concluído';
        if (pontosAtrasados || bonusFuturo) {
          status = 'Pendente';
        }

        const baseData = {
          ...formData,
          created_by: usuario?.id,
          updated_at: new Date().toISOString(),
          data_vencimento_manual: formData.data_vencimento_manual || null
        };

        if (editingItem) {
          if (isAdmin && usuario) {
            await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: true });
          }

          const { error } = await supabase
            .from('compras')
            .update({ ...baseData, status })
            .eq('id', editingItem.id);

          if (isAdmin && usuario) {
            await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
          }

          if (error) throw error;

          const parceiro = parceiros.find(p => p.id === formData.parceiro_id);
          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'UPDATE',
            linha_afetada: `Compra: ${formData.pontos_milhas} pts - ${parceiro?.nome_parceiro}`,
            dados_antes: null,
            dados_depois: formData
          });

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Compra atualizada com sucesso!'
          });
        } else if (deveDividir) {
          // Salva dois registros: pontos creditados hoje + bônus pendente para data futura
          const registroPontos = {
            ...baseData,
            bonus: 0,
            origem_bonus: undefined,
            data_limite_bonus: undefined,
            total_pontos: formData.pontos_milhas || 0,
            status: 'Concluído'
          };

          const registroBonus = {
            ...baseData,
            pontos_milhas: 0,
            valor_total: 0,
            valor_milheiro: 0,
            total_pontos: formData.bonus || 0,
            status: 'Pendente'
          };

          const { error } = await supabase
            .from('compras')
            .insert([registroPontos, registroBonus]);

          if (error) throw error;

          const parceiro = parceiros.find(p => p.id === formData.parceiro_id);
          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'INSERT',
            linha_afetada: `Compra: ${formData.pontos_milhas} pts - ${parceiro?.nome_parceiro}`,
            dados_antes: null,
            dados_depois: formData
          });

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: `Compra registrada em 2 lançamentos: os pontos (${(formData.pontos_milhas || 0).toLocaleString('pt-BR')}) foram creditados agora, e o bônus (${(formData.bonus || 0).toLocaleString('pt-BR')}) ficará pendente até ${formatDate(dataLimiteBonus!)}.`
          });
        } else {
          const { error } = await supabase
            .from('compras')
            .insert([{ ...baseData, status }]);

          if (error) throw error;

          const parceiro = parceiros.find(p => p.id === formData.parceiro_id);
          await supabase.from('logs').insert({
            usuario_id: usuario?.id,
            usuario_nome: usuario?.nome || '',
            acao: 'INSERT',
            linha_afetada: `Compra: ${formData.pontos_milhas} pts - ${parceiro?.nome_parceiro}`,
            dados_antes: null,
            dados_depois: formData
          });

          const mensagemSucesso = status === 'Pendente'
            ? 'Compra registrada com sucesso! Os pontos serão creditados automaticamente quando a data de entrada chegar.'
            : 'Compra registrada com sucesso! Os pontos foram creditados no estoque.';

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: mensagemSucesso
          });
        }
      }

      setShowSaveConfirmation(false);
      setIsModalOpen(false);
      setEditingItem(null);
      setMultipleEntries(false);
      setExcelData([]);
      setShowPreview(false);
      setBatchParceiroId('');
      setBatchProgramaId('');
      setFormData({
        agendar_entrada: false,
        agendamento_recorrente: false,
        tipo_valor: 'VT',
        tipo: 'Compra de Pontos/Milhas',
        data_entrada: new Date().toISOString().split('T')[0],
        pontos_milhas: 0,
        bonus: 0,
        valor_total: 0,
        valor_milheiro: 0,
        quantidade_recorrencia: 1,
        quantidade_parcelas: 1,
        status: 'Concluído',
      });
      setClassificacaoSearch('');

      fetchData();
    } catch (error: any) {
      if (isAdmin && usuario) {
        await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
      }
      console.error('Erro ao salvar:', error);
      setShowSaveConfirmation(false);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: error.message || 'Ocorreu um erro ao salvar o registro.'
      });
    }
  };

  const handleEdit = (compra: Compra) => {
    setEditingItem(compra);
    setFormData(compra);
    setIsModalOpen(true);
  };

  const executarDelete = async (id: string, cancelarContas: boolean) => {
    try {
      if (isAdmin && usuario) {
        await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: true });
      }

      if (cancelarContas) {
        await supabase
          .from('contas_a_pagar')
          .update({ status_pagamento: 'cancelado', updated_at: new Date().toISOString() })
          .eq('origem_tipo', 'compra')
          .eq('origem_id', id)
          .in('status_pagamento', ['pendente', 'atrasado']);
      }

      const { error } = await supabase
        .from('compras')
        .delete()
        .eq('id', id);

      if (isAdmin && usuario) {
        await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
      }

      if (error) throw error;

      await supabase.from('logs').insert({
        usuario_id: usuario?.id,
        usuario_nome: usuario?.nome || '',
        acao: 'DELETE',
        linha_afetada: `Compra: id=${id}`,
        dados_antes: null,
        dados_depois: null
      });

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: cancelarContas
          ? 'Compra excluída e contas a pagar associadas canceladas com sucesso!'
          : 'Compra excluída com sucesso!'
      });

      fetchData();
    } catch (error: any) {
      if (isAdmin && usuario) {
        await supabase.rpc('set_admin_mode', { usuario_id: usuario.id, is_admin: false });
      }
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Excluir',
        message: error.message || 'Ocorreu um erro ao excluir o registro.'
      });
    }
  };

  const handleDelete = async (id: string) => {
    // Verifica se há contas a pagar associadas (pendentes ou atrasadas)
    const { data: contas } = await supabase
      .from('contas_a_pagar')
      .select('id, valor_parcela, numero_parcela, total_parcelas, status_pagamento')
      .eq('origem_tipo', 'compra')
      .eq('origem_id', id)
      .in('status_pagamento', ['pendente', 'atrasado']);

    const temContas = contas && contas.length > 0;

    if (temContas) {
      const totalContas = contas!.length;
      const valorTotal = contas!.reduce((sum, c) => sum + (c.valor_parcela || 0), 0);

      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Confirmar Exclusão',
        message: `Esta compra possui ${totalContas} conta(s) a pagar associada(s) (${formatCurrency(valorTotal)} no total) com status pendente ou atrasado.\n\nDeseja excluir a compra E cancelar as contas a pagar, ou excluir apenas a compra?`,
        confirmText: 'Excluir compra e cancelar contas',
        cancelText: 'Excluir só a compra',
        onConfirm: () => executarDelete(id, true),
        onCancel: () => executarDelete(id, false),
      });
    } else {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Confirmar Exclusão',
        message: 'Tem certeza que deseja excluir esta compra?\n\nEsta ação afetará o estoque de pontos/milhas e não pode ser desfeita.',
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        onConfirm: () => executarDelete(id, false),
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const parceiroSelecionado = parceiros.find(p => p.id === batchParceiroId);
    const programaSelecionado = programas.find(p => p.id === batchProgramaId);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const processedData = jsonData
          .filter((row: any) => {
            const pontos = Number(row['Pontos/Milhas'] || row['pontos_milhas'] || 0);
            const valor = Number(row['Valor Total'] || row['valor_total'] || 0);
            const tipo = row['Tipo'] || row['tipo'] || '';

            return pontos > 0 && valor > 0 && tipo;
          })
          .map((row: any) => {
            let dataEntrada = '';
            if (row['Data Entrada'] || row['data_entrada']) {
              const dateValue = row['Data Entrada'] || row['data_entrada'];
              if (typeof dateValue === 'number') {
                const date = XLSX.SSF.parse_date_code(dateValue);
                dataEntrada = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
              } else {
                dataEntrada = dateValue;
              }
            }

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataEntradaObj = new Date(dataEntrada);

            let status = 'Concluído';
            if (dataEntradaObj > hoje) {
              status = 'Pendente';
            }

            return {
              parceiro_nome: row['Parceiro (Nome)'] || row['parceiro_nome'] || row['parceiro'] || (parceiroSelecionado ? parceiroSelecionado.nome_parceiro : ''),
              programa_nome: row['Programa (Nome)'] || row['programa_nome'] || row['programa'] || (programaSelecionado ? programaSelecionado.nome : ''),
              tipo: row['Tipo'] || row['tipo'] || 'Compra de Pontos/Milhas',
              data_entrada: dataEntrada || new Date().toISOString().split('T')[0],
              pontos_milhas: Number(row['Pontos/Milhas'] || row['pontos_milhas'] || 0),
              bonus: Number(row['Bônus'] || row['bonus'] || 0),
              origem_bonus: row['Origem Bônus'] || row['origem_bonus'] || '',
              valor_total: Number(row['Valor Total'] || row['valor_total'] || 0),
              valor_milheiro: Number(row['Valor Milheiro'] || row['valor_milheiro'] || 0),
              tipo_valor: row['Tipo Valor'] || row['tipo_valor'] || 'VT',
              status: status,
              forma_pagamento: row['Forma Pagamento'] || row['forma_pagamento'] || '',
              cartao_nome: row['Cartão'] || row['cartao_nome'] || row['cartao'] || '',
              conta_bancaria_nome: row['Conta Bancária'] || row['conta_bancaria_nome'] || row['conta_bancaria'] || '',
              quantidade_parcelas: Number(row['Quantidade Parcelas'] || row['quantidade_parcelas'] || 1),
              classificacao_contabil_nome: row['Classificação Contábil'] || row['classificacao_contabil_nome'] || row['classificacao_contabil'] || '',
              observacao: row['Observação'] || row['observacao'] || ''
            };
          });

        if (processedData.length === 0) {
          setDialogConfig({
            isOpen: true,
            type: 'warning',
            title: 'Atenção',
            message: 'Nenhuma linha válida encontrada na planilha. Verifique se há dados nas colunas obrigatórias (Tipo, Pontos/Milhas, Valor Total).'
          });
          return;
        }

        setExcelData(processedData);
        setShowPreview(true);
      } catch (error) {
        console.error('Erro ao processar planilha:', error);
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Processar Planilha',
          message: 'Não foi possível processar a planilha. Verifique o formato.'
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const parceiroSelecionado = parceiros.find(p => p.id === batchParceiroId);
    const programaSelecionado = programas.find(p => p.id === batchProgramaId);

    const incluirParceiro = !batchParceiroId;
    const incluirPrograma = !batchProgramaId;

    const templateBase: any = {
      'Tipo': 'Compra de Pontos/Milhas',
      'Data Entrada': '2025-01-15',
      'Pontos/Milhas': 10000,
      'Bônus': 1000,
      'Origem Bônus': 'Bônus Promocional',
      'Valor Total': 150.00,
      'Valor Milheiro': 15.00,
      'Tipo Valor': 'VT',
      'Forma Pagamento': 'Pix',
      'Cartão': 'Nome do Cartão',
      'Conta Bancária': 'Nome da Conta',
      'Quantidade Parcelas': 1,
      'Classificação Contábil': 'Despesas Operacionais',
      'Observação': 'Exemplo de compra'
    };

    const templateBase2: any = {
      'Tipo': 'Compra Bonificada',
      'Data Entrada': '2025-01-16',
      'Pontos/Milhas': 5000,
      'Bônus': 500,
      'Origem Bônus': 'Bônus Recorrente',
      'Valor Total': 75.00,
      'Valor Milheiro': 15.00,
      'Tipo Valor': 'VM',
      'Forma Pagamento': 'Cartão de Crédito',
      'Cartão': 'Santander Platinum',
      'Conta Bancária': '',
      'Quantidade Parcelas': 3,
      'Classificação Contábil': 'Despesas Operacionais',
      'Observação': 'Compra parcelada'
    };

    if (incluirParceiro) {
      templateBase['Parceiro (Nome)'] = 'Nome do Parceiro';
      templateBase2['Parceiro (Nome)'] = 'João Silva';
    }

    if (incluirPrograma) {
      templateBase['Programa (Nome)'] = 'Nome do Programa';
      templateBase2['Programa (Nome)'] = 'Smiles';
    }

    const template = [templateBase, templateBase2];

    const opcoes: any[] = [];

    if (incluirParceiro) {
      opcoes.push({ Campo: 'Parceiro (Nome)', 'Opções Válidas': 'Nome completo do parceiro cadastrado no sistema' });
    }

    if (incluirPrograma) {
      opcoes.push({ Campo: 'Programa (Nome)', 'Opções Válidas': 'Nome do programa de fidelidade (Smiles, Livelo, TAP, etc)' });
    }

    opcoes.push(
      { Campo: 'Tipo', 'Opções Válidas': TIPOS_ENTRADA.join(', ') },
      { Campo: 'Data Entrada', 'Opções Válidas': 'Formato: AAAA-MM-DD (ex: 2025-01-15). Status será calculado automaticamente.' },
      { Campo: 'Pontos/Milhas', 'Opções Válidas': 'Apenas números inteiros' },
      { Campo: 'Bônus', 'Opções Válidas': 'Apenas números inteiros (opcional, deixe vazio se não houver bônus)' },
      { Campo: 'Origem Bônus', 'Opções Válidas': 'Bônus Promocional, Bônus Recorrente, Bônus Clube, Bônus Especial (opcional)' },
      { Campo: 'Valor Total', 'Opções Válidas': 'Apenas números com ponto decimal (ex: 150.00)' },
      { Campo: 'Valor Milheiro', 'Opções Válidas': 'Apenas números com ponto decimal (ex: 15.00)' },
      { Campo: 'Tipo Valor', 'Opções Válidas': 'VT (Valor Total) ou VM (Valor Milheiro)' },
      { Campo: 'Forma Pagamento', 'Opções Válidas': 'Pix, Cartão de Crédito, Boleto, Transferência Bancária, Dinheiro' },
      { Campo: 'Cartão', 'Opções Válidas': 'Nome do cartão cadastrado (opcional, apenas se forma de pagamento for cartão)' },
      { Campo: 'Conta Bancária', 'Opções Válidas': 'Nome da conta bancária cadastrada (opcional)' },
      { Campo: 'Quantidade Parcelas', 'Opções Válidas': 'Apenas números inteiros de 1 a 12 (padrão: 1)' },
      { Campo: 'Classificação Contábil', 'Opções Válidas': 'Nome da classificação contábil cadastrada (opcional)' },
      { Campo: 'Observação', 'Opções Válidas': 'Texto livre para notas e comentários (opcional)' }
    );

    const infoText = [];
    if (!incluirParceiro && parceiroSelecionado) {
      infoText.push(`Parceiro selecionado: ${parceiroSelecionado.nome_parceiro}`);
    }
    if (!incluirPrograma && programaSelecionado) {
      infoText.push(`Programa selecionado: ${programaSelecionado.nome}`);
    }

    if (infoText.length > 0) {
      opcoes.unshift({
        Campo: 'INFORMAÇÃO',
        'Opções Válidas': infoText.join(' | ') + ' (Não precisa preencher na planilha)'
      });
    }

    const ws = XLSX.utils.json_to_sheet(template);
    const wsOpcoes = XLSX.utils.json_to_sheet(opcoes);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.utils.book_append_sheet(wb, wsOpcoes, 'Opções Válidas');

    const filename = parceiroSelecionado && programaSelecionado
      ? `template_compras_${parceiroSelecionado.nome_parceiro}_${programaSelecionado.nome}.xlsx`.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      : 'template_compras.xlsx';

    XLSX.writeFile(wb, filename);
  };

  const getProgramaNome = (compra: Compra) => {
    return compra.programas_fidelidade?.nome || '-';
  };

  const getParceiroNome = (compra: Compra) => {
    return compra.parceiros?.nome_parceiro || '-';
  };

  const comprasFiltradas = compras.filter(c =>
    (!filtroParceiro || getParceiroNome(c).toLowerCase().includes(filtroParceiro.toLowerCase())) &&
    (!filtroPrograma || getProgramaNome(c).toLowerCase().includes(filtroPrograma.toLowerCase())) &&
    (!filtroTipo || c.tipo === filtroTipo) &&
    (!filtroStatus || (c.status || '') === filtroStatus)
  );

  const parceirosUnicos = Array.from(new Set(compras.map(c => getParceiroNome(c)).filter(n => n !== '-'))).sort();
  const programasUnicos = Array.from(new Set(compras.map(c => getProgramaNome(c)).filter(n => n !== '-'))).sort();
  const tiposUnicos = Array.from(new Set(compras.map(c => c.tipo).filter(Boolean))).sort();
  const statusUnicos = Array.from(new Set(compras.map(c => c.status || '').filter(Boolean))).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Compras (Entradas)</h1>
            <p className="text-sm text-slate-600">Gerencie as compras e entradas de pontos/milhas</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setMultipleEntries(false);
            setExcelData([]);
            setShowPreview(false);
            setBatchParceiroId('');
            setBatchProgramaId('');
            setFormData({
              agendar_entrada: false,
              agendamento_recorrente: false,
              tipo_valor: 'VT',
              tipo: 'Compra de Pontos/Milhas',
              data_entrada: new Date().toISOString().split('T')[0],
              pontos_milhas: 0,
              bonus: 0,
              valor_total: 0,
              valor_milheiro: 0,
              quantidade_recorrencia: 1,
              quantidade_parcelas: 1,
              status: 'Concluído',
            });
            setClassificacaoSearch('');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Compra
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-100">
          <FilterBar
            filters={[
              { label: 'Parceiro', options: parceirosUnicos, value: filtroParceiro, onChange: setFiltroParceiro },
              { label: 'Programa', options: programasUnicos, value: filtroPrograma, onChange: setFiltroPrograma },
              { label: 'Tipo', options: tiposUnicos, value: filtroTipo, onChange: setFiltroTipo },
              { label: 'Status', options: statusUnicos, value: filtroStatus, onChange: setFiltroStatus },
            ]}
            onClear={() => { setFiltroParceiro(''); setFiltroPrograma(''); setFiltroTipo(''); setFiltroStatus(''); }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Parceiro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Programa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pontos/Milhas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bônus</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Pontos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Milheiro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {comprasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} className="px-6 py-12 text-center text-slate-500">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                comprasFiltradas.map((compra) => (
                  <tr key={compra.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {formatDate(compra.data_entrada)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {getParceiroNome(compra)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {getProgramaNome(compra)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {compra.tipo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {compra.pontos_milhas?.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {compra.bonus?.toLocaleString('pt-BR') || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                      {compra.total_pontos?.toLocaleString('pt-BR') || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {formatCurrency(compra.valor_total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {formatCurrency(compra.valor_milheiro)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        compra.status === 'Concluído'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {compra.status || 'Pendente'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(compra)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(compra.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Compra (Entrada)">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={multipleEntries}
                onChange={(e) => {
                  setMultipleEntries(e.target.checked);
                  setExcelData([]);
                  setShowPreview(false);
                }}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Importar Múltiplos Lançamentos via Planilha Excel</span>
              </div>
            </label>
          </div>

          {multipleEntries ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Parceiro <span className="text-red-500">*</span>
                  </label>
                  <ParceiroSearch
                    parceiros={parceiros}
                    value={batchParceiroId}
                    onChange={(parceiroId) => {
                      setBatchParceiroId(parceiroId);
                      setBatchProgramaId('');
                      carregarProgramasDoParceiro(parceiroId);
                    }}
                    placeholder="Digite para buscar parceiro..."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Mostrando parceiros com movimentação nos últimos 90 dias
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Programa <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={batchProgramaId}
                    onChange={(e) => setBatchProgramaId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione</option>
                    {programas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                  <Upload className="w-12 h-12 text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700 mb-1">Faça upload da planilha Excel</p>
                    <p className="text-xs text-slate-500">Formatos aceitos: .xlsx, .xls</p>
                  </div>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Selecionar Arquivo
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Template
                    </button>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 w-full">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-semibold mb-1">Atenção: Use as opções exatas do sistema</p>
                        <p className="mb-1">O template contém 2 abas:</p>
                        <ul className="list-disc ml-4 space-y-0.5">
                          <li><strong>Dados:</strong> Exemplos de preenchimento</li>
                          <li><strong>Opções Válidas:</strong> Lista completa de valores aceitos para cada campo</li>
                        </ul>
                        <p className="mt-1 font-medium">Os valores devem ser EXATAMENTE como listados na aba "Opções Válidas".</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {showPreview && excelData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800">Preview dos Dados</h3>
                    <span className="text-sm text-slate-600">{excelData.length} registro(s)</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Tipo</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Data</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Pontos</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Bônus</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Total</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Valor</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {excelData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-sm text-slate-900">{row.tipo}</td>
                            <td className="px-3 py-2 text-sm text-slate-900">{formatDate(row.data_entrada)}</td>
                            <td className="px-3 py-2 text-sm text-slate-900">{row.pontos_milhas.toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-2 text-sm text-slate-900">{row.bonus.toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-2 text-sm font-semibold text-slate-900">
                              {(row.pontos_milhas + row.bonus).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-900">{formatCurrency(row.valor_total)}</td>
                            <td className="px-3 py-2 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                row.status === 'Concluído' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Parceiro <span className="text-red-500">*</span>
              </label>
              <ParceiroSearch
                parceiros={parceiros}
                value={formData.parceiro_id || ''}
                onChange={(parceiroId) => {
                  setFormData({ ...formData, parceiro_id: parceiroId, programa_id: '' });
                  carregarProgramasDoParceiro(parceiroId);
                }}
                placeholder="Digite para buscar parceiro..."
              />
              <p className="text-xs text-slate-500 mt-1">
                Mostrando parceiros com movimentação nos últimos 90 dias
              </p>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Programa <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.programa_id || ''}
                onChange={(e) => setFormData({ ...formData, programa_id: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {programas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Atual</label>
              <input
                type="text"
                value={formData.saldo_atual?.toLocaleString('pt-BR') || '0'}
                disabled
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Custo Médio</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">R$</span>
                <input
                  type="text"
                  value={formData.custo_medio ? formatCurrency(formData.custo_medio).replace('R$', '').trim() : '0,00'}
                  disabled
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.tipo || ''}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {tiposCompra.map((tipo) => (
                  <option key={tipo.id} value={tipo.nome}>{tipo.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Entrada <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={(formData.data_entrada || '').split('T')[0]}
                onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pontos/Milhas <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pontos_milhas?.toLocaleString('pt-BR') || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, pontos_milhas: Number(val) });
                }}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bônus</label>
              <input
                type="text"
                value={formData.bonus?.toLocaleString('pt-BR') || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, bonus: Number(val) });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total de Pontos</label>
              <input
                type="text"
                value={((formData.pontos_milhas || 0) + (formData.bonus || 0)).toLocaleString('pt-BR')}
                disabled
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Origem Bonus</label>
              <input
                type="text"
                value={formData.origem_bonus || ''}
                onChange={(e) => setFormData({ ...formData, origem_bonus: e.target.value })}
                placeholder="Descreva a origem do bônus..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data Limite Bônus {formData.bonus && formData.bonus > 0 && <span className="text-red-500">*</span>}
              </label>
              <input
                type="date"
                value={(formData.data_limite_bonus || '').split('T')[0]}
                onChange={(e) => setFormData({ ...formData, data_limite_bonus: e.target.value })}
                required={formData.bonus !== undefined && formData.bonus > 0}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {formData.bonus && formData.bonus > 0 && (
                <p className="text-xs text-slate-500 mt-1">Obrigatório quando há bônus</p>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Sobre o Status da Compra:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Se a data de entrada for <strong>hoje ou no passado</strong>, a compra será marcada como <strong>Concluída</strong> e os pontos entrarão imediatamente</li>
                  <li>Se a data de entrada for <strong>futura</strong>, a compra ficará <strong>Pendente</strong> até a data chegar</li>
                  <li>Se houver bônus com data limite futura, os pontos do bônus só entrarão quando a data limite for atingida</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento <span className="text-red-500">*</span></label>
              <select
                value={formData.forma_pagamento || ''}
                onChange={(e) => {
                  const forma = e.target.value;
                  const usaCartao = forma === 'Crédito' || forma === 'Débito';
                  const usaBanco = forma === 'PIX' || forma === 'Transferência' || forma === 'Dinheiro';

                  setFormData({
                    ...formData,
                    forma_pagamento: forma,
                    cartao_id: usaCartao ? formData.cartao_id : undefined,
                    conta_bancaria_id: usaBanco ? formData.conta_bancaria_id : undefined
                  });
                }}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {formasPagamento.map((forma) => (
                  <option key={forma.id} value={forma.nome}>{forma.nome}</option>
                ))}
              </select>
            </div>

            {formData.forma_pagamento !== 'Não registrar no fluxo de caixa' && (
              <>
                {(formData.forma_pagamento === 'Crédito' || formData.forma_pagamento === 'Débito') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cartão <span className="text-red-500">*</span>
                    </label>
                    <CartaoSearch
                      cartoes={cartoes}
                      value={formData.cartao_id || ''}
                      onChange={(cartaoId) => setFormData({ ...formData, cartao_id: cartaoId })}
                      placeholder="Digite para buscar cartão..."
                      required={formData.forma_pagamento === 'Crédito' || formData.forma_pagamento === 'Débito'}
                    />
                  </div>
                )}

                {(formData.forma_pagamento === 'PIX' || formData.forma_pagamento === 'Transferência' || formData.forma_pagamento === 'Dinheiro') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Banco Emissor <span className="text-red-500">*</span>
                    </label>
                    <BancoSearch
                      bancos={bancosEmissores}
                      value={formData.conta_bancaria_id || ''}
                      onChange={(bancoId) => setFormData({ ...formData, conta_bancaria_id: bancoId })}
                      placeholder="Digite para buscar banco..."
                      required={formData.forma_pagamento === 'PIX' || formData.forma_pagamento === 'Transferência' || formData.forma_pagamento === 'Dinheiro'}
                    />
                  </div>
                )}
              </>
            )}

            {formData.forma_pagamento === 'Dinheiro' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data de Vencimento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={(formData.data_vencimento_manual || '').split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, data_vencimento_manual: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Parcelas</label>
              <input
                type="number"
                min="1"
                value={formData.quantidade_parcelas || 1}
                onChange={(e) => setFormData({ ...formData, quantidade_parcelas: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="relative classificacao-autocomplete">
              <label className="block text-sm font-medium text-slate-700 mb-1">Classificação Contábil</label>
              <input
                type="text"
                value={classificacaoSearch}
                onChange={(e) => {
                  setClassificacaoSearch(e.target.value);
                  setShowClassificacaoDropdown(true);
                }}
                onFocus={() => setShowClassificacaoDropdown(true)}
                placeholder="Digite para buscar..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {showClassificacaoDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {classificacoesContabeis
                    .filter((c) => {
                      const search = classificacaoSearch.toLowerCase();
                      return (
                        c.classificacao.toLowerCase().includes(search) ||
                        (c.descricao && c.descricao.toLowerCase().includes(search))
                      );
                    })
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setFormData({ ...formData, classificacao_contabil_id: c.id });
                          setClassificacaoSearch(`${c.classificacao} - ${c.descricao || ''}`);
                          setShowClassificacaoDropdown(false);
                        }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">{c.classificacao}</div>
                        {c.descricao && <div className="text-sm text-slate-600">{c.descricao}</div>}
                      </div>
                    ))}
                  {classificacoesContabeis.filter((c) => {
                    const search = classificacaoSearch.toLowerCase();
                    return (
                      c.classificacao.toLowerCase().includes(search) ||
                      (c.descricao && c.descricao.toLowerCase().includes(search))
                    );
                  }).length === 0 && (
                    <div className="px-3 py-2 text-slate-500 text-center">Nenhuma classificação encontrada</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valor Total <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-slate-500">R$</span>
                  <input
                    type="text"
                    value={formData.valor_total ? formatCurrency(formData.valor_total).replace('R$', '').trim() : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, valor_total: Number(val) / 100 });
                    }}
                    disabled={formData.tipo_valor === 'VM'}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo_valor: 'VT' })}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.tipo_valor === 'VT'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  VT
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valor Milheiro <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-slate-500">R$</span>
                  <input
                    type="text"
                    value={formData.valor_milheiro ? formatCurrency(formData.valor_milheiro).replace('R$', '').trim() : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, valor_milheiro: Number(val) / 100 });
                    }}
                    disabled={formData.tipo_valor === 'VT'}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo_valor: 'VM' })}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.tipo_valor === 'VM'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  VM
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <textarea
              value={formData.observacao || ''}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
        onConfirm={() => {
          if (dialogConfig.onConfirm) {
            dialogConfig.onConfirm();
          }
          setDialogConfig({ ...dialogConfig, isOpen: false });
        }}
        onCancel={dialogConfig.onCancel ? () => {
          dialogConfig.onCancel!();
          setDialogConfig({ ...dialogConfig, isOpen: false });
        } : undefined}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmText={dialogConfig.confirmText}
        cancelText={dialogConfig.cancelText}
      />

      <ConfirmDialog
        isOpen={showSaveConfirmation}
        onClose={() => setShowSaveConfirmation(false)}
        onConfirm={confirmAndSaveCompra}
        type="warning"
        title="Confirmar Registro de Compra"
        message={multipleEntries && excelData.length > 0
          ? `Confirmar registro de ${excelData.length} compra(s)? As compras com data futura ficarão pendentes até a data de entrada.`
          : "Confirmar o registro desta compra? Se a data for futura, os pontos serão creditados automaticamente quando a data chegar."
        }
      />
    </div>
  );
}
