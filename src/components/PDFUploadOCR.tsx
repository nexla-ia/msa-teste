import { useState } from 'react';
import { Upload, FileText, X, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFUploadOCRProps {
  onUploadComplete: (url: string, extractedData?: ExtractedData) => void;
  currentPdfUrl?: string;
}

interface ExtractedData {
  nomePassageiro?: string;
  companhiaAerea?: string;
  codigoLocalizador?: string;
  trechos?: string;
  origem?: string;
  destino?: string;
  dataEmissao?: string;
  dataEmbarque?: string;
  milhas?: number;
}

export default function PDFUploadOCR({ onUploadComplete, currentPdfUrl }: PDFUploadOCRProps) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<string | null>(currentPdfUrl || null);
  const [error, setError] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);

  const convertPDFToImage = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível criar contexto do canvas');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return canvas.toDataURL('image/png');
  };

  const extractDataFromText = (text: string): ExtractedData => {
    const data: ExtractedData = {};

    const localizadorRegex = /(?:LOCALIZADOR|CÓDIGO|CODE|PNR)[\s:]*([A-Z0-9]{5,8})/i;
    const locMatch = text.match(localizadorRegex);
    if (locMatch) data.codigoLocalizador = locMatch[1];

    const nomeRegex = /(?:PASSAGEIRO|PASSENGER|NOME)[\s:]*([A-Z\s]{3,50})/i;
    const nomeMatch = text.match(nomeRegex);
    if (nomeMatch) data.nomePassageiro = nomeMatch[1].trim();

    const ciaRegex = /(?:LATAM|GOL|AZUL|TAP|SMILES|LIVELO|ACCOR)/i;
    const ciaMatch = text.match(ciaRegex);
    if (ciaMatch) data.companhiaAerea = ciaMatch[0].toUpperCase();

    const trechoRegex = /([A-Z]{3})\s*[-\/→]\s*([A-Z]{3})/g;
    const trechos = text.match(trechoRegex);
    if (trechos && trechos.length > 0) {
      data.trechos = trechos.join(' / ');
      const primeiroTrecho = trechos[0].match(/([A-Z]{3})\s*[-\/→]\s*([A-Z]{3})/);
      if (primeiroTrecho) {
        data.origem = primeiroTrecho[1];
        data.destino = primeiroTrecho[2];
      }
    }

    const dataRegex = /(\d{2})\/(\d{2})\/(\d{4})/g;
    const datas = text.match(dataRegex);
    if (datas && datas.length > 0) {
      data.dataEmissao = datas[0];
      if (datas.length > 1) data.dataEmbarque = datas[1];
    }

    const milhasRegex = /(?:MILHAS|PONTOS|MILES|POINTS)[\s:]*[\D]*?([\d.,]+)/i;
    const milhasMatch = text.match(milhasRegex);
    if (milhasMatch) {
      const milhasStr = milhasMatch[1].replace(/[.,]/g, '');
      data.milhas = parseInt(milhasStr);
    }

    return data;
  };

  const processOCR = async (file: File): Promise<ExtractedData> => {
    setProcessing(true);
    setOcrProgress(0);
    setError('');

    try {
      setOcrProgress(20);
      const imageData = await convertPDFToImage(file);

      setOcrProgress(40);
      const result = await Tesseract.recognize(
        imageData,
        'por+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(40 + Math.floor(m.progress * 50));
            }
          }
        }
      );

      setOcrProgress(95);
      const extractedData = extractDataFromText(result.data.text);

      setOcrProgress(100);
      return extractedData;

    } catch (err) {
      console.error('Erro no OCR:', err);
      throw new Error('Erro ao processar OCR');
    } finally {
      setProcessing(false);
      setTimeout(() => setOcrProgress(0), 2000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Por favor, selecione um arquivo PDF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo deve ter no máximo 10MB');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const fileExt = 'pdf';
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `localizadores/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('vendas-documentos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vendas-documentos')
        .getPublicUrl(filePath);

      setUploadedFile(publicUrl);

      const extracted = await processOCR(file);
      setExtractedData(extracted);
      onUploadComplete(publicUrl, extracted);

    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setUploadedFile(null);
    setExtractedData(null);
    setError('');
    onUploadComplete('');
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Upload do PDF do Localizador
      </label>

      {!uploadedFile ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={uploading || processing}
            className="hidden"
            id="pdf-upload"
          />
          <label
            htmlFor="pdf-upload"
            className="cursor-pointer flex flex-col items-center justify-center"
          >
            {uploading || processing ? (
              <>
                <Loader className="w-12 h-12 mb-3 text-blue-600 animate-spin" />
                <p className="text-sm text-gray-600 mb-1">
                  {uploading ? 'Fazendo upload...' : 'Processando OCR...'}
                </p>
                {processing && ocrProgress > 0 && (
                  <div className="w-full max-w-xs mt-2">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{ocrProgress}%</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 mb-3 text-gray-500" />
                <p className="text-sm text-gray-600 mb-1">
                  Clique para selecionar ou arraste o PDF
                </p>
                <p className="text-xs text-gray-500">
                  Máximo 10MB
                </p>
              </>
            )}
          </label>
        </div>
      ) : (
        <>
          <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">PDF do Localizador</p>
                <p className="text-xs text-green-700">Upload e OCR concluídos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={uploadedFile}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 p-1"
                title="Ver PDF"
              >
                <FileText className="w-5 h-5" />
              </a>
              <button
                type="button"
                onClick={handleRemove}
                className="text-red-600 hover:text-red-800 p-1"
                title="Remover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {extractedData && Object.keys(extractedData).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-900 mb-2">Dados Extraídos do PDF:</p>
              <div className="space-y-1 text-xs text-blue-800">
                {extractedData.codigoLocalizador && (
                  <p><strong>Localizador:</strong> {extractedData.codigoLocalizador}</p>
                )}
                {extractedData.nomePassageiro && (
                  <p><strong>Passageiro:</strong> {extractedData.nomePassageiro}</p>
                )}
                {extractedData.companhiaAerea && (
                  <p><strong>Companhia:</strong> {extractedData.companhiaAerea}</p>
                )}
                {extractedData.trechos && (
                  <p><strong>Trechos:</strong> {extractedData.trechos}</p>
                )}
                {extractedData.dataEmissao && (
                  <p><strong>Data Emissão:</strong> {extractedData.dataEmissao}</p>
                )}
                {extractedData.milhas && (
                  <p><strong>Milhas:</strong> {extractedData.milhas.toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>OCR Automático:</strong> O sistema extrairá automaticamente os dados do PDF e preencherá os campos do formulário. Revise e ajuste se necessário.
        </p>
      </div>
    </div>
  );
}
