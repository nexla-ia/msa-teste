import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ParceiroSearch from '../components/ParceiroSearch';
import { FilterBar } from '../components/FilterCombobox';
import { X, ChevronDown, ChevronUp, Users as UsersIcon } from 'lucide-react';

type ContaFamilia = {
  id: string;
  id_conta_familia: string;
  nome_conta: string;
  parceiro_principal_id: string | null;
  programa_id: string | null;
  status: string;
  obs: string;
  parceiro_nome?: string;
  programa_nome?: string;
};

type Membro = {
  id: string;
  parceiro_id: string;
  data_inclusao: string;
  data_exclusao: string;
  status: string;
  parceiro_nome?: string;
};

type Parceiro = {
  id: string;
  nome_parceiro: string;
  id_parceiro: string;
};

type Programa = {
  id: string;
  nome: string;
};

export default function ContaFamilia() {
  const [contas, setContas] = useState<ContaFamilia[]>([]);
  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroPrograma, setFiltroPrograma] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContaFamilia | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [membrosMap, setMembrosMap] = useState<Record<string, Membro[]>>({});
  const { usuario } = useAuth();

  const [formData, setFormData] = useState({
    id_conta_familia: '',
    nome_conta: '',
    parceiro_principal_id: '',
    programa_id: '',
    status: 'Ativa',
    obs: ''
  });

  const [membros, setMembros] = useState<Membro[]>([]);
  const [membrosOriginais, setMembrosOriginais] = useState<Membro[]>([]);
  const [novoMembro, setNovoMembro] = useState({
    parceiro_id: '',
    data_inclusao: new Date().toISOString().split('T')[0],
    data_exclusao: '',
    status: 'Ativo'
  });

  const [parceirosDisponiveis, setParceirosDisponiveis] = useState<Parceiro[]>([]);
  const [parceirosAdicionaisDisponiveis, setParceirosAdicionaisDisponiveis] = useState<Parceiro[]>([]);

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

  useEffect(() => {
    loadData();
    loadParceiros();
    loadProgramas();
  }, []);

  useEffect(() => {
    if (parceiros.length > 0 && formData.programa_id) {
      filtrarParceirosDisponiveis(formData.programa_id, editing?.id);
      if (formData.parceiro_principal_id) {
        verificarParceiroJaEmFamilia(formData.parceiro_principal_id, formData.programa_id, editing?.id).then(jaEmFamilia => {
          if (jaEmFamilia) {
            setFormData(prev => ({ ...prev, parceiro_principal_id: '' }));
          }
        }).catch(console.error);
      }
    } else {
      setParceirosDisponiveis(parceiros);
      setParceirosAdicionaisDisponiveis(parceiros);
    }
  }, [formData.programa_id, parceiros, editing]);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('conta_familia')
        .select(`
          *,
          parceiro:parceiro_principal_id(nome_parceiro),
          programa:programa_id(programa, nome)
        `)
        .order('id_conta_familia');

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        parceiro_nome: item.parceiro?.nome_parceiro || '',
        programa_nome: item.programa?.nome || item.programa?.programa || ''
      }));

      setContas(formattedData);
    } finally {
      setLoading(false);
    }
  };

  const loadParceiros = async () => {
    const { data } = await supabase
      .from('parceiros')
      .select('id, nome_parceiro, id_parceiro')
      .order('nome_parceiro');
    setParceiros(data || []);
  };

  const loadProgramas = async () => {
    const { data } = await supabase
      .from('programas_fidelidade')
      .select('id, programa, nome')
      .order('programa');
    const formattedData = (data || []).map(p => ({
      id: p.id,
      nome: p.nome || p.programa
    }));
    setProgramas(formattedData);
  };

  const loadMembros = async (contaFamiliaId: string) => {
    const { data } = await supabase
      .from('conta_familia_membros')
      .select(`
        *,
        parceiro:parceiro_id(nome_parceiro)
      `)
      .eq('conta_familia_id', contaFamiliaId)
      .order('data_inclusao', { ascending: false });

    const formattedMembros = (data || []).map((item: any) => ({
      ...item,
      parceiro_nome: item.parceiro?.nome_parceiro || ''
    }));

    setMembros(formattedMembros);
    setMembrosOriginais(formattedMembros);
  };

  const loadMembrosForRow = async (conta: ContaFamilia) => {
    const { data } = await supabase
      .from('conta_familia_membros')
      .select(`
        *,
        parceiro:parceiro_id(nome_parceiro)
      `)
      .eq('conta_familia_id', conta.id)
      .order('data_inclusao', { ascending: false });

    const formattedMembros = (data || []).map((item: any) => ({
      ...item,
      parceiro_nome: item.parceiro?.nome_parceiro || ''
    }));

    setMembrosMap(prev => ({ ...prev, [conta.id]: formattedMembros }));
  };

  const verificarMembroTemContaNoPrograma = async (parceiroId: string, programaId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('estoque_pontos')
      .select('id')
      .eq('parceiro_id', parceiroId)
      .eq('programa_id', programaId)
      .maybeSingle();
    return !!data;
  };

  const verificarParceiroBloqueado = async (parceiroId: string, programaId: string): Promise<{ bloqueado: boolean; dataLiberacao?: string }> => {
    const { data } = await supabase
      .from('conta_familia_historico')
      .select('data_liberacao')
      .eq('parceiro_id', parceiroId)
      .eq('programa_id', programaId)
      .gt('data_liberacao', new Date().toISOString())
      .order('data_liberacao', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return { bloqueado: true, dataLiberacao: data.data_liberacao };
    }
    return { bloqueado: false };
  };

  const verificarParceiroJaEmFamilia = async (parceiroId: string, programaId: string, contaFamiliaIdAtual?: string): Promise<boolean> => {
    const { data } = await supabase
      .from('conta_familia')
      .select('id, parceiro_principal_id, status, programa_id')
      .eq('status', 'Ativa')
      .eq('parceiro_principal_id', parceiroId)
      .eq('programa_id', programaId);

    if (data && data.length > 0) {
      if (contaFamiliaIdAtual) {
        return data.some(cf => cf.id !== contaFamiliaIdAtual);
      }
      return true;
    }

    const { data: membrosData } = await supabase
      .from('conta_familia_membros')
      .select('conta_familia_id, parceiro_id, status, conta_familia!inner(status, programa_id)')
      .eq('parceiro_id', parceiroId)
      .eq('status', 'Ativo')
      .eq('conta_familia.programa_id', programaId);

    if (membrosData && membrosData.length > 0) {
      const emFamilia = membrosData.some((m: any) => {
        if (m.conta_familia?.status === 'Ativa') {
          if (contaFamiliaIdAtual) {
            return m.conta_familia_id !== contaFamiliaIdAtual;
          }
          return true;
        }
        return false;
      });
      return emFamilia;
    }

    return false;
  };

  const filtrarParceirosDisponiveis = async (programaId: string, contaFamiliaId?: string) => {
    if (!programaId) {
      setParceirosDisponiveis(parceiros);
      setParceirosAdicionaisDisponiveis(parceiros);
      return;
    }

    const parceirosDisp = await Promise.all(
      parceiros.map(async (parceiro) => {
        const jaEmFamilia = await verificarParceiroJaEmFamilia(parceiro.id, programaId, contaFamiliaId);
        const bloqueio = await verificarParceiroBloqueado(parceiro.id, programaId);

        if (jaEmFamilia || bloqueio.bloqueado) {
          return null;
        }
        return parceiro;
      })
    );

    const parceirosValidos = parceirosDisp.filter(p => p !== null) as Parceiro[];
    setParceirosDisponiveis(parceirosValidos);
    setParceirosAdicionaisDisponiveis(parceirosValidos);
  };

  const toggleRowExpansion = async (conta: ContaFamilia) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(conta.id)) {
      newExpanded.delete(conta.id);
    } else {
      newExpanded.add(conta.id);
      if (!membrosMap[conta.id]) {
        await loadMembrosForRow(conta);
      }
    }
    setExpandedRows(newExpanded);
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({
      id_conta_familia: '',
      nome_conta: '',
      parceiro_principal_id: '',
      programa_id: '',
      status: 'Ativa',
      obs: ''
    });
    setMembros([]);
    setMembrosOriginais([]);
    setModalOpen(true);
  };

  const handleEdit = async (item: ContaFamilia) => {
    setEditing(item);
    setFormData({
      id_conta_familia: item.id_conta_familia,
      nome_conta: item.nome_conta,
      parceiro_principal_id: item.parceiro_principal_id || '',
      programa_id: item.programa_id || '',
      status: item.status,
      obs: item.obs || ''
    });
    await loadMembros(item.id);
    setModalOpen(true);
  };

  const handleDelete = async (item: ContaFamilia) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir a conta família "${item.nome_conta}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        // Remove membros e histórico antes de excluir a conta
        await supabase.from('conta_familia_membros').delete().eq('conta_familia_id', item.id);
        await supabase.from('conta_familia_historico').delete().eq('conta_familia_id', item.id);
        const { error } = await supabase.from('conta_familia').delete().eq('id', item.id);
        if (error) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir a conta família.\n\n${error.message}`
          });
          return;
        }
        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'DELETE',
          linha_afetada: `Conta Família: ${item.nome_conta}`,
          dados_antes: item,
          dados_depois: null
        });
        loadData();
      }
    });
  };

  const handleAddMembro = async () => {
    if (!novoMembro.parceiro_id) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Atenção',
        message: 'Por favor, selecione um parceiro para adicionar.'
      });
      return;
    }

    if (!formData.programa_id) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Atenção',
        message: 'Selecione um programa antes de adicionar membros.'
      });
      return;
    }

    if (formData.parceiro_principal_id === novoMembro.parceiro_id) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiro Duplicado',
        message: 'Este parceiro já é o titular da conta e não pode ser adicionado como membro adicional.'
      });
      return;
    }

    if (membros.some(m => m.parceiro_id === novoMembro.parceiro_id)) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiro Duplicado',
        message: 'Este parceiro já foi adicionado como membro desta conta família.'
      });
      return;
    }

    const temContaNoPrograma = await verificarMembroTemContaNoPrograma(novoMembro.parceiro_id, formData.programa_id);
    if (!temContaNoPrograma) {
      const programaNome = programas.find(p => p.id === formData.programa_id)?.nome || 'este programa';
      const parceiro = parceiros.find(p => p.id === novoMembro.parceiro_id);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiro sem conta no programa',
        message: `${parceiro?.nome_parceiro || 'O parceiro selecionado'} não possui conta cadastrada no programa ${programaNome}.\n\nPara ser membro de uma conta família, o parceiro precisa ter pelo menos uma operação registrada neste programa.\n\nCadastre uma compra ou movimentação para este parceiro no programa ${programaNome} antes de adicioná-lo à conta família.`
      });
      return;
    }

    const jaEmFamilia = await verificarParceiroJaEmFamilia(novoMembro.parceiro_id, formData.programa_id, editing?.id);
    if (jaEmFamilia) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiro Indisponível',
        message: 'Este parceiro já está em outra conta família deste programa e não pode ser adicionado.'
      });
      return;
    }

    const bloqueio = await verificarParceiroBloqueado(novoMembro.parceiro_id, formData.programa_id);
    if (bloqueio.bloqueado) {
      const dataLib = new Date(bloqueio.dataLiberacao!).toLocaleDateString('pt-BR');
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Parceiro Bloqueado',
        message: `Este parceiro foi removido de uma família recentemente.\n\nEle poderá entrar em outra família deste programa somente após ${dataLib}.`
      });
      return;
    }

    const parceiro = parceiros.find(p => p.id === novoMembro.parceiro_id);
    const membro: Membro = {
      id: crypto.randomUUID(),
      parceiro_id: novoMembro.parceiro_id,
      data_inclusao: novoMembro.data_inclusao,
      data_exclusao: novoMembro.data_exclusao,
      status: novoMembro.status,
      parceiro_nome: parceiro?.nome_parceiro || ''
    };

    setMembros([...membros, membro]);
    setNovoMembro({
      parceiro_id: '',
      data_inclusao: new Date().toISOString().split('T')[0],
      data_exclusao: '',
      status: 'Ativo'
    });
  };

  const handleRemoveMembro = (id: string) => {
    const membro = membros.find(m => m.id === id);
    if (!membro) return;

    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Atenção: Bloqueio de 12 Meses',
      message: `Ao remover ${membro.parceiro_nome} desta conta família, ele(a) ficará BLOQUEADO(A) por 12 MESES.\n\nDurante este período, não poderá entrar em outra família deste programa.\n\nDeseja realmente remover?`,
      onConfirm: () => {
        setMembros(membros.filter(m => m.id !== id));
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.parceiro_principal_id && formData.programa_id) {
      const titularTemConta = await verificarMembroTemContaNoPrograma(formData.parceiro_principal_id, formData.programa_id);
      if (!titularTemConta) {
        const programaNome = programas.find(p => p.id === formData.programa_id)?.nome || 'este programa';
        const parceiro = parceiros.find(p => p.id === formData.parceiro_principal_id);
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Titular sem conta no programa',
          message: `${parceiro?.nome_parceiro || 'O parceiro selecionado'} não possui conta cadastrada no programa ${programaNome}.\n\nO titular da conta família precisa ter pelo menos uma operação registrada neste programa.\n\nCadastre uma compra ou movimentação antes de criar a conta família.`
        });
        return;
      }

      const jaEmFamilia = await verificarParceiroJaEmFamilia(formData.parceiro_principal_id, formData.programa_id, editing?.id);
      if (jaEmFamilia) {
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Parceiro Indisponível',
          message: 'Este parceiro já está em outra conta família deste programa e não pode ser o titular desta conta.'
        });
        return;
      }

      const bloqueio = await verificarParceiroBloqueado(formData.parceiro_principal_id, formData.programa_id);
      if (bloqueio.bloqueado) {
        const dataLib = new Date(bloqueio.dataLiberacao!).toLocaleDateString('pt-BR');
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Parceiro Bloqueado',
          message: `Este parceiro foi removido de uma família recentemente.\n\nEle poderá entrar em outra família deste programa somente após ${dataLib}.`
        });
        return;
      }
    }

    const data = {
      id_conta_familia: formData.id_conta_familia.trim(),
      nome_conta: formData.nome_conta.trim(),
      parceiro_principal_id: formData.parceiro_principal_id || null,
      programa_id: formData.programa_id || null,
      status: formData.status,
      obs: formData.obs
    };

    try {
      // Verifica duplicidade de id_conta_familia
      let idQuery = supabase
        .from('conta_familia')
        .select('id')
        .eq('id_conta_familia', data.id_conta_familia);
      if (editing) idQuery = idQuery.neq('id', editing.id);
      const { data: existentes } = await idQuery.limit(2);
      if (existentes && existentes.length > 0) {
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'ID já cadastrado',
          message: `Já existe uma conta família com o ID "${data.id_conta_familia}". Por favor, utilize um ID diferente.`
        });
        return;
      }

      let contaFamiliaId: string;

      if (editing) {
        const { error } = await supabase
          .from('conta_familia')
          .update(data)
          .eq('id', editing.id);
        if (error) throw error;
        contaFamiliaId = editing.id;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Conta Família: ${data.nome_conta}`,
          dados_antes: editing,
          dados_depois: data
        });

        const novosMembroIds = new Set(membros.map(m => m.parceiro_id));
        const membrosRemovidos = membrosOriginais.filter(m => !novosMembroIds.has(m.parceiro_id));

        if (membrosRemovidos.length > 0 && formData.programa_id) {
          const dataRemocao = new Date();
          const dataLiberacao = new Date();
          dataLiberacao.setMonth(dataLiberacao.getMonth() + 12);

          const historicoData = membrosRemovidos.map(membro => ({
            parceiro_id: membro.parceiro_id,
            programa_id: formData.programa_id,
            conta_familia_id: contaFamiliaId,
            data_remocao: dataRemocao.toISOString(),
            data_liberacao: dataLiberacao.toISOString(),
            removido_por: usuario?.nome || 'Sistema'
          }));

          await supabase
            .from('conta_familia_historico')
            .insert(historicoData);
        }

        await supabase
          .from('conta_familia_membros')
          .delete()
          .eq('conta_familia_id', contaFamiliaId);
      } else {
        const { data: newConta, error } = await supabase
          .from('conta_familia')
          .insert([data])
          .select()
          .single();
        if (error) throw error;
        contaFamiliaId = newConta.id;

        await supabase.from('logs').insert({
          usuario_id: usuario?.id,
          usuario_nome: usuario?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Conta Família: ${data.nome_conta}`,
          dados_antes: null,
          dados_depois: data
        });
      }

      if (membros.length > 0) {
        const membrosData = membros.map(m => ({
          conta_familia_id: contaFamiliaId,
          parceiro_id: m.parceiro_id,
          data_inclusao: m.data_inclusao,
          data_exclusao: m.data_exclusao || null,
          status: m.status
        }));

        const { error: membrosError } = await supabase
          .from('conta_familia_membros')
          .insert(membrosData);
        if (membrosError) throw membrosError;
      }

      setModalOpen(false);
      await loadData();

      if (expandedRows.has(contaFamiliaId)) {
        const { data: reloadedContas } = await supabase
          .from('conta_familia')
          .select('*')
          .eq('id', contaFamiliaId)
          .single();

        if (reloadedContas) {
          await loadMembrosForRow(reloadedContas);
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar a conta família.\n\n${error.message || 'Erro desconhecido'}`
      });
    }
  };

  const contasFiltradas = contas.filter(c =>
    (!filtroParceiro || (c.parceiro_nome || '').toLowerCase().includes(filtroParceiro.toLowerCase())) &&
    (!filtroPrograma || (c.programa_nome || '').toLowerCase().includes(filtroPrograma.toLowerCase())) &&
    (!filtroStatus || c.status === filtroStatus)
  );

  const parceirosUnicos = Array.from(new Set(contas.map(c => c.parceiro_nome).filter(Boolean))).sort() as string[];
  const programasUnicos = Array.from(new Set(contas.map(c => c.programa_nome).filter(Boolean))).sort() as string[];
  const statusUnicos = Array.from(new Set(contas.map(c => c.status).filter(Boolean))).sort() as string[];

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Conta Família</h2>
            <p className="text-sm text-slate-500 mt-0.5">Gerencie os registros de conta família</p>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            Adicionar
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100">
          <FilterBar
            filters={[
              { label: 'Parceiro', options: parceirosUnicos, value: filtroParceiro, onChange: setFiltroParceiro },
              { label: 'Programa', options: programasUnicos, value: filtroPrograma, onChange: setFiltroPrograma },
              { label: 'Status', options: statusUnicos, value: filtroStatus, onChange: setFiltroStatus },
            ]}
            onClear={() => { setFiltroParceiro(''); setFiltroPrograma(''); setFiltroStatus(''); }}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-12"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">ID Conta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Nome da Conta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Parceiro Principal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Programa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Observações</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {contasFiltradas.map((conta) => (
                  <>
                    <tr key={conta.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRowExpansion(conta)}
                          className="text-slate-600 hover:text-blue-600 transition-colors"
                          title="Ver membros adicionais"
                        >
                          {expandedRows.has(conta.id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{conta.id_conta_familia}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{conta.nome_conta}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{conta.parceiro_nome}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{conta.programa_nome}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            conta.status === 'Ativa'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {conta.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{conta.obs}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(conta)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(conta)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Excluir"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(conta.id) && (
                      <tr key={`${conta.id}-expanded`}>
                        <td colSpan={8} className="px-4 py-3 bg-slate-50">
                          <div className="pl-8">
                            <div className="flex items-center gap-2 mb-2">
                              <UsersIcon className="w-4 h-4 text-slate-600" />
                              <h4 className="text-sm font-medium text-slate-700">Membros Adicionais</h4>
                            </div>
                            {membrosMap[conta.id] && membrosMap[conta.id].length > 0 ? (
                              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Parceiro</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Data Inclusão</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Data Exclusão</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {membrosMap[conta.id].map((membro) => (
                                      <tr key={membro.id}>
                                        <td className="px-3 py-2 text-slate-800">{membro.parceiro_nome}</td>
                                        <td className="px-3 py-2 text-slate-600">
                                          {new Date(membro.data_inclusao).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">
                                          {membro.data_exclusao
                                            ? new Date(membro.data_exclusao).toLocaleDateString('pt-BR')
                                            : '-'}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                              membro.status === 'Ativo'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}
                                          >
                                            {membro.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 italic">Nenhum membro adicional cadastrado</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Conta Família' : 'Nova Conta Família'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ID Conta Família *
              </label>
              <input
                type="text"
                value={formData.id_conta_familia}
                onChange={(e) =>
                  setFormData({ ...formData, id_conta_familia: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: CF001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome da Conta *
              </label>
              <input
                type="text"
                value={formData.nome_conta}
                onChange={(e) =>
                  setFormData({ ...formData, nome_conta: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Família Silva"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Programa de Fidelidade *
              </label>
              <select
                value={formData.programa_id}
                onChange={(e) =>
                  setFormData({ ...formData, programa_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecione um programa</option>
                {programas.map((programa) => (
                  <option key={programa.id} value={programa.id}>
                    {programa.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Parceiro Principal *
              </label>
              {!formData.programa_id ? (
                <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500">
                  Selecione primeiro o programa
                </div>
              ) : (
                <>
                  <ParceiroSearch
                    parceiros={parceirosDisponiveis}
                    value={formData.parceiro_principal_id}
                    onChange={(parceiroId) => setFormData({ ...formData, parceiro_principal_id: parceiroId })}
                    placeholder="Digite para buscar parceiro..."
                  />
                  {parceirosDisponiveis.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">Nenhum parceiro disponível (todos já estão em outras contas família)</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Ativa">Ativa</option>
              <option value="Inativa">Inativa</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.obs}
              onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-700">Membros Adicionais</h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <ParceiroSearch
                    parceiros={parceirosAdicionaisDisponiveis.filter(p => p.id !== formData.parceiro_principal_id)}
                    value={novoMembro.parceiro_id}
                    onChange={(parceiroId) => setNovoMembro({ ...novoMembro, parceiro_id: parceiroId })}
                    placeholder="Selecione parceiro..."
                  />
                  {formData.programa_id && parceirosAdicionaisDisponiveis.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">Nenhum parceiro disponível (todos já estão em contas família)</p>
                  )}
                </div>
                <div className="col-span-3">
                  <input
                    type="date"
                    value={novoMembro.data_inclusao}
                    onChange={(e) =>
                      setNovoMembro({ ...novoMembro, data_inclusao: e.target.value })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="date"
                    value={novoMembro.data_exclusao}
                    onChange={(e) =>
                      setNovoMembro({ ...novoMembro, data_exclusao: e.target.value })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Data exclusão"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    type="button"
                    onClick={handleAddMembro}
                    className="w-full px-2 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {membros.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Parceiro</th>
                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Inclusão</th>
                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Exclusão</th>
                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Status</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {membros.map((membro) => (
                        <tr key={membro.id}>
                          <td className="px-3 py-2">{membro.parceiro_nome}</td>
                          <td className="px-3 py-2">
                            {new Date(membro.data_inclusao).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-3 py-2">
                            {membro.data_exclusao
                              ? new Date(membro.data_exclusao).toLocaleDateString('pt-BR')
                              : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                membro.status === 'Ativo'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {membro.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveMembro(membro.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
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
