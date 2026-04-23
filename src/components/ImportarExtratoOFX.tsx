import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OFXTransaction {
  fitid: string;
  date: string;        // YYYY-MM-DD
  amount: number;      // sempre positivo
  tipo: 'credito' | 'debito';
  description: string;
}

interface Props {
  contaBancariaId: string;
  contaBancariaNome: string;
  mesReferencia: string; // "YYYY-MM"
  onImportSuccess: () => void;
}

// ── Parser OFX ─────────────────────────────────────────────────────────────
function parseOFX(content: string): { transactions: OFXTransaction[]; warnings: string[] } {
  const warnings: string[] = [];
  const transactions: OFXTransaction[] = [];

  const body = content.includes('<OFX>')
    ? content.substring(content.indexOf('<OFX>'))
    : content;

  const blocks = body.match(/<STMTTRN[\s\S]*?<\/STMTTRN>/gi) || [];

  if (blocks.length === 0) {
    warnings.push('Nenhuma transação encontrada no arquivo OFX.');
    return { transactions, warnings };
  }

  blocks.forEach((block, idx) => {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'))
        || block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, 'i'));
      return m ? m[1].trim() : null;
    };

    const fitid   = get('FITID');
    const dtpost  = get('DTPOSTED');
    const trnamt  = get('TRNAMT');
    const trntype = get('TRNTYPE');
    const memo    = get('MEMO') || get('NAME') || 'Sem descrição';

    if (!fitid || !dtpost || !trnamt || !trntype) {
      warnings.push(`Transação ${idx + 1}: campos obrigatórios ausentes — ignorada.`);
      return;
    }

    const year  = dtpost.substring(0, 4);
    const month = dtpost.substring(4, 6);
    const day   = dtpost.substring(6, 8);
    const date  = `${year}-${month}-${day}`;

    const valor = parseFloat(trnamt.replace(',', '.'));
    if (isNaN(valor)) {
      warnings.push(`Transação ${idx + 1}: valor inválido "${trnamt}" — ignorada.`);
      return;
    }

    transactions.push({
      fitid,
      date,
      amount: Math.abs(valor),
      tipo: valor >= 0 ? 'credito' : 'debito',
      description: memo,
    });
  });

  return { transactions, warnings };
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

export default function ImportarExtratoOFX({ contaBancariaId, contaBancariaNome, mesReferencia, onImportSuccess }: Props) {
  const [open, setOpen]       = useState(false);
  const [etapa, setEtapa]     = useState<'upload' | 'preview' | 'sucesso'>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [transactions, setTransactions] = useState<OFXTransaction[]>([]);
  const [warnings, setWarnings]   = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [importResult, setImportResult] = useState<{ inseridos: number; duplicatas: number }>({ inseridos: 0, duplicatas: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ofx')) {
      setWarnings(['Arquivo inválido. Selecione um arquivo .ofx']);
      return;
    }
    setFileName(file.name);
    setWarnings([]);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const { transactions: txs, warnings: warns } = parseOFX(content);
      setTransactions(txs);
      setWarnings(warns);
      setLoading(false);
      if (txs.length > 0) setEtapa('preview');
    };
    reader.onerror = () => { setWarnings(['Erro ao ler o arquivo.']); setLoading(false); };
    reader.readAsText(file, 'ISO-8859-1');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const confirmar = async () => {
    setLoading(true);
    let inseridos = 0;
    let duplicatas = 0;

    for (const t of transactions) {
      // Verifica duplicata pelo fitid + conta
      const { data: existente } = await supabase
        .from('conciliacao_bancaria')
        .select('id')
        .eq('fitid', t.fitid)
        .eq('conta_bancaria_id', contaBancariaId)
        .maybeSingle();

      if (existente) { duplicatas++; continue; }

      const { error } = await supabase.from('conciliacao_bancaria').insert({
        conta_bancaria_id:  contaBancariaId,
        data_extrato:       t.date,
        descricao_extrato:  t.description,
        valor_extrato:      t.amount,
        tipo:               t.tipo,
        status:             'pendente',
        fitid:              t.fitid,
        updated_at:         new Date().toISOString(),
      });

      if (error) { setWarnings(w => [...w, `Erro ao salvar "${t.description}": ${error.message}`]); }
      else inseridos++;
    }

    setImportResult({ inseridos, duplicatas });
    setLoading(false);
    setEtapa('sucesso');
    onImportSuccess();
  };

  const fechar = () => {
    setOpen(false);
    setEtapa('upload');
    setTransactions([]);
    setWarnings([]);
    setFileName('');
    setImportResult({ inseridos: 0, duplicatas: 0 });
  };

  const creditos = transactions.filter(t => t.tipo === 'credito');
  const debitos  = transactions.filter(t => t.tipo === 'debito');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
      >
        <Upload className="w-4 h-4" /> Importar OFX
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Importar Extrato OFX</h2>
                <p className="text-sm text-slate-500">{contaBancariaNome} · {mesReferencia}</p>
              </div>
              <button onClick={fechar} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">

              {/* ETAPA 1 — Upload */}
              {etapa === 'upload' && (
                <>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                      dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                    <p className="text-slate-700 font-medium">Arraste o arquivo OFX aqui</p>
                    <p className="text-sm text-slate-400 mt-1">ou clique para selecionar</p>
                    <input ref={inputRef} type="file" accept=".ofx" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
                  </div>
                  {loading && (
                    <div className="flex items-center gap-2 mt-4 text-blue-600 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Processando arquivo...
                    </div>
                  )}
                  {warnings.length > 0 && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                      {warnings.map((w, i) => (
                        <p key={i} className="text-sm text-red-700 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {w}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ETAPA 2 — Preview */}
              {etapa === 'preview' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{transactions.length}</span> transações em{' '}
                      <span className="font-medium">{fileName}</span>
                    </p>
                    <div className="flex gap-2 text-xs">
                      <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                        ↑ {creditos.length} créditos · {fmtBRL(creditos.reduce((s, t) => s + t.amount, 0))}
                      </span>
                      <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                        ↓ {debitos.length} débitos · {fmtBRL(debitos.reduce((s, t) => s + t.amount, 0))}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-72 border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium text-xs">Data</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium text-xs">Descrição</th>
                          <th className="text-right px-3 py-2 text-slate-500 font-medium text-xs">Valor</th>
                          <th className="text-center px-3 py-2 text-slate-500 font-medium text-xs">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.map(t => (
                          <tr key={t.fitid} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-xs">{fmtDate(t.date)}</td>
                            <td className="px-3 py-2 text-slate-700 max-w-xs truncate text-xs">{t.description}</td>
                            <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap text-xs ${t.tipo === 'credito' ? 'text-green-700' : 'text-red-700'}`}>
                              {t.tipo === 'credito' ? '+' : '-'} {fmtBRL(t.amount)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${t.tipo === 'credito' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {t.tipo === 'credito' ? 'Crédito' : 'Débito'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {warnings.length > 0 && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-700 font-semibold mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {warnings.length} aviso(s)
                      </p>
                      {warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
                    </div>
                  )}
                </>
              )}

              {/* ETAPA 3 — Sucesso */}
              {etapa === 'sucesso' && (
                <div className="text-center py-8">
                  <CheckCircle className="w-14 h-14 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">Extrato importado!</h3>
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">{importResult.inseridos}</span> transações adicionadas à Conciliação Bancária.
                    {importResult.duplicatas > 0 && (
                      <> <span className="text-amber-600">{importResult.duplicatas} duplicata(s) ignorada(s).</span></>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              {etapa === 'upload' && (
                <button onClick={fechar} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
              )}
              {etapa === 'preview' && (
                <>
                  <button onClick={() => setEtapa('upload')} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Voltar</button>
                  <button
                    onClick={confirmar}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmar Importação
                  </button>
                </>
              )}
              {etapa === 'sucesso' && (
                <button onClick={fechar} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                  Fechar
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
