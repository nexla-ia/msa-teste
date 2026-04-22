import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Award,
  Store,
  Package,
  CreditCard,
  Building2,
  FileText,
  FolderTree,
  DollarSign,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Plane,
  Bell,
  Shield,
  TrendingUp,
  ShoppingCart,
  Gift,
  ArrowRightLeft
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const { usuario, logout, temPermissao } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const [movimentacoesOpen, setMovimentacoesOpen] = useState(false);
  const [financeiroOpen, setFinanceiroOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const allMenuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, recurso: 'dashboard' },
    { path: '/estoque', label: 'Estoque', icon: Package, recurso: 'estoque' },
    { path: '/atividades', label: 'Atividades', icon: Bell, recurso: 'atividades' },
  ];

  const allCadastrosItems = [
    { path: '/usuarios', label: 'Usuários', icon: Users, recurso: 'usuarios' },
    { path: '/programas-fidelidade', label: 'Programa de Fidelidade', icon: Award, recurso: 'programas_fidelidade' },
    { path: '/parceiros', label: 'Parceiros', icon: Users, recurso: 'parceiros' },
    { path: '/conta-familia', label: 'Conta Família', icon: Users, recurso: 'conta_familia' },
    { path: '/contas-bancarias', label: 'Banco Emissor', icon: Building2, recurso: 'contas_bancarias' },
    { path: '/cartoes', label: 'Cartão de Crédito', icon: CreditCard, recurso: 'cartoes' },
    { path: '/clientes', label: 'Clientes', icon: Users, recurso: 'clientes' },
    { path: '/programas-clubes', label: 'Programas/Clubes', icon: Award, recurso: 'programas_clubes' },
    { path: '/lojas', label: 'Lojas - Compras Bonificadas', icon: Store, recurso: 'lojas' },
    { path: '/produtos', label: 'Produtos', icon: Package, recurso: 'produtos' },
    { path: '/tipos-compra', label: 'Tipos de Compra', icon: ShoppingCart, recurso: 'tipos_compra' },
    { path: '/formas-pagamento', label: 'Formas de Pagamento', icon: CreditCard, recurso: 'formas_pagamento' },
    { path: '/perfis', label: 'Perfis de Usuário', icon: Shield, recurso: 'perfis' },
    { path: '/classificacao-contabil', label: 'Classificação Contábil', icon: FileText, recurso: 'classificacao_contabil' },
    { path: '/centro-custos', label: 'Centro de Custo', icon: DollarSign, recurso: 'centro_custos' },
    { path: '/status-programa', label: 'Status Programas', icon: Award, recurso: 'status_programa' },
  ];

  const allMovimentacoesItems = [
    { path: '/compras', label: 'Compras (Entradas)', icon: ShoppingCart, recurso: 'compras' },
    { path: '/vendas', label: 'Vendas', icon: TrendingUp, recurso: 'vendas' },
    { path: '/compra-bonificada', label: 'Compra Bonificada', icon: Gift, recurso: 'compra_bonificada' },
    { path: '/transferencia-pontos', label: 'Transferência de Pontos/Milhas', icon: ArrowRightLeft, recurso: 'transferencia_pontos' },
    { path: '/transferencia-pessoas', label: 'Transferência entre Pessoas', icon: Users, recurso: 'transferencia_pessoas' },
  ];

  const allFinanceiroItems = [
    { path: '/dashboard-financeiro', label: 'Dashboard Financeiro', icon: LayoutDashboard, recurso: 'contas_a_pagar' },
    { path: '/contas-receber', label: 'Contas a Receber', icon: DollarSign, recurso: 'contas_receber' },
    { path: '/contas-a-pagar', label: 'Contas a Pagar', icon: DollarSign, recurso: 'contas_a_pagar' },
  ];

  const logsItemData = { path: '/logs', label: 'Logs', icon: FolderTree, recurso: 'logs' };

  const menuItems = allMenuItems.filter(item => temPermissao(item.recurso, 'visualizar'));
  const cadastrosItems = allCadastrosItems.filter(item => temPermissao(item.recurso, 'visualizar'));
  const movimentacoesItems = allMovimentacoesItems.filter(item => temPermissao(item.recurso, 'visualizar'));
  const financeiroItems = allFinanceiroItems.filter(item => temPermissao(item.recurso, 'visualizar'));
  const logsItem = temPermissao(logsItemData.recurso, 'visualizar') ? logsItemData : null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-72' : 'w-20'
        } bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 flex flex-col shadow-2xl h-screen fixed left-0 top-0 z-50`}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-700 flex-shrink-0">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-2 rounded-lg">
                  <Plane className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-bold text-lg">MSA Milhas</h1>
                  <p className="text-xs text-slate-400">ERP System</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors mx-auto"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive(item.path)
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            ))}
          </div>

          <div className="mt-6">
            <button
              onClick={() => setCadastrosOpen(!cadastrosOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                sidebarOpen ? 'hover:bg-slate-700' : ''
              } text-slate-300`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">Cadastros</span>}
              </div>
              {sidebarOpen && (
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    cadastrosOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {cadastrosOpen && sidebarOpen && (
              <div className="ml-4 mt-1 space-y-1">
                {cadastrosItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                      isActive(item.path)
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={() => setMovimentacoesOpen(!movimentacoesOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                sidebarOpen ? 'hover:bg-slate-700' : ''
              } text-slate-300`}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">Movimentações</span>}
              </div>
              {sidebarOpen && (
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    movimentacoesOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {movimentacoesOpen && sidebarOpen && (
              <div className="ml-4 mt-1 space-y-1">
                {movimentacoesItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                      isActive(item.path)
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={() => setFinanceiroOpen(!financeiroOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                sidebarOpen ? 'hover:bg-slate-700' : ''
              } text-slate-300`}
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">Financeiro</span>}
              </div>
              {sidebarOpen && (
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    financeiroOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {financeiroOpen && sidebarOpen && (
              <div className="ml-4 mt-1 space-y-1">
                {financeiroItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                      isActive(item.path)
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {logsItem && (
            <div className="mt-6 space-y-1">
              <Link
                to={logsItem.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive(logsItem.path)
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <logsItem.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{logsItem.label}</span>}
              </Link>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700 flex-shrink-0">
          {sidebarOpen ? (
            <>
              <div className="mb-3 px-3">
                <p className="text-sm font-medium text-white truncate">{usuario?.nome}</p>
                <p className="text-xs text-slate-400 truncate">{usuario?.email}</p>
                <span
                  className={`inline-block mt-1.5 px-2 py-0.5 text-xs font-medium rounded ${
                    usuario?.nivel_acesso === 'ADM'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-600 text-slate-200'
                  }`}
                >
                  {usuario?.nivel_acesso}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sair</span>
              </button>
            </>
          ) : (
            <button
              onClick={logout}
              className="w-full flex items-center justify-center p-2.5 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      <main className={`flex-1 overflow-auto ${sidebarOpen ? 'ml-72' : 'ml-20'} transition-all duration-300`}>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
