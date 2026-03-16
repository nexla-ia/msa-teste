import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Award, Store, CreditCard, TrendingUp, Package, Bell, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

type Stats = {
  clientes: number;
  programas: number;
  lojas: number;
  cartoes: number;
  produtos: number;
  usuarios: number;
};

type Atividade = {
  id: string;
  tipo_atividade: string;
  titulo: string;
  descricao: string;
  parceiro_nome: string;
  programa_nome: string;
  quantidade_pontos: number;
  data_prevista: string;
  prioridade: string;
  periodo: string;
  dias_restantes: number;
};

type AtividadeProcessada = {
  id: string;
  tipo_atividade: string;
  titulo: string;
  descricao: string;
  parceiro_nome: string;
  programa_nome: string;
  quantidade_pontos: number;
  processado_em: string;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    clientes: 0,
    programas: 0,
    lojas: 0,
    cartoes: 0,
    produtos: 0,
    usuarios: 0
  });
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [atividadesProcessadas, setAtividadesProcessadas] = useState<AtividadeProcessada[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAtividades, setLoadingAtividades] = useState(true);
  const [loadingProcessadas, setLoadingProcessadas] = useState(true);

  useEffect(() => {
    loadStats();
    loadAtividades();
    loadAtividadesProcessadas();
  }, []);

  const loadStats = async () => {
    try {
      const [clientes, programas, lojas, cartoes, produtos, usuarios] = await Promise.all([
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('programas_fidelidade').select('id', { count: 'exact', head: true }),
        supabase.from('lojas').select('id', { count: 'exact', head: true }),
        supabase.from('cartoes_credito').select('id', { count: 'exact', head: true }),
        supabase.from('produtos').select('id', { count: 'exact', head: true }),
        supabase.from('usuarios').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        clientes: clientes.count || 0,
        programas: programas.count || 0,
        lojas: lojas.count || 0,
        cartoes: cartoes.count || 0,
        produtos: produtos.count || 0,
        usuarios: usuarios.count || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAtividades = async () => {
    try {
      const { data, error } = await supabase
        .from('atividades_pendentes')
        .select('*')
        .in('periodo', ['Hoje', 'Amanhã', 'Esta semana'])
        .limit(10);

      if (error) throw error;
      setAtividades(data || []);
    } catch (error) {
      console.error('Error loading atividades:', error);
    } finally {
      setLoadingAtividades(false);
    }
  };

  const loadAtividadesProcessadas = async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const { data, error } = await supabase
        .from('atividades')
        .select('id, tipo_atividade, titulo, descricao, parceiro_nome, programa_nome, quantidade_pontos, processado_em')
        .eq('status', 'concluido')
        .gte('processado_em', hoje.toISOString())
        .lt('processado_em', amanha.toISOString())
        .order('processado_em', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAtividadesProcessadas(data || []);
    } catch (error) {
      console.error('Error loading atividades processadas:', error);
    } finally {
      setLoadingProcessadas(false);
    }
  };

  const cards = [
    {
      title: 'Clientes',
      value: stats.clientes,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Programas de Fidelidade',
      value: stats.programas,
      icon: Award,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      title: 'Lojas',
      value: stats.lojas,
      icon: Store,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      title: 'Cartões de Crédito',
      value: stats.cartoes,
      icon: CreditCard,
      color: 'from-cyan-500 to-cyan-600',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-600'
    },
    {
      title: 'Produtos',
      value: stats.produtos,
      icon: Package,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600'
    },
    {
      title: 'Usuários',
      value: stats.usuarios,
      icon: TrendingUp,
      color: 'from-slate-500 to-slate-600',
      bgColor: 'bg-slate-50',
      textColor: 'text-slate-600'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
        <p className="text-slate-600">Visão geral do sistema MSA Milhas e Turismo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`${card.bgColor} p-3 rounded-lg`}>
                <card.icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
            </div>
            <h3 className="text-slate-600 text-sm font-medium mb-1">{card.title}</h3>
            <p className="text-3xl font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Bem-vindo ao MSA Milhas ERP</h2>
        <p className="text-slate-600 leading-relaxed">
          Este é o sistema de gestão empresarial da MSA Milhas e Turismo. Use o menu lateral para
          acessar os diferentes módulos de cadastro e gerenciar todas as informações da empresa.
        </p>
      </div>

      {/* Seção de Pontos Creditados Hoje */}
      {!loadingProcessadas && atividadesProcessadas.length > 0 && (
        <div className="mt-8 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Pontos Creditados Hoje</h2>
              <p className="text-sm text-slate-600">Confira os pontos que entraram na sua conta hoje</p>
            </div>
          </div>

          <div className="space-y-3">
            {atividadesProcessadas.map((atividade) => {
              const tipoIcons = {
                transferencia_entrada: '📥',
                transferencia_bonus: '🎁',
                bumerangue_retorno: '🔄',
                clube_credito_mensal: '💳',
                clube_credito_bonus: '⭐',
                outro: '📌'
              };

              return (
                <div
                  key={atividade.id}
                  className="bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{tipoIcons[atividade.tipo_atividade as keyof typeof tipoIcons]}</span>
                        <h3 className="font-semibold text-slate-800">{atividade.titulo}</h3>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Creditado
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{atividade.descricao}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {atividade.parceiro_nome && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {atividade.parceiro_nome}
                          </span>
                        )}
                        {atividade.programa_nome && (
                          <span className="flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            {atividade.programa_nome}
                          </span>
                        )}
                        {atividade.quantidade_pontos && (
                          <span className="flex items-center gap-1 font-semibold text-green-600">
                            ✓ +{atividade.quantidade_pontos.toLocaleString()} pontos
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-slate-500">
                        {new Date(atividade.processado_em).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seção de Atividades Pendentes */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-amber-50 p-2 rounded-lg">
            <Bell className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Atividades Pendentes</h2>
            <p className="text-sm text-slate-600">Entradas de pontos agendadas para esta semana</p>
          </div>
        </div>

        {loadingAtividades ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : atividades.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Nenhuma atividade pendente para esta semana</p>
          </div>
        ) : (
          <div className="space-y-3">
            {atividades.map((atividade) => {
              const prioridadeColors = {
                baixa: 'bg-slate-100 text-slate-700',
                normal: 'bg-blue-100 text-blue-700',
                alta: 'bg-amber-100 text-amber-700',
                urgente: 'bg-red-100 text-red-700'
              };

              const tipoIcons = {
                transferencia_entrada: '📥',
                transferencia_bonus: '🎁',
                bumerangue_retorno: '🔄',
                clube_credito_mensal: '💳',
                clube_credito_bonus: '⭐',
                outro: '📌'
              };

              return (
                <div
                  key={atividade.id}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{tipoIcons[atividade.tipo_atividade as keyof typeof tipoIcons]}</span>
                        <h3 className="font-semibold text-slate-800">{atividade.titulo}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${prioridadeColors[atividade.prioridade as keyof typeof prioridadeColors]}`}>
                          {atividade.prioridade}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{atividade.descricao}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {atividade.parceiro_nome && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {atividade.parceiro_nome}
                          </span>
                        )}
                        {atividade.programa_nome && (
                          <span className="flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            {atividade.programa_nome}
                          </span>
                        )}
                        {atividade.quantidade_pontos && (
                          <span className="flex items-center gap-1 font-medium text-green-600">
                            +{atividade.quantidade_pontos.toLocaleString()} pontos
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-slate-600 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {atividade.data_prevista ? new Date(atividade.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {atividade.periodo}
                        {atividade.dias_restantes > 0 && ` (${atividade.dias_restantes}d)`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
