import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

type Usuario = {
  id: string;
  nome: string;
  email: string;
  nivel_acesso: 'ADM' | 'USER';
  token: string | null;
};

type Permissao = {
  recurso: string;
  pode_visualizar: boolean;
  pode_editar: boolean;
  pode_deletar: boolean;
};

type AuthContextType = {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  permissoes: Permissao[];
  temPermissao: (recurso: string, tipo: 'visualizar' | 'editar' | 'deletar') => boolean;
  recarregarPermissoes: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const handlePermissoesAtualizadas = () => {
      console.log('Evento permissoes-atualizadas recebido!', usuario);
      if (usuario) {
        loadPermissoes(usuario.id, usuario.nivel_acesso);
      }
    };

    window.addEventListener('permissoes-atualizadas', handlePermissoesAtualizadas);
    return () => window.removeEventListener('permissoes-atualizadas', handlePermissoesAtualizadas);
  }, [usuario]);

  const loadPermissoes = async (usuarioId: string, nivelAcesso: string) => {
    if (nivelAcesso === 'ADM') {
      setPermissoes([]);
      return;
    }

    try {
      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('perfil_id')
        .eq('id', usuarioId)
        .maybeSingle();

      if (usuarioData?.perfil_id) {
        const { data: permissoesPerfil } = await supabase
          .from('perfil_permissoes')
          .select('recurso, pode_visualizar, pode_editar, pode_deletar')
          .eq('perfil_id', usuarioData.perfil_id);

        console.log('Permissões do perfil carregadas:', permissoesPerfil);
        setPermissoes(permissoesPerfil || []);
      } else {
        const { data: permissoesUsuario } = await supabase
          .from('usuario_permissoes')
          .select('recurso, pode_visualizar, pode_editar, pode_deletar')
          .eq('usuario_id', usuarioId);

        console.log('Permissões diretas do usuário carregadas:', permissoesUsuario);
        setPermissoes(permissoesUsuario || []);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissoes([]);
    }
  };

  const checkUser = async () => {
    try {
      const stored = localStorage.getItem('msa_user');
      if (stored) {
        const user = JSON.parse(stored);
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nome, email, nivel_acesso, token')
          .eq('id', user.id)
          .eq('token', user.token)
          .maybeSingle();

        if (data && !error) {
          setUsuario(data);
          await loadPermissoes(data.id, data.nivel_acesso);
        } else {
          localStorage.removeItem('msa_user');
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
      localStorage.removeItem('msa_user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, senha: string) => {
    try {
      const { data: user, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, nivel_acesso, senha')
        .eq('email', email)
        .maybeSingle();

      if (error || !user) {
        return { success: false, error: 'Email ou senha inválidos' };
      }

      if (user.senha !== senha) {
        return { success: false, error: 'Email ou senha inválidos' };
      }

      const newToken = crypto.randomUUID();

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          token: newToken,
          ultima_acao: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        return { success: false, error: 'Erro ao fazer login' };
      }

      const userData = {
        id: user.id,
        nome: user.nome,
        email: user.email,
        nivel_acesso: user.nivel_acesso,
        token: newToken
      };

      setUsuario(userData);
      localStorage.setItem('msa_user', JSON.stringify(userData));
      await loadPermissoes(user.id, user.nivel_acesso);

      await supabase.from('logs').insert({
        usuario_id: user.id,
        usuario_nome: user.nome,
        acao: 'LOGIN',
        linha_afetada: `Usuario: ${user.email}`,
        dados_antes: null,
        dados_depois: { email: user.email }
      });

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const logout = async () => {
    if (usuario) {
      await supabase
        .from('usuarios')
        .update({ token: null })
        .eq('id', usuario.id);

      await supabase.from('logs').insert({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        acao: 'LOGOUT',
        linha_afetada: `Usuario: ${usuario.email}`,
        dados_antes: { email: usuario.email },
        dados_depois: null
      });
    }

    setUsuario(null);
    setPermissoes([]);
    localStorage.removeItem('msa_user');
  };

  const recarregarPermissoes = async () => {
    if (usuario) {
      await loadPermissoes(usuario.id, usuario.nivel_acesso);
    }
  };

  const temPermissao = (recurso: string, tipo: 'visualizar' | 'editar' | 'deletar'): boolean => {
    if (usuario?.nivel_acesso === 'ADM') {
      return true;
    }

    const perm = permissoes.find(p => p.recurso === recurso);
    console.log(`Verificando permissão: ${recurso} - ${tipo}`, { perm, todasPermissoes: permissoes });

    if (!perm) return false;

    if (tipo === 'visualizar') {
      return perm.pode_visualizar;
    } else if (tipo === 'editar') {
      return perm.pode_editar;
    } else if (tipo === 'deletar') {
      return perm.pode_deletar;
    }

    return false;
  };

  return (
    <AuthContext.Provider value={{
      usuario,
      loading,
      login,
      logout,
      isAdmin: usuario?.nivel_acesso === 'ADM',
      permissoes,
      temPermissao,
      recarregarPermissoes
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
