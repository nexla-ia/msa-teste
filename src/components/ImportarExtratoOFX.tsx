import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OFXTransaction {
  fitid: string;
  date: string;        // YYYY-MM-DD
  amount: number;      // sempre positivo
  tipo: 'credito' | 'debito';
  description: string;
  trntype: string;     // CREDIT, DEBIT, PAYMENT, etc.
}

interface OFXHeader {
  org: string;       // nome do banco
  bankId: string;    // código do banco (077, 237...)
  acctId: string;    // número da conta
  dtStart: string;   // início do período YYYY-MM-DD
  dtEnd: string;     // fim do período YYYY-MM-DD
  balAmt: number | null; // saldo final
  dtAsOf: string;    // data do saldo YYYY-MM-DD
}

interface Props {
  contaBancariaId: string;
  contaBancariaNome: string;
  mesReferencia: string; // "YYYY-MM"
  onImportSuccess: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const dtOFXToISO = (dt: string): string => {
  if (!dt || dt.length < 8) return '';
  return `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`;
};

// ── Parser OFX ─────────────────────────────────────────────────────────────
function parseOFX(content: string): { transactions: OFXTransaction[]; warnings: string[]; header: OFXHeader } {
  const warnings: string[] = [];
  const transactions: OFXTransaction[] = [];

  // Extrai qualquer tag do conteúdo completo (para o header)
  const getGlobal = (tag: string): string => {
    const m = content.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'));
    return m ? m[1].trim() : '';
  };

  const header: OFXHeader = {
    org:     getGlobal('ORG') || getGlobal('FI'),
    bankId:  getGlobal('BANKID'),
    acctId:  getGlobal('ACCTID'),
    dtStart: dtOFXToISO(getGlobal('DTSTART')),
    dtEnd:   dtOFXToISO(getGlobal('DTEND')),
    balAmt:  (() => { const v = parseFloat(getGlobal('BALAMT').replace(',', '.')); return isNaN(v) ? null : v; })(),
    dtAsOf:  dtOFXToISO(getGlobal('DTASOF')),
  };

  const body = content.includes('<OFX>')
    ? content.substring(content.indexOf('<OFX>'))
    : content;

  const blocks = body.match(/<STMTTRN[\s\S]*?<\/STMTTRN>/gi) || [];

  if (blocks.length === 0) {
    warnings.push('Nenhuma transação encontrada no arquivo OFX.');
    return { transactions, warnings, header };
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
    const trntype = get('TRNTYPE') || '';
    const memo    = get('MEMO') || get('NAME') || 'Sem descrição';

    if (!fitid || !dtpost || !trnamt) {
      warnings.push(`Transação ${idx + 1}: campos obrigatórios ausentes — ignorada.`);
      return;
    }

    const date  = dtOFXToISO(dtpost);

    const valor = parseFloat(trnamt.replace(',', '.'));
    if (isNaN(valor)) {
      warnings.push(`Transação ${idx + 1}: valor inválido "${trnamt}" — ignorada.`);
      return;
    }

    // TRNTYPE como fallback: se o valor for zero, usa o tipo para determinar direção
    const tipoByType = (['CREDIT', 'DEP', 'INT', 'DIV', 'DIRECTDEP'].includes(trntype.toUpperCase()))
      ? 'credito'
      : (['DEBIT', 'PAYMENT', 'CHECK', 'POS', 'ATM', 'FEE', 'DIRECTDEBIT'].includes(trntype.toUpperCase()))
        ? 'debito'
        : null;
    const tipo: 'credito' | 'debito' = valor !== 0
      ? (valor > 0 ? 'credito' : 'debito')
      : (tipoByType ?? 'debito');

    transactions.push({
      fitid,
      date,
      amount: Math.abs(valor),
      tipo,
      description: memo,
      trntype: trntype.toUpperCase(),
    });
  });

  return { transactions, warnings, header };
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
  const [ofxHeader, setOfxHeader] = useState<OFXHeader | null>(null);
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
      const { transactions: txs, warnings: warns, header } = parseOFX(content);
      setTransactions(txs);
      setWarnings(warns);
      setOfxHeader(header);
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
    setWarnings([]);

    // 1. Descobre quais fitids já existem para evitar duplicatas
    const { data: existing } = await supabase
      .from('conciliacao_bancaria')
      .select('fitid')
      .eq('conta_bancaria_id', contaBancariaId)
      .in('fitid', transactions.map(t => t.fitid));

    const existingFitids = new Set((existing || []).map((e: any) => e.fitid));
    const novas = transactions.filter(t => !existingFitids.has(t.fitid));
    const duplicatas = transactions.length - novas.length;

    if (novas.length === 0) {
      setImportResult({ inseridos: 0, duplicatas });
      setLoading(false);
      setEtapa('sucesso');
      onImportSuccess();
      return;
    }

    // 2. Cria os lançamentos financeiros para as transações novas
    const lancRecords = novas.map(t => ({
      data_lancamento:  t.date,
      descricao:        t.description,
      valor:            t.amount,
      tipo:             t.tipo === 'credito' ? 'entrada' : 'saida',
      conta_bancaria_id: contaBancariaId,
      conciliado:       false,
      observacao:       `Importado OFX · ${t.trntype || t.tipo}`,
    }));

    const { data: lancData, error: lancErr } = await supabase
      .from('lancamentos_financeiros')
      .insert(lancRecords)
      .select('id');

    if (lancErr) {
      setWarnings([`Erro ao criar lançamentos: ${lancErr.message}`]);
      setLoading(false);
      return;
    }

    // 3. Cria os registros de conciliação já vinculados aos lançamentos
    const concRecords = novas.map((t, i) => ({
      conta_bancaria_id: contaBancariaId,
      data_extrato:      t.date,
      descricao_extrato: t.description,
      valor_extrato:     t.amount,
      tipo:              t.tipo,
      lancamento_id:     lancData![i].id,
      status:            'pendente',
      fitid:             t.fitid,
      updated_at:        new Date().toISOString(),
    }));

    const { error: concErr } = await supabase
      .from('conciliacao_bancaria')
      .insert(concRecords);

    if (concErr) {
      setWarnings([`Erro ao criar conciliação: ${concErr.message}`]);
      setLoading(false);
      return;
    }

    setImportResult({ inseridos: novas.length, duplicatas });
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
    setOfxHeader(null);
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
                  {/* Card de informações do arquivo OFX */}
                  {ofxHeader && (
                    <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      {ofxHeader.org && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 w-16 shrink-0">Banco</span>
                          <span className="font-medium text-slate-700">{ofxHeader.org}{ofxHeader.bankId ? ` (${ofxHeader.bankId})` : ''}</span>
                        </div>
                      )}
                      {ofxHeader.acctId && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 w-16 shrink-0">Conta</span>
                          <span className="font-medium text-slate-700">{ofxHeader.acctId}</span>
                        </div>
                      )}
                      {(ofxHeader.dtStart || ofxHeader.dtEnd) && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 w-16 shrink-0">Período</span>
                          <span className="font-medium text-slate-700">
                            {ofxHeader.dtStart ? fmtDate(ofxHeader.dtStart) : '?'} → {ofxHeader.dtEnd ? fmtDate(ofxHeader.dtEnd) : '?'}
                          </span>
                        </div>
                      )}
                      {ofxHeader.balAmt !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 w-16 shrink-0">Saldo final</span>
                          <span className={`font-semibold ${ofxHeader.balAmt >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {fmtBRL(ofxHeader.balAmt)}
                            {ofxHeader.dtAsOf && <span className="text-slate-400 font-normal ml-1">em {fmtDate(ofxHeader.dtAsOf)}</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

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
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importando {transactions.length} transações…
                      </>
                    ) : 'Confirmar Importação'}
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
