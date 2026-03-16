import { ReactNode, useState } from 'react';
import { Edit, Trash2, Plus, Search, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  sumable?: boolean;
};

type CrudTableProps<T> = {
  title: string;
  data: T[];
  columns: Column<T>[];
  onAdd: () => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  loading?: boolean;
  idKey?: keyof T;
  showTotals?: boolean;
  extraActions?: (item: T) => ReactNode;
  recurso?: string;
};

export default function CrudTable<T extends Record<string, any>>({
  title,
  data,
  columns,
  onAdd,
  onEdit,
  onDelete,
  loading = false,
  idKey = 'id' as keyof T,
  showTotals = false,
  extraActions,
  recurso
}: CrudTableProps<T>) {
  const { isAdmin, temPermissao } = useAuth();

  const podeEditar = recurso ? (isAdmin || temPermissao(recurso, 'editar')) : isAdmin;
  const podeDeletar = recurso ? (isAdmin || temPermissao(recurso, 'deletar')) : isAdmin;
  const podeAdicionar = recurso ? (isAdmin || temPermissao(recurso, 'editar')) : isAdmin;
  const [filterText, setFilterText] = useState('');

  const filteredData = filterText
    ? data.filter(item => {
        const searchText = filterText.toLowerCase();
        return Object.values(item).some(val => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'object') return false;
          return String(val).toLowerCase().includes(searchText);
        });
      })
    : data;

  const calculateTotal = (col: Column<T>) => {
    if (!col.sumable) return null;
    const total = filteredData.reduce((sum, item) => {
      const keys = String(col.key).split('.');
      let value = item;
      for (const k of keys) {
        value = value?.[k];
      }
      return sum + (Number(value) || 0);
    }, 0);
    return col.render ? col.render({ [col.key]: total } as any) : total.toFixed(2);
  };

  const exportToExcel = () => {
    const exportData = filteredData.map(item => {
      const row: any = {};
      columns.forEach(col => {
        const keys = String(col.key).split('.');
        let value = item;
        for (const k of keys) {
          value = value?.[k];
        }

        if (col.render) {
          const rendered = col.render(item);
          row[col.label] = typeof rendered === 'string' || typeof rendered === 'number'
            ? rendered
            : String(value || '');
        } else {
          row[col.label] = value || '';
        }
      });
      return row;
    });

    if (showTotals) {
      const totalRow: any = {};
      columns.forEach((col, idx) => {
        if (idx === 0) {
          totalRow[col.label] = 'TOTAL';
        } else {
          const total = calculateTotal(col);
          totalRow[col.label] = total || '';
        }
      });
      exportData.push(totalRow);
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title);

    const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-1">{title}</h1>
            <p className="text-slate-600">Gerencie os registros de {title.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              disabled={filteredData.length === 0}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
              title="Exportar para Excel"
            >
              <Download className="w-5 h-5" />
              Exportar
            </button>
            {podeAdicionar && (
              <button
                onClick={onAdd}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
              >
                <Plus className="w-5 h-5" />
                Adicionar
              </button>
            )}
          </div>
        </div>

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
              {filteredData.length} resultado{filteredData.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                  {(podeEditar || podeDeletar) && (
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap sticky right-0 bg-slate-50">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.map((item, rowIdx) => (
                  <tr key={item[idKey] || rowIdx} className="hover:bg-slate-50 transition-colors">
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                        {col.render
                          ? col.render(item)
                          : String(item[col.key] || '-')}
                      </td>
                    ))}
                    {(podeEditar || podeDeletar) && (
                      <td className="px-6 py-4 text-right sticky right-0 bg-white group-hover:bg-slate-50">
                        <div className="flex items-center justify-end gap-2">
                          {extraActions && extraActions(item)}
                          {podeEditar && (
                            <button
                              onClick={() => onEdit(item)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {podeDeletar && (
                            <button
                              onClick={() => onDelete(item)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {showTotals && (
                  <tr className="bg-slate-100 font-semibold">
                    {columns.map((col, idx) => (
                      <td key={idx} className="px-6 py-4 text-sm text-slate-800 whitespace-nowrap">
                        {idx === 0 ? 'TOTAL' : calculateTotal(col) || ''}
                      </td>
                    ))}
                    {(podeEditar || podeDeletar) && <td className="px-6 py-4"></td>}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
