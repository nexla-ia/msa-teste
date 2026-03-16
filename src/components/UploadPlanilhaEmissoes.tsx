import { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface EmissaoLinha {
  data_emissao: string;
  cpfs: number;
  milhas: number;
  localizador: string;
  passageiro: string;
  cpf: string;
}

interface Props {
  vendaId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadPlanilhaEmissoes({ vendaId, onClose, onSuccess }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [preview, setPreview] = useState<EmissaoLinha[]>([]);

  const handleArquivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);
    setErro('');
    setSucesso('');

    try {
      const dados = await lerPlanilha(file);
      setPreview(dados.slice(0, 5));
    } catch (error: any) {
      setErro(error.message || 'Erro ao ler planilha');
    }
  };

  const lerPlanilha = async (file: File): Promise<EmissaoLinha[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          const emissoes: EmissaoLinha[] = json.map((row: any) => ({
            data_emissao: row['Data Emissão'] || row['data_emissao'] || new Date().toISOString().split('T')[0],
            cpfs: parseInt(row['CPFs'] || row['cpfs'] || '1'),
            milhas: parseFloat(row['Milhas'] || row['milhas'] || '0'),
            localizador: String(row['Localizador'] || row['localizador'] || ''),
            passageiro: String(row['Passageiro'] || row['passageiro'] || ''),
            cpf: String(row['CPF'] || row['cpf'] || ''),
          }));

          if (emissoes.length === 0) {
            reject(new Error('Planilha vazia'));
            return;
          }

          resolve(emissoes);
        } catch (error) {
          reject(new Error('Erro ao processar planilha'));
        }
      };

      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsBinaryString(file);
    });
  };

  const processar = async () => {
    if (!arquivo) return;

    setProcessando(true);
    setErro('');
    setSucesso('');

    try {
      const emissoes = await lerPlanilha(arquivo);

      const totalMilhas = emissoes.reduce((sum, e) => sum + e.milhas, 0);

      const passagensData = emissoes.map(e => ({
        venda_id: vendaId,
        data_emissao: e.data_emissao,
        cpfs: e.cpfs,
        milhas: e.milhas,
        localizador: e.localizador,
        passageiro: e.passageiro,
        cpf: e.cpf,
      }));

      const { error: insertError } = await supabase
        .from('passagens_emitidas')
        .insert(passagensData);

      if (insertError) throw insertError;

      const { error: funcError } = await supabase.rpc('processar_emissao_massa', {
        p_venda_id: vendaId,
        p_quantidade_emitida: totalMilhas,
      });

      if (funcError) throw funcError;

      setSucesso(`${emissoes.length} emissões processadas com sucesso! Total de ${totalMilhas.toLocaleString()} milhas.`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error: any) {
      setErro(error.message || 'Erro ao processar emissões');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Upload de Planilha de Emissões</h2>
              <p className="text-sm text-slate-600">Formatos aceitos: .xlsx, .xls, .csv</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Formato da Planilha</h3>
            <p className="text-sm text-blue-800 mb-2">A planilha deve conter as seguintes colunas:</p>
            <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
              <li><strong>Data Emissão</strong>: Data da emissão (formato: DD/MM/AAAA)</li>
              <li><strong>CPFs</strong>: Número de CPFs (número inteiro)</li>
              <li><strong>Milhas</strong>: Quantidade de milhas (número)</li>
              <li><strong>Localizador</strong>: Código do localizador</li>
              <li><strong>Passageiro</strong>: Nome do passageiro</li>
              <li><strong>CPF</strong>: CPF do passageiro</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Selecionar Arquivo
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleArquivoChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">
                  {arquivo ? arquivo.name : 'Clique para selecionar ou arraste o arquivo'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Máximo 10 MB
                </p>
              </label>
            </div>
          </div>

          {preview.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Pré-visualização (primeiras 5 linhas)</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-left">CPFs</th>
                      <th className="px-4 py-2 text-left">Milhas</th>
                      <th className="px-4 py-2 text-left">Localizador</th>
                      <th className="px-4 py-2 text-left">Passageiro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((linha, idx) => (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="px-4 py-2">{linha.data_emissao}</td>
                        <td className="px-4 py-2">{linha.cpfs}</td>
                        <td className="px-4 py-2">{linha.milhas.toLocaleString()}</td>
                        <td className="px-4 py-2">{linha.localizador}</td>
                        <td className="px-4 py-2">{linha.passageiro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Erro</p>
                <p className="text-sm text-red-800">{erro}</p>
              </div>
            </div>
          )}

          {sucesso && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900">Sucesso!</p>
                <p className="text-sm text-green-800">{sucesso}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={processando}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={processar}
            disabled={!arquivo || processando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {processando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Processar Planilha
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
