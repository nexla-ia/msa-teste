import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Shield, Check, X } from 'lucide-react';

type Usuario = {
  id: string;
  nome: string;
  email: string;
  senha: string;
  nivel_acesso: 'ADM' | 'USER';
  perfil_id: string | null;
  ultima_acao: string | null;
  token: string | null;
};

type Perfil = {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
};

type Permissao = {
  id?: string;
  usuario_id: string;
  recurso: string;
  pode_visualizar: boolean;
  pode_editar: boolean;
  pode_deletar: boolean;
};

const GRUPOS_RECURSOS = [
  {
    grupo: 'Geral',
    recursos: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'atividades', label: 'Atividades' },
      { key: 'estoque', label: 'Estoque' },
    ]
  },
  {
    grupo: 'Movimentações',
    recursos: [
      { key: 'compras', label: 'Compras (Entradas)' },
      { key: 'vendas', label: 'Vendas' },
      { key: 'compra_bonificada', label: 'Compra Bonificada' },
      { key: 'transferencia_pontos', label: 'Transferência de Pontos/Milhas' },
      { key: 'transferencia_pessoas', label: 'Transferência entre Pessoas' },
    ]
  },
  {
    grupo: 'Financeiro',
    recursos: [
      { key: 'contas_receber', label: 'Contas a Receber' },
      { key: 'contas_a_pagar', label: 'Contas a Pagar' },
    ]
  },
  {
    grupo: 'Cadastros',
    recursos: [
      { key: 'clientes', label: 'Clientes' },
      { key: 'parceiros', label: 'Parceiros' },
      { key: 'produtos', label: 'Produtos' },
      { key: 'programas_fidelidade', label: 'Programas de Fidelidade' },
      { key: 'programas_clubes', label: 'Programas/Clubes' },
      { key: 'conta_familia', label: 'Conta Família' },
      { key: 'contas_bancarias', label: 'Banco Emissor' },
      { key: 'cartoes', label: 'Cartões de Crédito' },
      { key: 'lojas', label: 'Lojas - Compras Bonificadas' },
      { key: 'tipos_compra', label: 'Tipos de Compra' },
      { key: 'formas_pagamento', label: 'Formas de Pagamento' },
      { key: 'perfis', label: 'Perfis de Usuário' },
      { key: 'usuarios', label: 'Usuários' },
      { key: 'classificacao_contabil', label: 'Classificação Contábil' },
      { key: 'centro_custos', label: 'Centro de Custo' },
      { key: 'status_programa', label: 'Status Programas' },
    ]
  },
  {
    grupo: 'Outros',
    recursos: [
      { key: 'logs', label: 'Logs' },
    ]
  },
];

const RECURSOS_DISPONIVEIS = GRUPOS_RECURSOS.flatMap(g => g.recursos);

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [permissoesModalOpen, setPermissoesModalOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [editingPermissoes, setEditingPermissoes] = useState<Usuario | null>(null);
  const { usuario: currentUser } = useAuth();

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

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    nivel_acesso: 'USER' as 'ADM' | 'USER',
    perfil_id: null as string | null
  });

  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [permissoesNovaUsuario, setPermissoesNovaUsuario] = useState<Permissao[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usuariosRes, perfisRes, todosPerfisRes] = await Promise.all([
        supabase.from('usuarios').select('*').order('nome'),
        supabase.from('perfis_usuario').select('*').eq('ativo', true).order('nome'),
        supabase.from('perfis_usuario').select('*')
      ]);
      setUsuarios(usuariosRes.data || []);
      setPerfis(perfisRes.data || []);

      const perfisMap = new Map((todosPerfisRes.data || []).map(p => [p.id, p]));
      setUsuarios((usuariosRes.data || []).map(u => ({
        ...u,
        perfil_nome: u.perfil_id ? perfisMap.get(u.perfil_id)?.nome : null
      })));
    } finally {
      setLoading(false);
    }
  };

  const loadPermissoes = async (usuarioId: string) => {
    const { data } = await supabase
      .from('usuario_permissoes')
      .select('*')
      .eq('usuario_id', usuarioId);

    const permissoesMap = new Map(data?.map(p => [p.recurso, p]) || []);

    const todasPermissoes = RECURSOS_DISPONIVEIS.map(recurso => {
      const existente = permissoesMap.get(recurso.key);
      return existente || {
        usuario_id: usuarioId,
        recurso: recurso.key,
        pode_visualizar: false,
        pode_editar: false,
        pode_deletar: false
      };
    });

    setPermissoes(todasPermissoes);
  };

  const handleAdd = () => {
    setEditing(null);
    setFormData({ nome: '', email: '', senha: '', nivel_acesso: 'USER', perfil_id: null });
    const permissoesIniciais = RECURSOS_DISPONIVEIS.map(recurso => ({
      usuario_id: '',
      recurso: recurso.key,
      pode_visualizar: false,
      pode_editar: false,
      pode_deletar: false
    }));
    setPermissoesNovaUsuario(permissoesIniciais);
    setModalOpen(true);
  };

  const handleEdit = (item: Usuario) => {
    setEditing(item);
    setFormData({ nome: item.nome, email: item.email, senha: '', nivel_acesso: item.nivel_acesso, perfil_id: item.perfil_id });
    setModalOpen(true);
  };

  const handleEditPermissoes = async (item: Usuario) => {
    setEditingPermissoes(item);
    await loadPermissoes(item.id);
    setPermissoesModalOpen(true);
  };

  const handleDelete = async (item: Usuario) => {
    if (item.id === currentUser?.id) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Ação Não Permitida',
        message: 'Você não pode excluir seu próprio usuário.'
      });
      return;
    }

    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir o usuário "${item.nome}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        await supabase.from('usuarios').delete().eq('id', item.id);
        await supabase.from('logs').insert({
          usuario_id: currentUser?.id,
          usuario_nome: currentUser?.nome || '',
          acao: 'DELETE',
          linha_afetada: `Usuário: ${item.nome}`,
          dados_antes: { ...item, senha: '***' },
          dados_depois: null
        });
        loadData();
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        const updateData: any = {
          nome: formData.nome,
          email: formData.email,
          nivel_acesso: formData.nivel_acesso,
          perfil_id: formData.perfil_id
        };
        if (formData.senha) {
          updateData.senha = formData.senha;
        }
        const { error: updateError } = await supabase.from('usuarios').update(updateData).eq('id', editing.id);
        if (updateError) throw updateError;

        await supabase.from('logs').insert({
          usuario_id: currentUser?.id,
          usuario_nome: currentUser?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Usuário: ${formData.nome}`,
          dados_antes: { ...editing, senha: '***' },
          dados_depois: { ...updateData, senha: '***' }
        });
      } else {
        const { data: novoUsuario, error: insertError } = await supabase
          .from('usuarios')
          .insert([formData])
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao inserir usuário:', insertError);
          throw insertError;
        }

        if (!novoUsuario) {
          throw new Error('Usuário não foi criado');
        }

        if (novoUsuario && formData.nivel_acesso === 'USER') {
          const permissoesParaSalvar = permissoesNovaUsuario.filter(
            p => p.pode_visualizar || p.pode_editar || p.pode_deletar
          ).map(p => ({
            usuario_id: novoUsuario.id,
            recurso: p.recurso,
            pode_visualizar: p.pode_visualizar,
            pode_editar: p.pode_editar,
            pode_deletar: p.pode_deletar
          }));

          if (permissoesParaSalvar.length > 0) {
            const { error: permError } = await supabase.from('usuario_permissoes').insert(permissoesParaSalvar);
            if (permError) {
              console.error('Erro ao inserir permissões:', permError);
            }
          }
        }

        await supabase.from('logs').insert({
          usuario_id: currentUser?.id,
          usuario_nome: currentUser?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Usuário: ${formData.nome}`,
          dados_antes: null,
          dados_depois: { ...formData, senha: '***' }
        });
      }
      setModalOpen(false);
      loadData();

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: `Usuário ${editing ? 'atualizado' : 'criado'} com sucesso!`
      });
    } catch (error: any) {
      console.error('Erro completo:', error);

      let mensagem = error.message || 'Erro desconhecido';

      if (error.code === '23505') {
        if (error.message.includes('email')) {
          mensagem = 'Este email já está sendo usado por outro usuário.';
        } else {
          mensagem = 'Já existe um registro com estes dados.';
        }
      }

      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar o usuário.\n\n${mensagem}\n\nCódigo: ${error.code || 'N/A'}`
      });
    }
  };

  const handleSavePermissoes = async () => {
    if (!editingPermissoes) return;

    try {
      await supabase
        .from('usuario_permissoes')
        .delete()
        .eq('usuario_id', editingPermissoes.id);

      const permissoesParaSalvar = permissoes.filter(
        p => p.pode_visualizar || p.pode_editar || p.pode_deletar
      ).map(p => ({
        usuario_id: p.usuario_id,
        recurso: p.recurso,
        pode_visualizar: p.pode_visualizar,
        pode_editar: p.pode_editar,
        pode_deletar: p.pode_deletar
      }));

      if (permissoesParaSalvar.length > 0) {
        await supabase.from('usuario_permissoes').insert(permissoesParaSalvar);
      }

      await supabase.from('logs').insert({
        usuario_id: currentUser?.id,
        usuario_nome: currentUser?.nome || '',
        acao: 'UPDATE',
        linha_afetada: `Permissões do Usuário: ${editingPermissoes.nome}`,
        dados_antes: null,
        dados_depois: { permissoes: permissoesParaSalvar }
      });

      window.dispatchEvent(new Event('permissoes-atualizadas'));

      setPermissoesModalOpen(false);
      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'Permissões salvas com sucesso!'
      });
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar as permissões.\n\n${error.message || 'Erro desconhecido'}`
      });
    }
  };

  const togglePermissao = (recurso: string, tipo: 'visualizar' | 'editar' | 'deletar') => {
    setPermissoes(prev => prev.map(p => {
      if (p.recurso === recurso) {
        const updated = { ...p };
        if (tipo === 'visualizar') {
          updated.pode_visualizar = !p.pode_visualizar;
          if (!updated.pode_visualizar) {
            updated.pode_editar = false;
            updated.pode_deletar = false;
          }
        } else if (tipo === 'editar') {
          updated.pode_editar = !p.pode_editar;
          if (updated.pode_editar) {
            updated.pode_visualizar = true;
          }
        } else if (tipo === 'deletar') {
          updated.pode_deletar = !p.pode_deletar;
          if (updated.pode_deletar) {
            updated.pode_visualizar = true;
          }
        }
        return updated;
      }
      return p;
    }));
  };

  const togglePermissaoNovo = (recurso: string, tipo: 'visualizar' | 'editar' | 'deletar') => {
    setPermissoesNovaUsuario(prev => prev.map(p => {
      if (p.recurso === recurso) {
        const updated = { ...p };
        if (tipo === 'visualizar') {
          updated.pode_visualizar = !p.pode_visualizar;
          if (!updated.pode_visualizar) {
            updated.pode_editar = false;
            updated.pode_deletar = false;
          }
        } else if (tipo === 'editar') {
          updated.pode_editar = !p.pode_editar;
          if (updated.pode_editar) {
            updated.pode_visualizar = true;
          }
        } else if (tipo === 'deletar') {
          updated.pode_deletar = !p.pode_deletar;
          if (updated.pode_deletar) {
            updated.pode_visualizar = true;
          }
        }
        return updated;
      }
      return p;
    }));
  };

  return (
    <>
      <CrudTable
        title="Usuários"
        data={usuarios}
        columns={[
          { key: 'nome', label: 'Nome' },
          { key: 'email', label: 'Email' },
          { key: 'nivel_acesso', label: 'Nível de Acesso' },
          {
            key: 'perfil_nome',
            label: 'Perfil',
            render: (item: any) => item.nivel_acesso === 'USER' ? (item.perfil_nome || '-') : 'N/A'
          },
          {
            key: 'ultima_acao',
            label: 'Última Ação',
            render: (item) => item.ultima_acao ? new Date(item.ultima_acao).toLocaleString('pt-BR') : '-'
          }
        ]}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        extraActions={(item) => (
          <>
            {item.nivel_acesso === 'USER' && (
              <button
                onClick={() => handleEditPermissoes(item)}
                className="text-green-600 hover:text-green-800 transition-colors"
                title="Gerenciar Permissões"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Usuário' : 'Novo Usuário'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Senha {editing && '(deixe em branco para manter a atual)'}
            </label>
            <input type="password" value={formData.senha} onChange={(e) => setFormData({ ...formData, senha: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required={!editing} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nível de Acesso *</label>
            <select
              value={formData.nivel_acesso}
              onChange={(e) => setFormData({ ...formData, nivel_acesso: e.target.value as 'ADM' | 'USER', perfil_id: e.target.value === 'ADM' ? null : formData.perfil_id })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="USER">USER</option>
              <option value="ADM">ADM</option>
            </select>
          </div>

          {formData.nivel_acesso === 'USER' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de Permissões *</label>
              <select
                value={formData.perfil_id || ''}
                onChange={(e) => setFormData({ ...formData, perfil_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecione um perfil</option>
                {perfis.map(perfil => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.nome} {perfil.descricao && `- ${perfil.descricao}`}
                  </option>
                ))}
              </select>
              {perfis.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Nenhum perfil encontrado. Crie um perfil na tela "Perfis de Usuário" primeiro.
                </p>
              )}
            </div>
          )}

          {!editing && formData.nivel_acesso === 'USER' && false && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Permissões</h4>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left text-slate-600">Tela</th>
                      <th className="px-2 py-2 text-center text-slate-600 w-16">Ver</th>
                      <th className="px-2 py-2 text-center text-slate-600 w-16">Editar</th>
                      <th className="px-2 py-2 text-center text-slate-600 w-16">Deletar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {RECURSOS_DISPONIVEIS.map(recurso => {
                      const perm = permissoesNovaUsuario.find(p => p.recurso === recurso.key);
                      return (
                        <tr key={recurso.key} className="bg-white">
                          <td className="px-2 py-2 text-slate-700">{recurso.label}</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => togglePermissaoNovo(recurso.key, 'visualizar')}
                              className={`w-6 h-6 rounded flex items-center justify-center ${
                                perm?.pode_visualizar ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {perm?.pode_visualizar ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => togglePermissaoNovo(recurso.key, 'editar')}
                              className={`w-6 h-6 rounded flex items-center justify-center ${
                                perm?.pode_editar ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {perm?.pode_editar ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => togglePermissaoNovo(recurso.key, 'deletar')}
                              className={`w-6 h-6 rounded flex items-center justify-center ${
                                perm?.pode_deletar ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {perm?.pode_deletar ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? 'Salvar' : 'Adicionar'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={permissoesModalOpen}
        onClose={() => setPermissoesModalOpen(false)}
        title={`Permissões - ${editingPermissoes?.nome}`}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              Defina quais telas/recursos o usuário pode acessar e quais ações pode realizar.
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Recurso</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase w-24">Visualizar</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase w-24">Editar</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase w-24">Deletar</th>
                </tr>
              </thead>
              <tbody>
                {GRUPOS_RECURSOS.map(grupo => (
                  <>
                    <tr key={`grupo-${grupo.grupo}`} className="bg-slate-100">
                      <td colSpan={4} className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {grupo.grupo}
                      </td>
                    </tr>
                    {grupo.recursos.map(recurso => {
                      const perm = permissoes.find(p => p.recurso === recurso.key);
                      return (
                        <tr key={recurso.key} className="hover:bg-slate-50 border-b border-slate-100">
                          <td className="px-4 py-3 text-slate-800 font-medium pl-6">{recurso.label}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => togglePermissao(recurso.key, 'visualizar')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                perm?.pode_visualizar
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {perm?.pode_visualizar ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => togglePermissao(recurso.key, 'editar')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                perm?.pode_editar
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {perm?.pode_editar ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => togglePermissao(recurso.key, 'deletar')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                perm?.pode_deletar
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {perm?.pode_deletar ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setPermissoesModalOpen(false)}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSavePermissoes}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Salvar Permissões
            </button>
          </div>
        </div>
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
