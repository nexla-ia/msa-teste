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
        <Route path="/atividades" element={<Atividades />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/programas-fidelidade" element={<ProgramasFidelidade />} />
        <Route path="/smiles" element={<Smiles />} />
        <Route path="/latam" element={<Latam />} />
        <Route path="/azul" element={<Azul />} />
        <Route path="/livelo" element={<Livelo />} />
        <Route path="/tap" element={<Tap />} />
        <Route path="/accor" element={<Accor />} />
        <Route path="/km" element={<KM />} />
        <Route path="/pagol" element={<Pagol />} />
        <Route path="/esfera" element={<Esfera />} />
        <Route path="/hotmilhas" element={<Hotmilhas />} />
        <Route path="/coopera" element={<Coopera />} />
        <Route path="/gov" element={<GOv />} />
        <Route path="/lojas" element={<Lojas />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/parceiros" element={<Parceiros />} />
        <Route path="/conta-familia" element={<ContaFamilia />} />
        <Route path="/cartoes" element={<Cartoes />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/contas-bancarias" element={<ContasBancarias />} />
        <Route path="/classificacao-contabil" element={<ClassificacaoContabil />} />
        <Route path="/centro-custos" element={<CentroCustos />} />
        <Route path="/status-programa" element={<StatusPrograma />} />
        <Route path="/programas-clubes" element={<ProgramasClubes />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/perfis" element={<Perfis />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/compra-bonificada" element={<CompraBonificada />} />
        <Route path="/transferencia-pontos" element={<TransferenciaPontos />} />
        <Route path="/transferencia-pessoas" element={<TransferenciaPessoas />} />
        <Route path="/tipos-compra" element={<TiposCompra />} />
        <Route path="/formas-pagamento" element={<FormasPagamento />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/vendas/:vendaId/localizador" element={<VendaLocalizador />} />
        <Route path="/contas-receber" element={<ContasReceber />} />
        <Route path="/contas-a-pagar" element={<ContasAPagar />} />
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
