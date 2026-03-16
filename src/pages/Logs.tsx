import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search } from 'lucide-react';

type Log = {
  id: string;
  data_hora: string;
  usuario_nome: string;
  acao: string;
  linha_afetada: string;
  dados_antes: any;
  dados_depois: any;
};

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('data_hora', { ascending: false })
        .limit(1000);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatData = (data: any) => {
    if (!data) return '-';
    return JSON.stringify(data, null, 2);
  };

  const filteredLogs = filterText
    ? logs.filter(log => {
        const searchText = filterText.toLowerCase();
        return (
          log.usuario_nome.toLowerCase().includes(searchText) ||
          log.acao.toLowerCase().includes(searchText) ||
          log.linha_afetada.toLowerCase().includes(searchText) ||
          formatDate(log.data_hora).toLowerCase().includes(searchText)
        );
      })
    : logs;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Logs</h1>
        <p className="text-slate-600 mb-4">
          Histórico de todas as ações no sistema (máximo 1000 registros)
        </p>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar em todos os campos..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
          />
          {filterText && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-sm text-slate-500">
              {filteredLogs.length} resultado{filteredLogs.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">Nenhum log registrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    Data/Hora
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    Usuário
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    Ação
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    Linha Afetada
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    Dados Antes
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    Dados Depois
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                      {formatDate(log.data_hora)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                      {log.usuario_nome}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          log.acao === 'INSERT'
                            ? 'bg-green-100 text-green-700'
                            : log.acao === 'UPDATE'
                            ? 'bg-blue-100 text-blue-700'
                            : log.acao === 'DELETE'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                      {log.linha_afetada}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:underline">
                          {log.dados_antes ? 'Ver dados' : '-'}
                        </summary>
                        {log.dados_antes && (
                          <pre className="mt-2 text-xs bg-slate-50 p-2 rounded max-w-xs overflow-auto">
                            {formatData(log.dados_antes)}
                          </pre>
                        )}
                      </details>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:underline">
                          {log.dados_depois ? 'Ver dados' : '-'}
                        </summary>
                        {log.dados_depois && (
                          <pre className="mt-2 text-xs bg-slate-50 p-2 rounded max-w-xs overflow-auto">
                            {formatData(log.dados_depois)}
                          </pre>
                        )}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
