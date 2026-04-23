import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, CheckCircle, AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const ACCENT = { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700', border: 'border-purple-100' };

interface Emissao {
  id: string;
  data: string;
  data_embarque: string | null;
  programa_id: string | null;
  parceiro_id: string | null;
  passageiro: string | null;
  origem: string | null;
  destino: string | null;
  localizacao: string | null;
  quantidade_milhas: number;
  quantidade_passageiros: number;
  status: string;
  arquivo_origem: string | null;
  programa?: { nome: string } | null;
  parceiro?: { nome_parceiro: string } | null;
}

interface Parceiro { id: string; nome_parceiro: string; }
interface Programa { id: string; nome: string; }

interface PreviewRow {
  data: string;
  data_embarque: string;
  programa: string;
  parceiro: string;
  passageiro: string;
  origem: string;
  destino: string;
  localizacao: string;
  quantidade_milhas: string;
  quantidade_passageiros: string;
  status: string;
  _erro?: string;
}

function parseExcelDate(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(val).trim();
  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

function normalizeStatus(val: unknown): string {
  const s = String(val || '').toLowerCase().trim();
  if (s === 'cancelado' || s === 'cancelada' || s === 'cancel') return 'cancelado';
  return 'ativo';
}

const COLUMN_ALIASES: Record<string, string[]> = {
  data:                  ['data', 'date', 'dt'],
  data_embarque:         ['data embarque', 'data_embarque', 'embarque', 'dt embarque'],
  programa:              ['programa', 'programa fidelidade', 'programa de fidelidade', 'fidelidade'],
  parceiro:              ['parceiro', 'parceiros', 'cia', 'companhia'],
  passageiro:            ['passageiro', 'passageiros', 'pax', 'nome'],
  origem:                ['origem', 'from', 'de'],
  destino:               ['destino', 'to', 'para'],
  localizacao:           ['localização', 'localizacao', 'localizador', 'localz', 'localz.', 'loc', 'pnr'],
  quantidade_milhas:     ['qtd milhas', 'quantidade milhas', 'milhas', 'miles', 'pontos'],
  quantidade_passageiros:['qtd passageiros', 'qtd passageiro', 'quantidade passageiros', 'passageiros', 'pax qtd'],
  status:                ['status', 'situação', 'situacao', 'ativo/cancelado'],
};

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const norm = h.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(norm) && !(field in map)) {
        map[field] = i;
      }
    }
  });
  return map;
}

export default function VendaUpload() {
  const { usuario } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [emissoes, setEmissoes] = useState<Emissao[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; err: number } | null>(null);

  const [dialog, setDialog] = useState<{
    isOpen: boolean; type: 'success' | 'error' | 'confirm' | 'warning';
    title: string; message: string; onConfirm?: () => void;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: em }, { data: pa }, { data: pr }] = await Promise.all([
      supabase.from('controle_emissoes')
        .select('*, programa:programas_fidelidade(nome), parceiro:parceiros(nome_parceiro)')
        .eq('tipo_venda', 'upload')
        .order('data', { ascending: false }),
      supabase.from('parceiros').select('id,nome_parceiro').order('nome_parceiro'),
      supabase.from('programas_fidelidade').select('id,nome').order('nome'),
    ]);
    setEmissoes((em || []) as Emissao[]);
    setParceiros(pa || []);
    setProgramas(pr || []);
    setLoading(false);
  };

  const fmtDate = (s: string | null) => {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  };

  const fmtNum = (n: number) => n.toLocaleString('pt-BR');

  // ── KPIs ──
  const totalEmissoes = emissoes.length;
  const totalMilhas = emissoes.reduce((a, e) => a + (e.quantidade_milhas || 0), 0);
  const totalPax = emissoes.reduce((a, e) => a + (e.quantidade_passageiros || 0), 0);

  // ── Filtro ──
  const filtered = emissoes.filter(e => {
    const txt = busca.toLowerCase();
    const match =
      !txt ||
      (e.passageiro || '').toLowerCase().includes(txt) ||
      (e.origem || '').toLowerCase().includes(txt) ||
      (e.destino || '').toLowerCase().includes(txt) ||
      (e.localizacao || '').toLowerCase().includes(txt) ||
      (e.programa?.nome || '').toLowerCase().includes(txt) ||
      (e.parceiro?.nome_parceiro || '').toLowerCase().includes(txt) ||
      (e.arquivo_origem || '').toLowerCase().includes(txt);
    const matchStatus = !filtroStatus || e.status === filtroStatus;
    return match && matchStatus;
  });

  // ── Resolve IDs from name strings ──
  const resolveProgramaId = (nome: string): string | null => {
    const n = nome.trim().toLowerCase();
    const p = programas.find(p => p.nome.toLowerCase() === n);
    return p?.id || null;
  };

  const resolveParceiroId = (nome: string): string | null => {
    const n = nome.trim().toLowerCase();
    const p = parceiros.find(p => p.nome_parceiro.toLowerCase() === n);
    return p?.id || null;
  };

  // ── File handling ──
  const handleFile = (file: File) => {
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const wb = XLSX.read(data, { type: 'binary', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
      if (!rows.length) return;

      const headers = (rows[0] as unknown[]).map(h => String(h || ''));
      const colMap = mapHeaders(headers);

      const preview: PreviewRow[] = rows.slice(1)
        .filter(row => (row as unknown[]).some(c => c !== null && c !== undefined && c !== ''))
        .map(row => {
          const r = row as unknown[];
          const get = (field: string) => {
            const idx = colMap[field];
            return idx !== undefined ? r[idx] : undefined;
          };
          const dataVal = parseExcelDate(get('data'));
          const erros: string[] = [];
          if (!dataVal) erros.push('Data inválida');
          return {
            data: dataVal,
            data_embarque: parseExcelDate(get('data_embarque')),
            programa: String(get('programa') || '').trim(),
            parceiro: String(get('parceiro') || '').trim(),
            passageiro: String(get('passageiro') || '').trim(),
            origem: String(get('origem') || '').trim(),
            destino: String(get('destino') || '').trim(),
            localizacao: String(get('localizacao') || '').trim(),
            quantidade_milhas: String(get('quantidade_milhas') || '0').trim(),
            quantidade_passageiros: String(get('quantidade_passageiros') || '1').trim(),
            status: normalizeStatus(get('status')),
            _erro: erros.length ? erros.join(', ') : undefined,
          };
        });
      setPreview(preview);
    };
    reader.readAsBinaryString(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const cancelPreview = () => {
    setPreview(null);
    setFileName('');
  };

  const confirmImport = async () => {
    if (!preview) return;
    const valid = preview.filter(r => !r._erro);
    if (!valid.length) {
      setDialog({ isOpen: true, type: 'warning', title: 'Sem dados válidos', message: 'Nenhuma linha válida para importar.' });
      return;
    }
    setImporting(true);
    const rows = valid.map(r => ({
      tipo_venda: 'upload' as const,
      data: r.data,
      data_embarque: r.data_embarque || null,
      programa_id: r.programa ? resolveProgramaId(r.programa) : null,
      parceiro_id: r.parceiro ? resolveParceiroId(r.parceiro) : null,
      passageiro: r.passageiro || null,
      origem: r.origem || null,
      destino: r.destino || null,
      localizacao: r.localizacao || null,
      quantidade_milhas: parseFloat(r.quantidade_milhas.replace(/\./g, '').replace(',', '.')) || 0,
      quantidade_passageiros: parseInt(r.quantidade_passageiros) || 1,
      status: r.status,
      arquivo_origem: fileName,
      created_by: usuario?.id || null,
    }));

    const { error } = await supabase.from('controle_emissoes').insert(rows);
    setImporting(false);
    if (error) {
      setDialog({ isOpen: true, type: 'error', title: 'Erro ao importar', message: error.message });
    } else {
      setImportResult({ ok: rows.length, err: preview.length - valid.length });
      setPreview(null);
      setFileName('');
      load();
    }
  };

  const handleDelete = (id: string) => {
    setDialog({
      isOpen: true, type: 'confirm',
      title: 'Excluir emissão',
      message: 'Deseja excluir este registro?',
      onConfirm: async () => {
        const { error } = await supabase.from('controle_emissoes').delete().eq('id', id);
        if (error) {
          setDialog({ isOpen: true, type: 'error', title: 'Erro', message: error.message });
        } else {
          load();
        }
      },
    });
  };

  const KPI = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className={`${ACCENT.bg} ${ACCENT.border} border rounded-xl p-4 flex flex-col gap-1`}>
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${ACCENT.value}`}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Venda por Upload</h1>
          <p className="text-slate-500 text-sm mt-0.5">Importe planilhas Excel/CSV com emissões de passagens</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Upload size={16} />
          Importar Planilha
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPI label="Total Emissões" value={fmtNum(totalEmissoes)} />
        <KPI label="Total Milhas" value={fmtNum(totalMilhas)} />
        <KPI label="Total Passageiros" value={fmtNum(totalPax)} />
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-green-800 font-medium text-sm">
              Importação concluída: {importResult.ok} registros inseridos
              {importResult.err > 0 && `, ${importResult.err} ignorados (sem data)`}.
            </p>
          </div>
          <button onClick={() => setImportResult(null)} className="text-green-600 hover:text-green-800">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Drop zone (shown when no preview) */}
      {!preview && (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors"
        >
          <FileSpreadsheet size={40} className="text-slate-400" />
          <p className="text-slate-500 text-sm font-medium">Arraste uma planilha aqui ou clique para selecionar</p>
          <p className="text-slate-400 text-xs">Formatos aceitos: .xlsx, .xls, .csv</p>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-purple-600" />
              <span className="font-semibold text-slate-700 text-sm">{fileName}</span>
              <span className="text-xs text-slate-400">— {preview.length} linhas</span>
              {preview.some(r => r._erro) && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <AlertCircle size={12} />
                  {preview.filter(r => r._erro).length} com erro
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={cancelPreview} className="text-slate-500 hover:text-slate-700 text-sm px-3 py-1 rounded-lg border border-slate-200">
                Cancelar
              </button>
              <button
                onClick={confirmImport}
                disabled={importing || preview.filter(r => !r._erro).length === 0}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                {importing ? 'Importando...' : `Importar ${preview.filter(r => !r._erro).length} registros`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {['Data','Embarque','Programa','Parceiro','Passageiro','Origem','Destino','Localiz.','Milhas','Pax','Status',''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className={r._erro ? 'bg-red-50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.data ? fmtDate(r.data) : <span className="text-red-500">—</span>}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">{r.data_embarque ? fmtDate(r.data_embarque) : '—'}</td>
                    <td className="px-3 py-1.5 max-w-[120px] truncate">{r.programa || '—'}</td>
                    <td className="px-3 py-1.5 max-w-[100px] truncate">{r.parceiro || '—'}</td>
                    <td className="px-3 py-1.5 max-w-[120px] truncate">{r.passageiro || '—'}</td>
                    <td className="px-3 py-1.5">{r.origem || '—'}</td>
                    <td className="px-3 py-1.5">{r.destino || '—'}</td>
                    <td className="px-3 py-1.5">{r.localizacao || '—'}</td>
                    <td className="px-3 py-1.5 text-right">{r.quantidade_milhas || '0'}</td>
                    <td className="px-3 py-1.5 text-center">{r.quantidade_passageiros || '1'}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      {r._erro && (
                        <span className="flex items-center gap-1 text-red-600 text-xs" title={r._erro}>
                          <AlertCircle size={12} /> {r._erro}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Buscar passageiro, origem, destino, localizador..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Data','Dt. Embarque','Programa','Parceiro','Passageiro','Origem','Destino','Localiz.','Milhas','Pax','Arquivo','Status','Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-400">Nenhuma emissão encontrada.</td></tr>
              ) : (
                filtered.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">{fmtDate(e.data)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{fmtDate(e.data_embarque)}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[140px] truncate">{e.programa?.nome || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[120px] truncate">{e.parceiro?.nome_parceiro || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[130px] truncate">{e.passageiro || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{e.origem || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{e.destino || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{e.localizacao || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtNum(e.quantidade_milhas)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{e.quantidade_passageiros}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[120px] truncate" title={e.arquivo_origem || ''}>{e.arquivo_origem || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        e.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {e.status === 'cancelado' ? 'Cancelado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(e.id)} className="text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={8} className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Totais</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{fmtNum(filtered.reduce((a, e) => a + e.quantidade_milhas, 0))}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{filtered.reduce((a, e) => a + e.quantidade_passageiros, 0)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        onConfirm={dialog.onConfirm}
        onClose={() => setDialog(d => ({ ...d, isOpen: false }))}
      />
    </div>
  );
}
