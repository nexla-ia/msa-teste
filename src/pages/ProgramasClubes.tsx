import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Search, CheckCircle2, ExternalLink, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ParceiroSearch from '../components/ParceiroSearch';
import { useAuth } from '../contexts/AuthContext';
import { formatCPF, formatPhone, formatDate, formatCurrency, formatNumberInput, parseNumberInput } from '../lib/formatters';

interface Parceiro {
  id: string;
  nome_parceiro: string;
  telefone?: string;
  dt_nasc?: string;
  cpf?: string;
  rg?: string;
  email?: string;
}

interface Programa {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  valor_unitario?: number;
}

interface ContaFamilia {
  id: string;
  nome_conta: string;
  programa_id: string;
}

interface StatusPrograma {
  id: string;
  status: string;
  limite_cpfs_ano?: number;
}

interface Cartao {
  id: string;
  cartao: string;
}

interface ProgramaClube {
  id: string;
  parceiro_id?: string;
  nome_parceiro?: string;
  telefone?: string;
  dt_nasc?: string;
  cpf?: string;
  rg?: string;
  email?: string;
  idade?: number;
  programa_id?: string;
  n_fidelidade?: string;
  senha?: string;
  senha_resgate?: string;
  conta_familia_id?: string;
  data_exclusao_conta_familia?: string;
  tem_clube: boolean;
  clube_produto_id?: string;
  cartao?: string;
  data_ultima_assinatura?: string;
  dia_cobranca?: number;
  valor?: number;
  tempo_clube_mes?: number;
  liminar: boolean;
  aparelho?: string;
  downgrade_upgrade_data?: string;
  quantidade_pontos?: number;
  bonus_quantidade_pontos?: number;
  sequencia?: 'mensal' | 'trimestral' | 'anual';
  milhas_expirando?: string;
  milhas_expirando_data?: string;
  tipo_parceiro_fornecedor?: 'Parceiro' | 'Fornecedor';
  status_conta?: string;
  status_restricao?: 'Com Restrição' | 'Sem Restrição';
  conferente?: string;
  ultima_data_conferencia?: string;
  grupo_liminar?: string;
  status_programa_id?: string;
  observacoes?: string;
  tem_comissao: boolean;
  comissao_tipo?: 'porcentagem' | 'real';
  comissao_valor?: number;
}

export default function ProgramasClubes() {
  const { usuario } = useAuth();
  const [programasClubes, setProgramasClubes] = useState<ProgramaClube[]>([]);
  const [programasClubesFiltrados, setProgramasClubesFiltrados] = useState<ProgramaClube[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([]);
  const [contasFamilia, setContasFamilia] = useState<ContaFamilia[]>([]);
  const [contasFamiliaFiltradas, setContasFamiliaFiltradas] = useState<ContaFamilia[]>([]);
  const [statusProgramas, setStatusProgramas] = useState<StatusPrograma[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgramaClube | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<ProgramaClube>>({
    tem_clube: false,
    liminar: false,
    tem_comissao: false,
  });
  const [aparelhos, setAparelhos] = useState<string[]>([]);
  const [novoAparelho, setNovoAparelho] = useState('');
  const [temBonusRecorrente, setTemBonusRecorrente] = useState(false);
  const [temComissao, setTemComissao] = useState(false);
  const [parceiroTemContaFamilia, setParceiroTemContaFamilia] = useState(false);
  const [contaFamiliaEncontrada, setContaFamiliaEncontrada] = useState<string | null>(null);
  const [cpfsDisponiveis, setCpfsDisponiveis] = useState<number | null>(null);
  const [limiteStatusSelecionado, setLimiteStatusSelecionado] = useState<number>(0);

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
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.programa_id && programas.length > 0) {
      const programaSelecionado = programas.find(p => p.id === formData.programa_id);
      if (programaSelecionado) {
        const nomeProgramaNorm = programaSelecionado.nome.toLowerCase();
        const palavrasPrograma = nomeProgramaNorm.split(/[\s-]+/);

        const filtered = produtos.filter(produto => {
          const nomeProdutoNorm = produto.nome.toLowerCase();
          return palavrasPrograma.some(palavra => {
            if (palavra.length <= 2) return false;
            if (['airlines', 'brasil', 'fidelidade'].includes(palavra)) return false;
            return nomeProdutoNorm.includes(palavra);
          });
        });

        setProdutosFiltrados(filtered);
      }
    } else {
      setProdutosFiltrados([]);
    }
  }, [formData.programa_id, programas, produtos]);

  useEffect(() => {
    if (formData.programa_id && contasFamilia.length > 0) {
      const filtradas = contasFamilia.filter(cf => cf.programa_id === formData.programa_id);
      setContasFamiliaFiltradas(filtradas);

      // Se já há uma conta família selecionada, verifica se ela pertence ao programa
      if (formData.conta_familia_id) {
        const contaSelecionada = contasFamilia.find(cf => cf.id === formData.conta_familia_id);
        if (contaSelecionada && contaSelecionada.programa_id !== formData.programa_id) {
          // Limpa a seleção se a conta não pertence ao programa
          setFormData(prev => ({ ...prev, conta_familia_id: '' }));
        }
      }
    } else {
      setContasFamiliaFiltradas([]);
    }
  }, [formData.programa_id, contasFamilia]);

  useEffect(() => {
    if (formData.dt_nasc) {
      const idadeCalculada = calcularIdade(formData.dt_nasc);
      if (formData.idade !== idadeCalculada) {
        setFormData(prev => ({ ...prev, idade: idadeCalculada }));
      }
    } else if (formData.idade !== undefined && !formData.dt_nasc) {
      setFormData(prev => ({ ...prev, idade: undefined }));
    }
  }, [formData.dt_nasc, formData.idade]);

  useEffect(() => {
    if (formData.data_ultima_assinatura) {
      const [year, month, day] = formData.data_ultima_assinatura.split('T')[0].split('-');
      const dataAssinatura = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      const hoje = new Date();
      const diffTime = Math.abs(hoje.getTime() - dataAssinatura.getTime());
      const diffMeses = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
      if (formData.tempo_clube_mes !== diffMeses) {
        setFormData(prev => ({ ...prev, tempo_clube_mes: diffMeses }));
      }
    }
  }, [formData.data_ultima_assinatura, formData.tempo_clube_mes]);

  useEffect(() => {
    const termo = searchTerm.trim().toLowerCase();

    if (!termo) {
      setProgramasClubesFiltrados(programasClubes);
      return;
    }

    const filtrados = programasClubes.filter((item) => {
      const programaNome = programas.find(p => p.id === item.programa_id)?.nome?.toLowerCase() || '';
      const contaFamiliaNome = contasFamilia.find(cf => cf.id === item.conta_familia_id)?.nome_conta?.toLowerCase() || '';
      const clubeNome = produtos.find(p => p.id === item.clube_produto_id)?.nome?.toLowerCase() || '';
      const statusProgramaNome = statusProgramas.find(sp => sp.id === item.status_programa_id)?.status?.toLowerCase() || '';

      return (
        (item.nome_parceiro?.toLowerCase() || '').includes(termo) ||
        (item.cpf?.replace(/\D/g, '') || '').includes(termo.replace(/\D/g, '')) ||
        (item.telefone?.replace(/\D/g, '') || '').includes(termo.replace(/\D/g, '')) ||
        (item.email?.toLowerCase() || '').includes(termo) ||
        (item.n_fidelidade?.toLowerCase() || '').includes(termo) ||
        programaNome.includes(termo) ||
        contaFamiliaNome.includes(termo) ||
        clubeNome.includes(termo) ||
        (item.cartao?.toLowerCase() || '').includes(termo) ||
        (item.status_conta?.toLowerCase() || '').includes(termo) ||
        statusProgramaNome.includes(termo) ||
        (item.grupo_liminar?.toLowerCase() || '').includes(termo) ||
        (item.observacoes?.toLowerCase() || '').includes(termo)
      );
    });

    setProgramasClubesFiltrados(filtrados);
  }, [searchTerm, programasClubes, programas, contasFamilia, produtos, statusProgramas]);

  const fetchData = async () => {
    try {
      const [programasClubesRes, parceirosRes, programasRes, produtosRes, contasFamiliaRes, statusProgramasRes, cartoesRes] = await Promise.all([
        supabase.from('programas_clubes').select('*').order('created_at', { ascending: false }),
        supabase.from('parceiros').select('id, nome_parceiro, telefone, dt_nasc, cpf, rg, email').order('nome_parceiro'),
        supabase.from('programas_fidelidade').select('id, nome').order('nome'),
        supabase.from('produtos').select('id, nome, valor_unitario').order('nome'),
        supabase.from('conta_familia').select('id, nome_conta, programa_id').order('nome_conta'),
        supabase.from('status_programa').select('id, status').order('status'),
        supabase.from('cartoes_credito').select('id, cartao').order('cartao'),
      ]);

      if (programasClubesRes.data) setProgramasClubes(programasClubesRes.data);
      if (parceirosRes.data) setParceiros(parceirosRes.data);
      if (programasRes.data) setProgramas(programasRes.data);
      if (produtosRes.data) setProdutos(produtosRes.data);
      if (contasFamiliaRes.data) setContasFamilia(contasFamiliaRes.data);
      if (statusProgramasRes.data) setStatusProgramas(statusProgramasRes.data);
      if (cartoesRes.data) setCartoes(cartoesRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleParceiroChange = async (parceiroId: string) => {
    const parceiro = parceiros.find(p => p.id === parceiroId);
    if (parceiro) {
      const idade = parceiro.dt_nasc ? calcularIdade(parceiro.dt_nasc) : undefined;

      setFormData({
        ...formData,
        parceiro_id: parceiroId,
        nome_parceiro: parceiro.nome_parceiro,
        telefone: parceiro.telefone,
        dt_nasc: parceiro.dt_nasc,
        cpf: parceiro.cpf,
        rg: parceiro.rg,
        email: parceiro.email,
        idade,
      });
    }
  };

  const buscarContaFamiliaAtiva = async (parceiroId: string): Promise<string | null> => {
    const { data: contaComoTitular } = await supabase
      .from('conta_familia')
      .select('id')
      .eq('parceiro_principal_id', parceiroId)
      .eq('status', 'Ativa')
      .maybeSingle();

    if (contaComoTitular) {
      return contaComoTitular.id;
    }

    const { data: contaComoMembro } = await supabase
      .from('conta_familia_membros')
      .select('conta_familia_id, conta_familia!inner(id, status)')
      .eq('parceiro_id', parceiroId)
      .eq('status', 'Ativo')
      .maybeSingle();

    if (contaComoMembro && (contaComoMembro as any).conta_familia?.status === 'Ativa') {
      return contaComoMembro.conta_familia_id;
    }

    return null;
  };

  const handleClubeChange = (clubeId: string) => {
    const clube = produtos.find(p => p.id === clubeId);
    if (clube && clube.valor_unitario !== undefined) {
      setFormData({
        ...formData,
        clube_produto_id: clubeId,
        valor: clube.valor_unitario,
      });
    } else {
      setFormData({
        ...formData,
        clube_produto_id: clubeId,
      });
    }
  };

  const calcularIdade = (dataNasc: string): number => {
    const hoje = new Date();
    const [year, month, day] = dataNasc.split('T')[0].split('-');
    const nascimento = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade;
  };

  const verificarCpfsDisponiveis = async (parceiroId: string, programaId: string, statusProgramaId: string) => {
    if (!parceiroId || !programaId || !statusProgramaId) {
      setCpfsDisponiveis(null);
      return;
    }

    const statusSelecionado = statusProgramas.find(sp => sp.id === statusProgramaId);
    if (!statusSelecionado) {
      setCpfsDisponiveis(null);
      return;
    }

    setLimiteStatusSelecionado(statusSelecionado.limite_cpfs_ano || 0);

    if (!statusSelecionado.limite_cpfs_ano || statusSelecionado.limite_cpfs_ano === 0) {
      setCpfsDisponiveis(999999);
      return;
    }

    const { data, error } = await supabase
      .rpc('calcular_cpfs_disponiveis', {
        p_parceiro_id: parceiroId,
        p_programa_id: programaId,
        p_status_programa_id: statusProgramaId
      });

    if (error) {
      console.error('Erro ao calcular CPFs disponíveis:', error);
      setCpfsDisponiveis(null);
      return;
    }

    setCpfsDisponiveis(data);
  };

  const verificarPontosRetroativos = async (clubeId: string, dataAssinatura: string) => {
    const dataAssinaturaStr = dataAssinatura.split('T')[0];
    const [year, month, day] = dataAssinaturaStr.split('-').map(Number);
    const dataAssinaturaDate = new Date(year, month - 1, day);

    const hoje = new Date();
    const primeiroDiaMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

    console.log('Verificando pontos retroativos:', {
      dataAssinatura: dataAssinaturaStr,
      dataAssinaturaDate,
      primeiroDiaMesPassado,
      devePerguntar: dataAssinaturaDate < primeiroDiaMesPassado
    });

    if (dataAssinaturaDate < primeiroDiaMesPassado) {
      setDialogConfig({
        isOpen: true,
        type: 'confirm',
        title: 'Processar Pontos Retroativos?',
        message: `A data de assinatura (${formatDate(dataAssinatura)}) é anterior ao mês atual.\n\nDeseja adicionar os pontos de todos os meses desde a assinatura até agora?`,
        onConfirm: async () => {
          try {
            const { data, error } = await supabase.rpc('processar_pontos_retroativos', {
              p_clube_id: clubeId
            });

            if (error) throw error;

            const resultado = data[0];
            if (resultado.meses_processados > 0) {
              setDialogConfig({
                isOpen: true,
                type: 'success',
                title: 'Pontos Retroativos Creditados',
                message: `Sucesso! Foram creditados pontos de ${resultado.meses_processados} meses:\n\n` +
                  `• Pontos regulares: ${resultado.pontos_regulares_total.toLocaleString('pt-BR')}\n` +
                  `• Pontos bônus: ${resultado.pontos_bonus_total.toLocaleString('pt-BR')}\n` +
                  `• Total: ${resultado.pontos_total.toLocaleString('pt-BR')} pontos`
              });
            } else {
              setDialogConfig({
                isOpen: true,
                type: 'info',
                title: 'Nenhum Ponto para Processar',
                message: 'Não há pontos retroativos a serem processados. Todos os meses já foram creditados.'
              });
            }

            fetchData();
          } catch (error: any) {
            console.error('Erro ao processar pontos retroativos:', error);
            setDialogConfig({
              isOpen: true,
              type: 'error',
              title: 'Erro',
              message: `Erro ao processar pontos retroativos:\n\n${error.message || 'Erro desconhecido'}`
            });
          }
        }
      });
    }
  };

  const handleProcessarMesAtual = async (clube: ProgramaClube) => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Processar Pontos do Mês Atual?',
      message: `Deseja processar os pontos de clube do mês atual para ${clube.nome_parceiro}?\n\nIsso irá creditar os pontos imediatamente.`,
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.rpc('processar_pontos_mes_atual', {
            p_clube_id: clube.id
          });

          if (error) throw error;

          const resultado = data[0];
          if (resultado.processado) {
            setDialogConfig({
              isOpen: true,
              type: 'success',
              title: 'Pontos Processados',
              message: resultado.mensagem
            });
          } else {
            setDialogConfig({
              isOpen: true,
              type: 'info',
              title: 'Não Processado',
              message: resultado.mensagem
            });
          }

          fetchData();
        } catch (error: any) {
          console.error('Erro ao processar pontos do mês:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: `Erro ao processar pontos:\n\n${error.message || 'Erro desconhecido'}`
          });
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.n_fidelidade || !formData.senha) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Campos Obrigatórios',
        message: 'Por favor, preencha os campos obrigatórios:\n\nN° Fidelidade\nSenha'
      });
      return;
    }

    if (!editingItem && !formData.tem_clube && formData.parceiro_id && formData.programa_id && formData.status_programa_id) {
      const { data: podeEmitir, error } = await supabase
        .rpc('pode_emitir_cpf', {
          p_parceiro_id: formData.parceiro_id,
          p_programa_id: formData.programa_id,
          p_status_programa_id: formData.status_programa_id
        });

      if (error) {
        console.error('Erro ao verificar limite de CPFs:', error);
      } else if (!podeEmitir) {
        const statusNome = statusProgramas.find(sp => sp.id === formData.status_programa_id)?.status || 'Status';
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Limite de CPFs Atingido',
          message: `Você atingiu o limite de CPFs que podem ser emitidos neste programa com o status "${statusNome}" durante o ano atual.\n\nLimite anual: ${limiteStatusSelecionado} CPFs\nCPFs disponíveis: 0\n\nEste limite resetará no início do próximo ano.`
        });
        return;
      }
    }

    if (formData.tem_clube && !formData.quantidade_pontos) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Campo Obrigatório',
        message: 'Quantidade de pontos é obrigatória quando tem clube ativo'
      });
      return;
    }

    if (formData.comissao_valor && formData.comissao_tipo === 'porcentagem' && formData.comissao_valor > 100) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Valor Inválido',
        message: 'O campo Comissão (%) não pode ser maior que 100%'
      });
      return;
    }

    if (formData.valor && formData.valor > 99999999.99) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Valor Inválido',
        message: 'O campo Valor não pode ser maior que R$ 99.999.999,99'
      });
      return;
    }

    if (formData.comissao_valor && formData.comissao_valor > 99999999.99) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Valor Inválido',
        message: 'O campo Comissão não pode ser maior que R$ 99.999.999,99'
      });
      return;
    }

    if (formData.quantidade_pontos && formData.quantidade_pontos > 2147483647) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Valor Inválido',
        message: 'O campo Quantidade de Pontos não pode ser maior que 2.147.483.647'
      });
      return;
    }

    try {
      if (!editingItem && formData.parceiro_id && formData.programa_id) {
        console.log('Verificando duplicata antes de inserir...');
        console.log('Parceiro ID:', formData.parceiro_id);
        console.log('Programa ID:', formData.programa_id);

        const { data: existente, error: checkError } = await supabase
          .from('programas_clubes')
          .select('id, parceiro_id, programa_id')
          .eq('parceiro_id', formData.parceiro_id)
          .eq('programa_id', formData.programa_id)
          .maybeSingle();

        if (checkError) {
          console.error('Erro ao verificar duplicata:', checkError);
          throw new Error(`Erro ao verificar duplicata: ${checkError.message}`);
        }

        console.log('Resultado da verificação:', existente);

        if (existente) {
          const programaNome = programas.find(p => p.id === formData.programa_id)?.nome || 'programa';
          const parceiroNome = parceiros.find(p => p.id === formData.parceiro_id)?.nome_parceiro || 'parceiro';

          console.log('Registro duplicado encontrado! ID:', existente.id);

          setDialogConfig({
            isOpen: true,
            type: 'warning',
            title: 'Registro Já Existe',
            message: `Este parceiro já está cadastrado neste programa.\n\nParceiro: ${parceiroNome}\nPrograma: ${programaNome}\n\nUm parceiro só pode ter um único registro por programa.\nPara fazer alterações, edite o registro existente na lista.`
          });
          return;
        }

        console.log('Nenhuma duplicata encontrada. Prosseguindo com insert...');
      }

      const dataToSave = {
        ...formData,
        parceiro_id: formData.parceiro_id || null,
        programa_id: formData.programa_id || null,
        clube_produto_id: formData.clube_produto_id || null,
        conta_familia_id: formData.conta_familia_id || null,
        status_programa_id: formData.status_programa_id || null,
        aparelho: aparelhos.length > 0 ? aparelhos.join(', ') : undefined,
        conferente: usuario?.nome,
        ultima_data_conferencia: new Date().toISOString().split('T')[0],
      };

      let clubeIdSalvo: string | null = null;

      if (editingItem) {
        const { error } = await supabase
          .from('programas_clubes')
          .update(dataToSave)
          .eq('id', editingItem.id);
        if (error) throw error;
        clubeIdSalvo = editingItem.id;
      } else {
        const { data: clubeInserido, error } = await supabase
          .from('programas_clubes')
          .insert([dataToSave])
          .select('id')
          .single();
        if (error) throw error;
        clubeIdSalvo = clubeInserido.id;
      }

      const deveVerificarRetroativos = !editingItem && formData.tem_clube && formData.data_ultima_assinatura && clubeIdSalvo;
      const dataAssinaturaParaVerificar = formData.data_ultima_assinatura;

      console.log('Verificação pós-save:', {
        editingItem: !!editingItem,
        tem_clube: formData.tem_clube,
        data_ultima_assinatura: formData.data_ultima_assinatura,
        clubeIdSalvo,
        deveVerificarRetroativos
      });

      handleCloseModal();
      fetchData();

      if (deveVerificarRetroativos && dataAssinaturaParaVerificar && clubeIdSalvo) {
        console.log('Agendando verificação de pontos retroativos...');
        setTimeout(() => {
          verificarPontosRetroativos(clubeIdSalvo!, dataAssinaturaParaVerificar);
        }, 300);
      }
    } catch (error: any) {
      console.error('Erro ao salvar:', error);

      let errorMessage = 'Não foi possível salvar o registro.';
      let errorTitle = 'Erro ao Salvar';

      if (error.message && error.message.includes('programas_clubes_parceiro_programa_unique')) {
        const programaNome = programas.find(p => p.id === formData.programa_id)?.nome || 'programa';
        const parceiroNome = parceiros.find(p => p.id === formData.parceiro_id)?.nome_parceiro || 'parceiro';

        errorTitle = 'Registro Duplicado';
        errorMessage = `Este parceiro já está cadastrado neste programa.\n\n📋 Parceiro: ${parceiroNome}\n🎯 Programa: ${programaNome}\n\n✓ Um parceiro só pode ter um único registro por programa.\n✓ Para fazer alterações, edite o registro existente.`;
      } else {
        errorMessage = `${errorMessage}\n\n${error.message || 'Erro desconhecido'}\n\nVerifique se todos os campos obrigatórios estão preenchidos corretamente.`;
      }

      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: errorTitle,
        message: errorMessage
      });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({ tem_clube: false, liminar: false, tem_comissao: false });
    setAparelhos([]);
    setNovoAparelho('');
    setTemComissao(false);
    setParceiroTemContaFamilia(false);
    setContaFamiliaEncontrada(null);
  };

  const handleEdit = async (item: ProgramaClube) => {
    setEditingItem(item);
    setFormData(item);
    if (item.aparelho) {
      setAparelhos(item.aparelho.split(',').map(a => a.trim()));
    } else {
      setAparelhos([]);
    }
    setTemBonusRecorrente(!!(item.sequencia || item.bonus_quantidade_pontos));
    setTemComissao(!!(item.tem_comissao));

    if (item.parceiro_id) {
      const contaFamiliaId = await buscarContaFamiliaAtiva(item.parceiro_id);
      setParceiroTemContaFamilia(!!contaFamiliaId);
      setContaFamiliaEncontrada(contaFamiliaId);
    }

    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const itemToDelete = programasClubes.find(item => item.id === id);
    const parceiroNome = itemToDelete?.nome_parceiro || 'Parceiro';
    const programaNome = programas.find(p => p.id === itemToDelete?.programa_id)?.nome || 'Programa';

    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Tem certeza que deseja excluir este registro?\n\nParceiro: ${parceiroNome}\nPrograma: ${programaNome}\n\nEsta ação não pode ser desfeita e irá remover também todas as atividades pendentes relacionadas.`,
      onConfirm: async () => {
        try {
          console.log('Iniciando delete do registro:', id);

          const { error } = await supabase
            .from('programas_clubes')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Erro ao deletar:', error);
            throw error;
          }

          console.log('Delete realizado com sucesso');

          const { data: verificacao } = await supabase
            .from('programas_clubes')
            .select('id')
            .eq('id', id)
            .maybeSingle();

          if (verificacao) {
            console.error('ALERTA: Registro ainda existe após delete!', verificacao);
            throw new Error('O registro não foi deletado corretamente do banco de dados');
          }

          console.log('Verificação confirmada: registro não existe mais no banco');

          await fetchData();

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Registro Excluído',
            message: `O registro foi excluído com sucesso.\n\nParceiro: ${parceiroNome}\nPrograma: ${programaNome}`
          });
        } catch (error: any) {
          console.error('Erro ao excluir:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir o registro.\n\n${error.message || 'Erro desconhecido'}`
          });
        }
      }
    });
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

  if (loading) {
    return <div className="flex justify-center items-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Programas/Clubes</h1>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({ tem_clube: false, liminar: false, tem_comissao: false });
            setAparelhos([]);
            setNovoAparelho('');
            setTemBonusRecorrente(false);
            setTemComissao(false);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Registro
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por parceiro, CPF, programa, cartão, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
          {programasClubesFiltrados.length !== programasClubes.length && (
            <span className="text-sm text-slate-500">
              {programasClubesFiltrados.length} de {programasClubes.length} resultados
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Parceiro</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Telefone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Programa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">N° Fidelidade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Senha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Senha Resgate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Conta Família</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Data Exclusão CF</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Tem Clube</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Clube</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Cartão</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Data Assinatura</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Dia Cobrança</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Tempo Clube</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Liminar</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Comissão</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Aparelhos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Down/UpGrade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Pontos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Bônus (Pontos)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Sequência</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Milhas Expirando</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Parc/Forn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Status Conta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Status Restrição</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Conferente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Últ. Conferência</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Grupo Liminar</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Status Programa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Observações</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap sticky right-0 bg-slate-50">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {programasClubesFiltrados.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.nome_parceiro || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{formatPhone(item.telefone)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                    {programas.find(p => p.id === item.programa_id)?.nome || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.n_fidelidade || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.senha || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.senha_resgate || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                    {contasFamilia.find(cf => cf.id === item.conta_familia_id)?.nome_conta || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{formatDate(item.data_exclusao_conta_familia)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.tem_clube ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                    {produtos.find(p => p.id === item.clube_produto_id)?.nome || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.cartao || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{formatDate(item.data_ultima_assinatura)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.dia_cobranca || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.valor ? formatCurrency(item.valor) : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.tempo_clube_mes ? `${item.tempo_clube_mes} meses` : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.liminar ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                    {item.tem_comissao && item.comissao_valor
                      ? `${item.comissao_tipo === 'porcentagem' ? `${item.comissao_valor}%` : formatCurrency(item.comissao_valor)}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.aparelho || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.downgrade_upgrade_data ? formatDate(item.downgrade_upgrade_data) : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.quantidade_pontos ? item.quantidade_pontos.toLocaleString('pt-BR') : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.bonus_quantidade_pontos ? item.bonus_quantidade_pontos.toLocaleString('pt-BR') : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.sequencia || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.milhas_expirando_data ? formatDate(item.milhas_expirando_data) : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.tipo_parceiro_fornecedor || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.status_conta || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.status_restricao || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.conferente || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{formatDate(item.ultima_data_conferencia)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.grupo_liminar || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                    {statusProgramas.find(sp => sp.id === item.status_programa_id)?.status || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 max-w-xs truncate">{item.observacoes || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2 sticky right-0 bg-white">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-900" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {item.tem_clube && (
                      <button
                        onClick={() => handleProcessarMesAtual(item)}
                        className="text-green-600 hover:text-green-900"
                        title="Processar pontos do mês atual"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingItem ? 'Editar Programa/Clube' : 'Novo Programa/Clube'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Parceiro</label>
              <ParceiroSearch
                parceiros={parceiros}
                value={formData.parceiro_id || ''}
                onChange={(parceiroId) => handleParceiroChange(parceiroId)}
                placeholder="Digite para buscar parceiro..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input
                type="text"
                value={formatPhone(formData.telefone)}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Nascimento</label>
              <input
                type="text"
                value={formData.dt_nasc ? formatDate(formData.dt_nasc) : '-'}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
              <input
                type="text"
                value={formatCPF(formData.cpf)}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">RG</label>
              <input
                type="text"
                value={formData.rg || ''}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Idade</label>
              <input
                type="number"
                value={formData.idade || ''}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Programa</label>
              <select
                value={formData.programa_id || ''}
                onChange={(e) => setFormData({ ...formData, programa_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um programa</option>
                {programas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">N° Fidelidade <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.n_fidelidade || ''}
                onChange={(e) => setFormData({ ...formData, n_fidelidade: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.senha || ''}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha de Resgate</label>
              <input
                type="text"
                value={formData.senha_resgate || ''}
                onChange={(e) => setFormData({ ...formData, senha_resgate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Conta Família
                {parceiroTemContaFamilia && contaFamiliaEncontrada && (
                  <span className="ml-2 inline-flex items-center text-xs text-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Preenchido automaticamente
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.conta_familia_id || ''}
                  onChange={(e) => setFormData({ ...formData, conta_familia_id: e.target.value })}
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    parceiroTemContaFamilia && contaFamiliaEncontrada
                      ? 'border-green-300 bg-green-50'
                      : 'border-slate-300'
                  }`}
                  disabled={parceiroTemContaFamilia && contaFamiliaEncontrada}
                >
                  <option value="">Selecione</option>
                  {contasFamiliaFiltradas.map((cf) => (
                    <option key={cf.id} value={cf.id}>{cf.nome_conta}</option>
                  ))}
                </select>
                {formData.parceiro_id && !parceiroTemContaFamilia && (
                  <a
                    href="/conta-familia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                    title="Criar nova conta família"
                  >
                    <Plus className="w-4 h-4" />
                    Criar
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {formData.conta_familia_id && (
                  <a
                    href="/conta-familia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center"
                    title="Ver conta família"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              {parceiroTemContaFamilia && contaFamiliaEncontrada && (
                <p className="text-xs text-green-600 mt-1">
                  Este parceiro já está em uma conta família. O campo foi preenchido automaticamente.
                </p>
              )}
              {formData.parceiro_id && !parceiroTemContaFamilia && !formData.conta_familia_id && (
                <p className="text-xs text-blue-600 mt-1">
                  Este parceiro não está em nenhuma conta família. Clique em "Criar" para adicionar.
                </p>
              )}
              {formData.programa_id && contasFamiliaFiltradas.length === 0 && !parceiroTemContaFamilia && (
                <p className="text-xs text-amber-600 mt-1">
                  Não há contas família cadastradas para o programa selecionado. Crie uma nova conta família.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Exclusão Conta Família</label>
              <input
                type="date"
                value={formData.data_exclusao_conta_familia || ''}
                onChange={(e) => setFormData({ ...formData, data_exclusao_conta_familia: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Tem Clube?</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.tem_clube === true}
                    onChange={() => setFormData({ ...formData, tem_clube: true })}
                    className="mr-2"
                  />
                  Sim
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.tem_clube === false}
                    onChange={() => setFormData({ ...formData, tem_clube: false })}
                    className="mr-2"
                  />
                  Não
                </label>
              </div>
            </div>

            {formData.tem_clube && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Clube</label>
                  <select
                    value={formData.clube_produto_id || ''}
                    onChange={(e) => handleClubeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um clube</option>
                    {produtosFiltrados.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cartão</label>
                  <select
                    value={formData.cartao || ''}
                    onChange={(e) => setFormData({ ...formData, cartao: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um cartão</option>
                    {cartoes.map((c) => (
                      <option key={c.id} value={c.cartao}>{c.cartao}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Última Assinatura</label>
                  <input
                    type="date"
                    value={formData.data_ultima_assinatura || ''}
                    onChange={(e) => setFormData({ ...formData, data_ultima_assinatura: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dia da Cobrança</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_cobranca || ''}
                    onChange={(e) => setFormData({ ...formData, dia_cobranca: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor || ''}
                    onChange={(e) => {
                      const valorNumerico = parseFloat(e.target.value) || 0;
                      setFormData({ ...formData, valor: valorNumerico });
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">Valor puxado do cartão, mas pode ser editado</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tempo de Clube (meses)</label>
                  <input
                    type="number"
                    value={formData.tempo_clube_mes || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Calculado automaticamente pela data da última assinatura</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Comissão</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={temComissao === true}
                        onChange={() => {
                          setTemComissao(true);
                          setFormData({ ...formData, tem_comissao: true });
                        }}
                        className="mr-2"
                      />
                      Sim
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={temComissao === false}
                        onChange={() => {
                          setTemComissao(false);
                          setFormData({ ...formData, tem_comissao: false, comissao_tipo: undefined, comissao_valor: undefined });
                        }}
                        className="mr-2"
                      />
                      Não
                    </label>
                  </div>

                  {temComissao && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                        <select
                          value={formData.comissao_tipo || ''}
                          onChange={(e) => setFormData({ ...formData, comissao_tipo: e.target.value as 'porcentagem' | 'real' })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione</option>
                          <option value="porcentagem">Porcentagem</option>
                          <option value="real">Real (R$)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Valor {formData.comissao_tipo === 'porcentagem' && <span className="text-xs text-slate-500">Máx: 100%</span>}
                        </label>
                        <input
                          type="text"
                          value={
                            formData.comissao_valor
                              ? formData.comissao_tipo === 'porcentagem'
                                ? `${formData.comissao_valor}%`
                                : formatCurrency(formData.comissao_valor)
                              : ''
                          }
                          onChange={(e) => {
                            if (formData.comissao_tipo === 'porcentagem') {
                              const rawValue = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                              const numValue = rawValue ? parseFloat(rawValue) : undefined;
                              if (numValue === undefined || numValue <= 100) {
                                setFormData({ ...formData, comissao_valor: numValue });
                              }
                            } else {
                              const rawValue = e.target.value.replace(/\D/g, '');
                              const numValue = rawValue ? parseFloat(rawValue) / 100 : undefined;
                              if (numValue === undefined || numValue <= 99999999.99) {
                                setFormData({ ...formData, comissao_valor: numValue });
                              }
                            }
                          }}
                          placeholder={formData.comissao_tipo === 'porcentagem' ? '0%' : 'R$ 0,00'}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Aparelhos</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={novoAparelho}
                      onChange={(e) => setNovoAparelho(e.target.value)}
                      placeholder="Nome do aparelho"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (novoAparelho.trim()) {
                          setAparelhos([...aparelhos, novoAparelho.trim()]);
                          setNovoAparelho('');
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  {aparelhos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {aparelhos.map((aparelho, index) => (
                        <div key={index} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full">
                          <span className="text-sm">{aparelho}</span>
                          <button
                            type="button"
                            onClick={() => setAparelhos(aparelhos.filter((_, i) => i !== index))}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    DownGrade/UpGrade
                    <span className="text-xs text-slate-500 ml-2">Data para lembrete de downgrade/upgrade</span>
                  </label>
                  <input
                    type="date"
                    value={formData.downgrade_upgrade_data || ''}
                    onChange={(e) => setFormData({ ...formData, downgrade_upgrade_data: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Pontos <span className="text-xs text-slate-500">Máx: 2.147.483.647</span></label>
                  <input
                    type="text"
                    value={formData.quantidade_pontos ? formData.quantidade_pontos.toLocaleString('pt-BR') : ''}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, '');
                      const numValue = rawValue ? parseInt(rawValue, 10) : undefined;
                      if (numValue === undefined || numValue <= 2147483647) {
                        setFormData({ ...formData, quantidade_pontos: numValue });
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bônus Recorrente</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={temBonusRecorrente === true}
                        onChange={() => setTemBonusRecorrente(true)}
                        className="mr-2"
                      />
                      Sim
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={temBonusRecorrente === false}
                        onChange={() => {
                          setTemBonusRecorrente(false);
                          setFormData({ ...formData, sequencia: undefined, bonus_quantidade_pontos: undefined });
                        }}
                        className="mr-2"
                      />
                      Não
                    </label>
                  </div>

                  {temBonusRecorrente && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Frequência</label>
                        <select
                          value={formData.sequencia || ''}
                          onChange={(e) => setFormData({ ...formData, sequencia: e.target.value as 'mensal' | 'trimestral' | 'anual' })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione</option>
                          <option value="mensal">Mensal</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Bônus (Pontos)</label>
                        <input
                          type="text"
                          value={formData.bonus_quantidade_pontos ? formatNumberInput(formData.bonus_quantidade_pontos.toString()) : ''}
                          onChange={(e) => {
                            const numValue = e.target.value ? parseNumberInput(e.target.value) : undefined;
                            setFormData({ ...formData, bonus_quantidade_pontos: numValue });
                          }}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Milhas Expirando</label>
                  <input
                    type="date"
                    value={formData.milhas_expirando_data || ''}
                    onChange={(e) => setFormData({ ...formData, milhas_expirando_data: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">Data para lembrete automático de milhas expirando</p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Liminar</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.liminar === true}
                    onChange={() => setFormData({ ...formData, liminar: true })}
                    className="mr-2"
                  />
                  Sim
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.liminar === false}
                    onChange={() => setFormData({ ...formData, liminar: false })}
                    className="mr-2"
                  />
                  Não
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parceiro/Fornecedor</label>
              <select
                value={formData.tipo_parceiro_fornecedor || ''}
                onChange={(e) => setFormData({ ...formData, tipo_parceiro_fornecedor: e.target.value as 'Parceiro' | 'Fornecedor' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                <option value="Parceiro">Parceiro</option>
                <option value="Fornecedor">Fornecedor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status da Conta</label>
              <select
                value={formData.status_conta || ''}
                onChange={(e) => setFormData({ ...formData, status_conta: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {statusContaOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status de Restrição</label>
              <select
                value={formData.status_restricao || ''}
                onChange={(e) => setFormData({ ...formData, status_restricao: e.target.value as 'Com Restrição' | 'Sem Restrição' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                <option value="Com Restrição">Com Restrição</option>
                <option value="Sem Restrição">Sem Restrição</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grupo Liminar</label>
              <input
                type="text"
                value={formData.grupo_liminar || ''}
                onChange={(e) => setFormData({ ...formData, grupo_liminar: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Status No Programa</label>
              <select
                value={formData.status_programa_id || ''}
                onChange={(e) => {
                  const statusId = e.target.value;
                  setFormData({ ...formData, status_programa_id: statusId });
                  if (formData.parceiro_id && formData.programa_id && statusId) {
                    verificarCpfsDisponiveis(formData.parceiro_id, formData.programa_id, statusId);
                  } else {
                    setCpfsDisponiveis(null);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {statusProgramas.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.status} {sp.limite_cpfs_ano ? `(Limite: ${sp.limite_cpfs_ano} CPFs/ano)` : ''}
                  </option>
                ))}
              </select>
              {cpfsDisponiveis !== null && limiteStatusSelecionado > 0 && !formData.tem_clube && (
                <div className={`mt-2 p-3 rounded-lg ${cpfsDisponiveis === 0 ? 'bg-red-50 border border-red-200' : cpfsDisponiveis <= 5 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${cpfsDisponiveis === 0 ? 'bg-red-500' : cpfsDisponiveis <= 5 ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                    <p className={`text-sm font-medium ${cpfsDisponiveis === 0 ? 'text-red-700' : cpfsDisponiveis <= 5 ? 'text-amber-700' : 'text-green-700'}`}>
                      {cpfsDisponiveis === 0 ? (
                        'Limite de CPFs atingido!'
                      ) : cpfsDisponiveis <= 5 ? (
                        `Atenção: Restam apenas ${cpfsDisponiveis} CPFs disponíveis`
                      ) : cpfsDisponiveis === 999999 ? (
                        'CPFs Ilimitados'
                      ) : (
                        `${cpfsDisponiveis} CPFs disponíveis de ${limiteStatusSelecionado}`
                      )}
                    </p>
                  </div>
                  {cpfsDisponiveis > 0 && cpfsDisponiveis < 999999 && (
                    <div className="mt-2">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${cpfsDisponiveis <= 5 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${(cpfsDisponiveis / limiteStatusSelecionado) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-600 mt-2">
                    Este limite é por parceiro e reseta anualmente
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea
                value={formData.observacoes || ''}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingItem ? 'Salvar' : 'Criar'}
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
