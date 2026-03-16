import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Plane, CreditCard, DollarSign, FileText, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/formatters';

interface Venda {
  id: string;
  parceiro_id: string;
  programa_id: string;
  data_venda: string;
  quantidade_milhas: number;
  valor_total: number;
  valor_milheiro: number;
  lucro_real: number;
  custo_medio: number;
  custo_emissao: number;
  status: string;
  ordem_compra: string | null;
  cia_parceira: string | null;
  taxa_embarque: number;
  taxa_resgate: number;
  taxa_bagagem: number;
  data_voo_ida: string | null;
  data_voo_volta: string | null;
  nome_passageiro: string | null;
  quantidade_passageiros: number;
  trecho: string | null;
  tarifa_diamante: number;
  milhas_bonus: number;
  emissor: string | null;
  observacao: string | null;
  tipo_cliente: string | null;
  cartao_taxa_embarque_id: string | null;
  cartao_taxa_bagagem_id: string | null;
  cartao_taxa_resgate_id: string | null;
  parceiros: { nome_parceiro: string } | null;
  clientes: { nome_cliente: string } | null;
  programas_fidelidade: { nome: string } | null;
  localizadores: { codigo_localizador: string; status: string }[];
  cartao_embarque: { cartao: string } | null;
  cartao_bagagem: { cartao: string } | null;
  cartao_resgate: { cartao: string } | null;
}

export default function VendaLocalizador() {
  const { vendaId } = useParams<{ vendaId: string }>();
  const navigate = useNavigate();
  const [venda, setVenda] = useState<Venda | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vendaId) carregarVenda();
  }, [vendaId]);

  const carregarVenda = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          *,
          parceiros!vendas_parceiro_id_fkey(nome_parceiro),
          clientes!vendas_cliente_id_fkey(nome_cliente),
          programas_fidelidade!vendas_programa_id_fkey(nome),
          localizadores(codigo_localizador, status),
          cartao_embarque:cartoes_credito!vendas_cartao_taxa_embarque_id_fkey(cartao),
          cartao_bagagem:cartoes_credito!vendas_cartao_taxa_bagagem_id_fkey(cartao),
          cartao_resgate:cartoes_credito!vendas_cartao_taxa_resgate_id_fkey(cartao)
        `)
        .eq('id', vendaId)
        .single();

      if (error) throw error;
      setVenda(data);
    } catch (error) {
      console.error('Erro ao carregar venda:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      concluida: { label: 'Concluída', cls: 'bg-green-100 text-green-800' },
      pendente: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-800' },
      cancelada: { label: 'Cancelada', cls: 'bg-red-100 text-red-800' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${s.cls}`}>{s.label}</span>;
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const valorTotalVenda = venda
    ? (venda.valor_total || 0) + (venda.taxa_embarque || 0) + (venda.taxa_resgate || 0) + (venda.taxa_bagagem || 0)
    : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!venda) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Venda não encontrada.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/vendas')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detalhes da Venda</h1>
            {venda.ordem_compra && (
              <p className="text-sm text-gray-500 mt-0.5">OC: {venda.ordem_compra}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(venda.status)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Milhas Vendidas</div>
            <div className="text-xl font-bold text-gray-900">{venda.quantidade_milhas.toLocaleString('pt-BR')}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Valor Milheiro</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(venda.valor_milheiro)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Valor Total Venda</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(valorTotalVenda)}</div>
          </div>
          <div className={`rounded-xl border p-4 shadow-sm ${venda.lucro_real >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="text-xs text-gray-500 mb-1">Lucro</div>
            <div className={`text-xl font-bold ${venda.lucro_real >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(venda.lucro_real)}
            </div>
          </div>
        </div>

        {/* Dados Principais */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Informações da Venda</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 p-5">
            <Field label="Parceiro" value={venda.parceiros?.nome_parceiro} />
            <Field label="Cliente" value={venda.clientes?.nome_cliente} />
            <Field label="Programa" value={venda.programas_fidelidade?.nome} />
            <Field label="Data Emissão" value={formatDate(venda.data_venda)} />
            <Field label="Ordem de Compra" value={venda.ordem_compra} />
            <Field label="Localizador" value={venda.localizadores?.[0]?.codigo_localizador} />
            <Field label="Cia Parceira" value={venda.cia_parceira} />
            <Field label="Tipo Cliente" value={venda.tipo_cliente} />
            <Field label="Emissor" value={venda.emissor} />
          </div>
        </div>

        {/* Dados do Voo */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <Plane className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Informações do Voo</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 p-5">
            <Field label="Trecho" value={venda.trecho} />
            <Field label="Data Voo Ida" value={formatDate(venda.data_voo_ida)} />
            <Field label="Data Voo Volta" value={formatDate(venda.data_voo_volta)} />
            <Field label="Passageiro" value={venda.nome_passageiro} />
            <Field label="Qtd. Passageiros" value={venda.quantidade_passageiros?.toString()} />
            <Field label="Milhas Bônus" value={venda.milhas_bonus ? venda.milhas_bonus.toLocaleString('pt-BR') : undefined} />
            <Field label="Tarifa Diamante" value={venda.tarifa_diamante ? venda.tarifa_diamante.toLocaleString('pt-BR') : undefined} />
          </div>
        </div>

        {/* Taxas e Cartões */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <CreditCard className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Taxas e Cartões</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 p-5">
            <Field label="Taxa de Embarque" value={venda.taxa_embarque ? formatCurrency(venda.taxa_embarque) : undefined} />
            <Field label="Cartão TX Embarque" value={(venda.cartao_embarque as any)?.cartao} />
            <div />
            <Field label="Taxa de Resgate" value={venda.taxa_resgate ? formatCurrency(venda.taxa_resgate) : undefined} />
            <Field label="Cartão TX Resgate" value={(venda.cartao_resgate as any)?.cartao} />
            <div />
            <Field label="Bagagem/Tx Cancel./Assentos" value={venda.taxa_bagagem ? formatCurrency(venda.taxa_bagagem) : undefined} />
            <Field label="Cartão TX Bagagem" value={(venda.cartao_bagagem as any)?.cartao} />
          </div>
        </div>

        {/* Custos */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Custos</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 p-5">
            <Field label="Custo Médio" value={formatCurrency(venda.custo_medio)} />
            <Field label="Custo Emissão" value={formatCurrency(venda.custo_emissao)} />
            <Field label="Valor Total Venda" value={formatCurrency(valorTotalVenda)} />
          </div>
        </div>

        {/* Observação */}
        {venda.observacao && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Observação</span>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 whitespace-pre-line">{venda.observacao}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value || '-'}</div>
    </div>
  );
}
