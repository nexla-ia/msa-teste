import { useState, useEffect, useRef } from 'react';
import { Search, X, Users } from 'lucide-react';

interface Parceiro {
  id: string;
  nome_parceiro: string;
  cpf?: string;
  ultima_movimentacao?: string;
}

interface ParceiroSearchProps {
  parceiros: Parceiro[];
  value: string;
  onChange: (parceiroId: string, parceiroNome: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ParceiroSearch({
  parceiros,
  value,
  onChange,
  placeholder = 'Digite para buscar parceiro...',
  className = ''
}: ParceiroSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNome, setSelectedNome] = useState('');
  const [filteredParceiros, setFilteredParceiros] = useState<Parceiro[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && parceiros.length > 0) {
      const parceiro = parceiros.find(p => p.id === value);
      if (parceiro) {
        setSelectedNome(parceiro.nome_parceiro);
        setSearchTerm('');
      }
    } else {
      setSelectedNome('');
    }
  }, [value, parceiros]);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredParceiros([]);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const searchNumbers = searchTerm.replace(/\D/g, '');

    const filtered = parceiros.filter(parceiro => {
      if (!parceiro.nome_parceiro) return false;

      const nomeMatch = parceiro.nome_parceiro.toLowerCase().includes(searchLower);
      const cpfMatch = searchNumbers.length > 0 && parceiro.cpf ?
        parceiro.cpf.replace(/\D/g, '').includes(searchNumbers) :
        false;

      return nomeMatch || cpfMatch;
    });

    setFilteredParceiros(filtered);
  }, [searchTerm, parceiros]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!value) {
          setSearchTerm('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);


  const handleSelect = (parceiro: Parceiro) => {
    onChange(parceiro.id, parceiro.nome_parceiro);
    setSelectedNome(parceiro.nome_parceiro);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('', '');
    setSelectedNome('');
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(newValue.length > 0);
    if (!newValue) {
      onChange('', '');
      setSelectedNome('');
    }
  };

  const handleInputClick = () => {
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
        <input
          type="text"
          value={searchTerm || selectedNome}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          autoComplete="off"
        />
        {(selectedNome || searchTerm) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && searchTerm && filteredParceiros.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredParceiros.slice(0, 50).map((parceiro) => (
            <button
              key={parceiro.id}
              type="button"
              onClick={() => handleSelect(parceiro)}
              className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                value === parceiro.id ? 'bg-blue-100' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {parceiro.nome_parceiro}
                  </p>
                  {parceiro.cpf && (
                    <p className="text-xs text-slate-500">
                      CPF: {parceiro.cpf}
                    </p>
                  )}
                  {parceiro.ultima_movimentacao && (
                    <p className="text-xs text-green-600">
                      Última movimentação: {new Date(parceiro.ultima_movimentacao).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
          {filteredParceiros.length > 50 && (
            <div className="px-4 py-2 text-sm text-slate-500 text-center bg-slate-50">
              Mostrando 50 de {filteredParceiros.length} resultados. Continue digitando para refinar.
            </div>
          )}
        </div>
      )}

      {isOpen && searchTerm && filteredParceiros.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg p-4">
          <p className="text-sm text-slate-500 text-center">
            Nenhum parceiro encontrado para "{searchTerm}"
          </p>
        </div>
      )}
    </div>
  );
}
