import { useState, useEffect } from 'react';
import { Bell, Check, X, Trash2, AlertTriangle, Calendar, Award, Loader, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

interface Atividade {
  id: string;
  tipo_atividade: string;
  tipo_lembrete: string;
  titulo: string;
  descricao: string;
  descricao_completa?: string;
  parceiro_nome: string;
  programa_nome: string;
  quantidade_pontos: number;
  data_prevista: string;
  prioridade: string;
  status: string;
  pode_excluir: boolean;
  observacoes?: string;
  referencia_id?: string;
  referencia_tabela?: string;
}

const TIPO_LEMBRETE_LABELS: Record<string, string> = {
  'downgrade_verificar': 'Verificar Downgrade',
  'credito_pontos_conferir': 'Conferir Crédito de Pontos',
  'milhas_expirando': 'Milhas Expirando',
  'vencimento_clube': 'Vencimento de Clube',
  'pagamento_pendente': 'Pagamento Pendente',
  'transferencia_conferir': 'Conferir Transferência',
  'outro': 'Outro'
};

const PRIORIDADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'alta': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'média': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'baixa': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'normal': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' }
};

export default function Atividades() {
  const { usuario } = useAuth();
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'pendente' | 'concluído' | 'todos'>('pendente');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<Atividade | null>(null);

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
    loadAtividades();
  }, [filtroStatus]);

  const loadAtividades = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('atividades')
        .select('*')
        .order('data_prevista', { ascending: true })
        .order('prioridade', { ascending: false });

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAtividades(data || []);
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível carregar as atividades.'
      });
    } finally {
      setLoading(false);
    }
  };

  const marcarComoConcluido = async (atividadeId: string) => {
    try {
      const { error } = await supabase
        .from('atividades')
        .update({
          status: 'concluído',
          data_conclusao: new Date().toISOString(),
          concluido_por: usuario?.id
        })
        .eq('id', atividadeId);

      if (error) throw error;

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'Lembrete marcado como concluído!'
      });

      loadAtividades();
    } catch (error) {
      console.error('Erro ao marcar como concluído:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível concluir o lembrete.'
      });
    }
  };

  const cancelarLembrete = async (atividadeId: string) => {
    try {
      const { error } = await supabase
        .from('atividades')
        .update({
          status: 'cancelado',
          data_conclusao: new Date().toISOString(),
          concluido_por: usuario?.id
        })
        .eq('id', atividadeId);

      if (error) throw error;

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'Lembrete cancelado!'
      });

      loadAtividades();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível cancelar o lembrete.'
      });
    }
  };

  const excluirLembrete = async (atividadeId: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir este lembrete? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('atividades')
            .delete()
            .eq('id', atividadeId);

          if (error) throw error;

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Sucesso',
            message: 'Lembrete excluído com sucesso!'
          });

          loadAtividades();
        } catch (error) {
          console.error('Erro ao excluir:', error);
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: 'Não foi possível excluir o lembrete.'
          });
        }
      }
    });
  };

  const visualizarDetalhes = (atividade: Atividade) => {
    setAtividadeSelecionada(atividade);
    setIsModalOpen(true);
  };

  const atividadesFiltradas = atividades.filter(a => {
    if (filtroPrioridade !== 'todas' && a.prioridade !== filtroPrioridade) {
      return false;
    }
    return true;
  });

  const calcularDiasRestantes = (data: string): number => {
    const hoje = new Date();
    const dataAlvo = new Date(data);
    const diff = Math.ceil((dataAlvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getPrioridadeColor = (prioridade: string) => {
    return PRIORIDADE_COLORS[prioridade] || PRIORIDADE_COLORS['normal'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-800">Lembretes e Notificações</h1>
        </div>
        <p className="text-slate-600">Gerencie suas tarefas e lembretes do sistema</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroStatus('pendente')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filtroStatus === 'pendente'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setFiltroStatus('concluído')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filtroStatus === 'concluído'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Concluídos
              </button>
              <button
                onClick={() => setFiltroStatus('todos')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filtroStatus === 'todos'
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Prioridade</label>
            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todas">Todas</option>
              <option value="alta">Alta</option>
              <option value="média">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>
      </div>

      {atividadesFiltradas.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum lembrete encontrado</h3>
          <p className="text-slate-500">
            {filtroStatus === 'pendente'
              ? 'Você não tem lembretes pendentes no momento.'
              : 'Nenhum lembrete encontrado com os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {atividadesFiltradas.map((atividade) => {
            const diasRestantes = calcularDiasRestantes(atividade.data_prevista);
            const prioridadeStyle = getPrioridadeColor(atividade.prioridade);

            return (
              <div
                key={atividade.id}
                className={`bg-white rounded-lg shadow-sm border-2 ${prioridadeStyle.border} p-6 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${prioridadeStyle.bg} ${prioridadeStyle.text}`}>
                        {atividade.prioridade.toUpperCase()}
                      </span>
                      {atividade.tipo_lembrete && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {TIPO_LEMBRETE_LABELS[atividade.tipo_lembrete] || atividade.tipo_lembrete}
                        </span>
                      )}
                      {atividade.status === 'concluído' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Concluído
                        </span>
                      )}
                      {atividade.status === 'cancelado' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Cancelado
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-slate-800 mb-2">{atividade.titulo}</h3>

                    {atividade.descricao && (
                      <p className="text-slate-600 mb-3">{atividade.descricao}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      {atividade.parceiro_nome && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Parceiro:</span>
                          <span>{atividade.parceiro_nome}</span>
                        </div>
                      )}
                      {atividade.programa_nome && (
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4" />
                          <span>{atividade.programa_nome}</span>
                        </div>
                      )}
                      {atividade.quantidade_pontos > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Pontos:</span>
                          <span>{atividade.quantidade_pontos.toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                    </div>

                    {atividade.data_prevista && (
                      <div className="flex items-center gap-2 mt-3">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">
                          {new Date(atividade.data_prevista + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        {atividade.status === 'pendente' && (
                          <span
                            className={`text-sm font-medium ${
                              diasRestantes < 0
                                ? 'text-red-600'
                                : diasRestantes === 0
                                ? 'text-orange-600'
                                : diasRestantes <= 3
                                ? 'text-yellow-600'
                                : 'text-green-600'
                            }`}
                          >
                            {diasRestantes < 0
                              ? `Atrasado ${Math.abs(diasRestantes)} ${Math.abs(diasRestantes) === 1 ? 'dia' : 'dias'}`
                              : diasRestantes === 0
                              ? 'Hoje'
                              : diasRestantes === 1
                              ? 'Amanhã'
                              : `Faltam ${diasRestantes} dias`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {atividade.status === 'pendente' && (
                      <>
                        <button
                          onClick={() => marcarComoConcluido(atividade.id)}
                          className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                          title="Marcar como concluído"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => cancelarLembrete(atividade.id)}
                          className="p-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                          title="Cancelar lembrete"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    {atividade.pode_excluir && (
                      <button
                        onClick={() => excluirLembrete(atividade.id)}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        title="Excluir lembrete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    {(atividade.descricao_completa || atividade.observacoes) && (
                      <button
                        onClick={() => visualizarDetalhes(atividade)}
                        className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs font-medium"
                        title="Ver detalhes"
                      >
                        Detalhes
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && atividadeSelecionada && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setAtividadeSelecionada(null);
          }}
          title="Detalhes do Lembrete"
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-700 mb-2">Título</h3>
              <p className="text-slate-600">{atividadeSelecionada.titulo}</p>
            </div>

            {atividadeSelecionada.descricao && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Descrição</h3>
                <p className="text-slate-600">{atividadeSelecionada.descricao}</p>
              </div>
            )}

            {atividadeSelecionada.descricao_completa && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Descrição Completa</h3>
                <p className="text-slate-600 whitespace-pre-wrap">{atividadeSelecionada.descricao_completa}</p>
              </div>
            )}

            {atividadeSelecionada.observacoes && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Observações</h3>
                <p className="text-slate-600 whitespace-pre-wrap">{atividadeSelecionada.observacoes}</p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              {atividadeSelecionada.status === 'pendente' && (
                <>
                  <button
                    onClick={() => {
                      marcarComoConcluido(atividadeSelecionada.id);
                      setIsModalOpen(false);
                      setAtividadeSelecionada(null);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Marcar como Concluído
                  </button>
                  <button
                    onClick={() => {
                      cancelarLembrete(atividadeSelecionada.id);
                      setIsModalOpen(false);
                      setAtividadeSelecionada(null);
                    }}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={dialogConfig.isOpen && dialogConfig.type === 'confirm'}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
        onConfirm={() => {
          if (dialogConfig.onConfirm) {
            dialogConfig.onConfirm();
          }
          setDialogConfig({ ...dialogConfig, isOpen: false });
        }}
      />

      <ConfirmDialog
        isOpen={dialogConfig.isOpen && dialogConfig.type !== 'confirm'}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
      />
    </div>
  );
}
