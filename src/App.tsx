import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Atividades from './pages/Atividades';
import Clientes from './pages/Clientes';
import ProgramasFidelidade from './pages/ProgramasFidelidade';
import Smiles from './pages/Smiles';
import Latam from './pages/Latam';
import Azul from './pages/Azul';
import Livelo from './pages/Livelo';
import Tap from './pages/Tap';
import Accor from './pages/Accor';
import KM from './pages/KM';
import Pagol from './pages/Pagol';
import Esfera from './pages/Esfera';
import Hotmilhas from './pages/Hotmilhas';
import Coopera from './pages/Coopera';
import GOv from './pages/GOv';
import Lojas from './pages/Lojas';
import Produtos from './pages/Produtos';
import Parceiros from './pages/Parceiros';
import ContaFamilia from './pages/ContaFamilia';
import Cartoes from './pages/Cartoes';
import Usuarios from './pages/Usuarios';
import ContasBancarias from './pages/ContasBancarias';
import ClassificacaoContabil from './pages/ClassificacaoContabil';
import CentroCustos from './pages/CentroCustos';
import StatusPrograma from './pages/StatusPrograma';
import ProgramasClubes from './pages/ProgramasClubes';
import Logs from './pages/Logs';
import Perfis from './pages/Perfis';
import Compras from './pages/Compras';
import CompraBonificada from './pages/CompraBonificada';
import TransferenciaPontos from './pages/TransferenciaPontos';
import TransferenciaPessoas from './pages/TransferenciaPessoas';
import TiposCompra from './pages/TiposCompra';
import FormasPagamento from './pages/FormasPagamento';
import Estoque from './pages/Estoque';
import Vendas from './pages/Vendas';
import VendaLocalizador from './pages/VendaLocalizador';
import ContasReceber from './pages/ContasReceber';
import ContasAPagar from './pages/ContasAPagar';
import DashboardFinanceiro from './pages/DashboardFinanceiro';
import FluxoCaixa from './pages/FluxoCaixa';
import Lancamentos from './pages/Lancamentos';
import DRE from './pages/DRE';
import Orcamento from './pages/Orcamento';
import ConciliacaoBancaria from './pages/ConciliacaoBancaria';
import VendaDireta from './pages/VendaDireta';
import VendaUpload from './pages/VendaUpload';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return usuario ? <>{children}</> : <Navigate to="/login" />;
}

function PermissionRoute({ recurso, children }: { recurso: string; children: React.ReactNode }) {
  const { isAdmin, temPermissao, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAdmin || temPermissao(recurso, 'visualizar')) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-slate-500 text-lg font-medium">Acesso não autorizado</p>
      <p className="text-slate-400 text-sm mt-1">Você não tem permissão para acessar esta página.</p>
    </div>
  );
}

function AppRoutes() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/atividades" element={<PermissionRoute recurso="atividades"><Atividades /></PermissionRoute>} />
        <Route path="/estoque" element={<PermissionRoute recurso="estoque"><Estoque /></PermissionRoute>} />
        <Route path="/clientes" element={<PermissionRoute recurso="clientes"><Clientes /></PermissionRoute>} />
        <Route path="/programas-fidelidade" element={<PermissionRoute recurso="programas_fidelidade"><ProgramasFidelidade /></PermissionRoute>} />
        <Route path="/smiles" element={<PermissionRoute recurso="programas_fidelidade"><Smiles /></PermissionRoute>} />
        <Route path="/latam" element={<PermissionRoute recurso="programas_fidelidade"><Latam /></PermissionRoute>} />
        <Route path="/azul" element={<PermissionRoute recurso="programas_fidelidade"><Azul /></PermissionRoute>} />
        <Route path="/livelo" element={<PermissionRoute recurso="programas_fidelidade"><Livelo /></PermissionRoute>} />
        <Route path="/tap" element={<PermissionRoute recurso="programas_fidelidade"><Tap /></PermissionRoute>} />
        <Route path="/accor" element={<PermissionRoute recurso="programas_fidelidade"><Accor /></PermissionRoute>} />
        <Route path="/km" element={<PermissionRoute recurso="programas_fidelidade"><KM /></PermissionRoute>} />
        <Route path="/pagol" element={<PermissionRoute recurso="programas_fidelidade"><Pagol /></PermissionRoute>} />
        <Route path="/esfera" element={<PermissionRoute recurso="programas_fidelidade"><Esfera /></PermissionRoute>} />
        <Route path="/hotmilhas" element={<PermissionRoute recurso="programas_fidelidade"><Hotmilhas /></PermissionRoute>} />
        <Route path="/coopera" element={<PermissionRoute recurso="programas_fidelidade"><Coopera /></PermissionRoute>} />
        <Route path="/gov" element={<PermissionRoute recurso="programas_fidelidade"><GOv /></PermissionRoute>} />
        <Route path="/lojas" element={<PermissionRoute recurso="lojas"><Lojas /></PermissionRoute>} />
        <Route path="/produtos" element={<PermissionRoute recurso="produtos"><Produtos /></PermissionRoute>} />
        <Route path="/parceiros" element={<PermissionRoute recurso="parceiros"><Parceiros /></PermissionRoute>} />
        <Route path="/conta-familia" element={<PermissionRoute recurso="conta_familia"><ContaFamilia /></PermissionRoute>} />
        <Route path="/cartoes" element={<PermissionRoute recurso="cartoes"><Cartoes /></PermissionRoute>} />
        <Route path="/usuarios" element={<PermissionRoute recurso="usuarios"><Usuarios /></PermissionRoute>} />
        <Route path="/contas-bancarias" element={<PermissionRoute recurso="contas_bancarias"><ContasBancarias /></PermissionRoute>} />
        <Route path="/classificacao-contabil" element={<PermissionRoute recurso="classificacao_contabil"><ClassificacaoContabil /></PermissionRoute>} />
        <Route path="/centro-custos" element={<PermissionRoute recurso="centro_custos"><CentroCustos /></PermissionRoute>} />
        <Route path="/status-programa" element={<PermissionRoute recurso="status_programa"><StatusPrograma /></PermissionRoute>} />
        <Route path="/programas-clubes" element={<PermissionRoute recurso="programas_clubes"><ProgramasClubes /></PermissionRoute>} />
        <Route path="/logs" element={<PermissionRoute recurso="logs"><Logs /></PermissionRoute>} />
        <Route path="/perfis" element={<PermissionRoute recurso="perfis"><Perfis /></PermissionRoute>} />
        <Route path="/compras" element={<PermissionRoute recurso="compras"><Compras /></PermissionRoute>} />
        <Route path="/compra-bonificada" element={<PermissionRoute recurso="compra_bonificada"><CompraBonificada /></PermissionRoute>} />
        <Route path="/transferencia-pontos" element={<PermissionRoute recurso="transferencia_pontos"><TransferenciaPontos /></PermissionRoute>} />
        <Route path="/transferencia-pessoas" element={<PermissionRoute recurso="transferencia_pessoas"><TransferenciaPessoas /></PermissionRoute>} />
        <Route path="/tipos-compra" element={<PermissionRoute recurso="tipos_compra"><TiposCompra /></PermissionRoute>} />
        <Route path="/formas-pagamento" element={<PermissionRoute recurso="formas_pagamento"><FormasPagamento /></PermissionRoute>} />
        <Route path="/vendas" element={<PermissionRoute recurso="vendas"><Vendas /></PermissionRoute>} />
        <Route path="/vendas/:vendaId/localizador" element={<PermissionRoute recurso="vendas"><VendaLocalizador /></PermissionRoute>} />
        <Route path="/contas-receber" element={<PermissionRoute recurso="contas_receber"><ContasReceber /></PermissionRoute>} />
        <Route path="/contas-a-pagar" element={<PermissionRoute recurso="contas_a_pagar"><ContasAPagar /></PermissionRoute>} />
        <Route path="/dashboard-financeiro" element={<PermissionRoute recurso="contas_a_pagar"><DashboardFinanceiro /></PermissionRoute>} />
        <Route path="/fluxo-caixa" element={<PermissionRoute recurso="contas_a_pagar"><FluxoCaixa /></PermissionRoute>} />
        <Route path="/lancamentos" element={<PermissionRoute recurso="contas_a_pagar"><Lancamentos /></PermissionRoute>} />
        <Route path="/dre" element={<PermissionRoute recurso="contas_a_pagar"><DRE /></PermissionRoute>} />
        <Route path="/orcamento" element={<PermissionRoute recurso="contas_a_pagar"><Orcamento /></PermissionRoute>} />
        <Route path="/conciliacao-bancaria" element={<PermissionRoute recurso="contas_a_pagar"><ConciliacaoBancaria /></PermissionRoute>} />
        <Route path="/venda-direta" element={<PermissionRoute recurso="vendas"><VendaDireta /></PermissionRoute>} />
        <Route path="/venda-upload" element={<PermissionRoute recurso="vendas"><VendaUpload /></PermissionRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
