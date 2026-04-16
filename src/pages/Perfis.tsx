import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CrudTable from '../components/CrudTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Check, X } from 'lucide-react';

type Perfil = {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

type Permissao = {
  id?: string;
  perfil_id: string;
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

export default function Perfis() {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Perfil | null>(null);
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
    descricao: '',
    ativo: true
  });

  const [permissoes, setPermissoes] = useState<Permissao[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('perfis_usuario').select('*').order('nome');
      setPerfis(data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissoes = async (perfilId: string) => {
    const { data } = await supabase
      .from('perfil_permissoes')
      .select('*')
      .eq('perfil_id', perfilId);

    const permissoesMap = new Map(data?.map(p => [p.recurso, p]) || []);

    const todasPermissoes = RECURSOS_DISPONIVEIS.map(recurso => {
      const existente = permissoesMap.get(recurso.key);
      return existente || {
        perfil_id: perfilId,
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
    setFormData({ nome: '', descricao: '', ativo: true });
    const permissoesIniciais = RECURSOS_DISPONIVEIS.map(recurso => ({
      perfil_id: '',
      recurso: recurso.key,
      pode_visualizar: false,
      pode_editar: false,
      pode_deletar: false
    }));
    setPermissoes(permissoesIniciais);
    setModalOpen(true);
  };

  const handleEdit = async (item: Perfil) => {
    setEditing(item);
    setFormData({ nome: item.nome, descricao: item.descricao, ativo: item.ativo });
    await loadPermissoes(item.id);
    setModalOpen(true);
  };

  const handleDelete = async (item: Perfil) => {
    const { data: usuariosComPerfil } = await supabase
      .from('usuarios')
      .select('id')
      .eq('perfil_id', item.id)
      .limit(1);

    if (usuariosComPerfil && usuariosComPerfil.length > 0) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Não é Possível Excluir',
        message: 'Este perfil está sendo usado por um ou mais usuários. Remova o perfil dos usuários antes de excluí-lo.'
      });
      return;
    }

    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir o perfil "${item.nome}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        await supabase.from('perfis_usuario').delete().eq('id', item.id);
        await supabase.from('logs').insert({
          usuario_id: currentUser?.id,
          usuario_nome: currentUser?.nome || '',
          acao: 'DELETE',
          linha_afetada: `Perfil: ${item.nome}`,
          dados_antes: item,
          dados_depois: null
        });
        loadData();
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Campo Obrigatório',
        message: 'O campo "Nome do Perfil" é obrigatório. Por favor, preencha-o antes de continuar.'
      });
      return;
    }

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('perfis_usuario')
          .update(formData)
          .eq('id', editing.id);

        if (updateError) throw updateError;

        await supabase
          .from('perfil_permissoes')
          .delete()
          .eq('perfil_id', editing.id);

        const permissoesParaSalvar = permissoes.filter(
          p => p.pode_visualizar || p.pode_editar || p.pode_deletar
        ).map(p => ({
          perfil_id: editing.id,
          recurso: p.recurso,
          pode_visualizar: p.pode_visualizar,
          pode_editar: p.pode_editar,
          pode_deletar: p.pode_deletar
        }));

        if (permissoesParaSalvar.length > 0) {
          await supabase.from('perfil_permissoes').insert(permissoesParaSalvar);
        }

        await supabase.from('logs').insert({
          usuario_id: currentUser?.id,
          usuario_nome: currentUser?.nome || '',
          acao: 'UPDATE',
          linha_afetada: `Perfil: ${formData.nome}`,
          dados_antes: editing,
          dados_depois: formData
        });
      } else {
        const { data: novoPerfil, error: insertError } = await supabase
          .from('perfis_usuario')
          .insert([formData])
          .select()
          .single();

        if (insertError) throw insertError;
        if (!novoPerfil) throw new Error('Perfil não foi criado');

        const permissoesParaSalvar = permissoes.filter(
          p => p.pode_visualizar || p.pode_editar || p.pode_deletar
        ).map(p => ({
          perfil_id: novoPerfil.id,
          recurso: p.recurso,
          pode_visualizar: p.pode_visualizar,
          pode_editar: p.pode_editar,
          pode_deletar: p.pode_deletar
        }));

        if (permissoesParaSalvar.length > 0) {
          await supabase.from('perfil_permissoes').insert(permissoesParaSalvar);
        }

        await supabase.from('logs').insert({
          usuario_id: currentUser?.id,
          usuario_nome: currentUser?.nome || '',
          acao: 'INSERT',
          linha_afetada: `Perfil: ${formData.nome}`,
          dados_antes: null,
          dados_depois: formData
        });
      }

      setModalOpen(false);
      loadData();

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: `Perfil ${editing ? 'atualizado' : 'criado'} com sucesso!`
      });
    } catch (error: any) {
      console.error('Erro completo:', error);

      let mensagem = error.message || 'Erro desconhecido';

      if (error.code === '23505') {
        mensagem = 'Já existe um perfil com este nome. Por favor, escolha outro nome.';
      }

      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Não foi possível salvar o perfil.\n\n${mensagem}\n\nCódigo: ${error.code || 'N/A'}`
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

  return (
    <>
      <CrudTable
        title="Perfis de Usuário"
        data={perfis}
        columns={[
          { key: 'nome', label: 'Nome do Perfil' },
          { key: 'descricao', label: 'Descrição' },
          {
            key: 'ativo',
            label: 'Status',
            render: (item) => (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {item.ativo ? 'Ativo' : 'Inativo'}
              </span>
            )
          }
        ]}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Perfil' : 'Novo Perfil'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Perfil *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Operador, Gerente, etc."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Descreva as responsabilidades deste perfil"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="ativo" className="text-sm font-medium text-slate-700">Perfil Ativo</label>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Permissões do Perfil</h4>
            <div className="max-h-[350px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-white sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-slate-600">Tela/Recurso</th>
                    <th className="px-2 py-2 text-center text-slate-600 w-20">Ver</th>
                    <th className="px-2 py-2 text-center text-slate-600 w-20">Editar</th>
                    <th className="px-2 py-2 text-center text-slate-600 w-20">Deletar</th>
                  </tr>
                </thead>
                <tbody>
                  {GRUPOS_RECURSOS.map(grupo => (
                    <>
                      <tr key={`grupo-${grupo.grupo}`} className="bg-slate-100">
                        <td colSpan={4} className="px-2 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {grupo.grupo}
                        </td>
                      </tr>
                      {grupo.recursos.map(recurso => {
                        const perm = permissoes.find(p => p.recurso === recurso.key);
                        return (
                          <tr key={recurso.key} className="bg-white border-b border-slate-100">
                            <td className="px-2 py-2 text-slate-700 pl-4">{recurso.label}</td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => togglePermissao(recurso.key, 'visualizar')}
                                className={`w-6 h-6 rounded flex items-center justify-center mx-auto ${
                                  perm?.pode_visualizar ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {perm?.pode_visualizar ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => togglePermissao(recurso.key, 'editar')}
                                className={`w-6 h-6 rounded flex items-center justify-center mx-auto ${
                                  perm?.pode_editar ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {perm?.pode_editar ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => togglePermissao(recurso.key, 'deletar')}
                                className={`w-6 h-6 rounded flex items-center justify-center mx-auto ${
                                  perm?.pode_deletar ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {perm?.pode_deletar ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
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
              {editing ? 'Salvar' : 'Criar Perfil'}
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
