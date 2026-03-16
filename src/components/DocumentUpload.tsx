import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { Upload, FileText, Download, Trash2, X, Loader } from 'lucide-react';

type Documento = {
  id: string;
  tipo_documento: string;
  arquivo_nome: string;
  tamanho_bytes: number;
  uploaded_at: string;
  uploaded_by: string;
  arquivo_path: string;
};

type DocumentUploadProps = {
  parceiroId: string;
  parceiroNome: string;
  isOpen: boolean;
  onClose: () => void;
};

const TIPOS_DOCUMENTO = [
  { value: 'rg', label: 'RG' },
  { value: 'cpf', label: 'CPF' },
  { value: 'comprovante_endereco', label: 'Comprovante de Endereço' },
  { value: 'cnh', label: 'CNH' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'outros', label: 'Outros' }
];

export default function DocumentUpload({ parceiroId, parceiroNome, isOpen, onClose }: DocumentUploadProps) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState('rg');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  useEffect(() => {
    if (isOpen && parceiroId) {
      loadDocumentos();
    }
  }, [isOpen, parceiroId]);

  const loadDocumentos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('parceiro_documentos')
        .select('*')
        .eq('parceiro_id', parceiroId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocumentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 10 * 1024 * 1024;

      if (file.size > maxSize) {
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Arquivo Muito Grande',
          message: 'O arquivo deve ter no máximo 10MB.'
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setDialogConfig({
        isOpen: true,
        type: 'warning',
        title: 'Nenhum Arquivo Selecionado',
        message: 'Por favor, selecione um arquivo antes de fazer o upload.'
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${parceiroId}/${tipoDocumento}-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documentos-parceiros')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('parceiro_documentos')
        .insert({
          parceiro_id: parceiroId,
          tipo_documento: tipoDocumento,
          arquivo_path: uploadData.path,
          arquivo_nome: selectedFile.name,
          tamanho_bytes: selectedFile.size,
          uploaded_by: currentUser?.id
        });

      if (dbError) throw dbError;

      await supabase.from('logs').insert({
        usuario_id: currentUser?.id,
        usuario_nome: currentUser?.nome || '',
        acao: 'INSERT',
        linha_afetada: `Documento: ${selectedFile.name} - Parceiro: ${parceiroNome}`,
        dados_antes: null,
        dados_depois: { tipo: tipoDocumento, arquivo: selectedFile.name }
      });

      setSelectedFile(null);
      setTipoDocumento('rg');
      loadDocumentos();

      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Upload Realizado',
        message: 'Documento enviado com sucesso!'
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro no Upload',
        message: `Não foi possível enviar o documento.\n\n${error.message}`
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Documento) => {
    try {
      const { data, error } = await supabase.storage
        .from('documentos-parceiros')
        .download(doc.arquivo_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.arquivo_nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Baixar',
        message: `Não foi possível baixar o documento.\n\n${error.message}`
      });
    }
  };

  const handleDelete = (doc: Documento) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Deseja realmente excluir o documento "${doc.arquivo_nome}"?\n\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          const { error: storageError } = await supabase.storage
            .from('documentos-parceiros')
            .remove([doc.arquivo_path]);

          if (storageError) throw storageError;

          const { error: dbError } = await supabase
            .from('parceiro_documentos')
            .delete()
            .eq('id', doc.id);

          if (dbError) throw dbError;

          await supabase.from('logs').insert({
            usuario_id: currentUser?.id,
            usuario_nome: currentUser?.nome || '',
            acao: 'DELETE',
            linha_afetada: `Documento: ${doc.arquivo_nome} - Parceiro: ${parceiroNome}`,
            dados_antes: doc,
            dados_depois: null
          });

          loadDocumentos();

          setDialogConfig({
            isOpen: true,
            type: 'success',
            title: 'Documento Excluído',
            message: 'O documento foi removido com sucesso.'
          });
        } catch (error: any) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: `Não foi possível excluir o documento.\n\n${error.message}`
          });
        }
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getTipoLabel = (tipo: string) => {
    return TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label || tipo;
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Documentos - ${parceiroNome}`}>
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Enviar Novo Documento</h4>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de Documento
                </label>
                <select
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={uploading}
                >
                  {TIPOS_DOCUMENTO.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Arquivo (máx. 10MB)
                </label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  disabled={uploading}
                />
                {selectedFile && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <FileText className="w-4 h-4" />
                    <span>{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-red-500 hover:text-red-700"
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Fazer Upload
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Documentos Enviados</h4>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : documentos.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Nenhum documento enviado ainda
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {documentos.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {doc.arquivo_nome}
                        </p>
                        <p className="text-xs text-slate-500">
                          {getTipoLabel(doc.tipo_documento)} • {formatFileSize(doc.tamanho_bytes)} • {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Baixar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Fechar
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
