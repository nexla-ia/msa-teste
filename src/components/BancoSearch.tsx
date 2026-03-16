import { useState, useEffect, useRef } from 'react';
import { Search, X, Building2 } from 'lucide-react';

interface Banco {
  id: string;
  nome_banco: string;
}

interface BancoSearchProps {
  bancos: Banco[];
  value: string;
  onChange: (bancoId: string, bancoNome: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function BancoSearch({
  bancos,
  value,
  onChange,
  placeholder = 'Digite para buscar banco...',
  className = '',
  required = false
}: BancoSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNome, setSelectedNome] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && bancos.length > 0) {
      const banco = bancos.find(b => b.id === value);
      if (banco) {
        setSelectedNome(banco.nome_banco);
        setSearchTerm('');
      }
    } else {
      setSelectedNome('');
    }
  }, [value, bancos]);

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

  const filteredBancos = bancos.filter(banco => {
    const searchLower = searchTerm.toLowerCase();
    return banco.nome_banco.toLowerCase().includes(searchLower);
  });

  const handleSelect = (banco: Banco) => {
    onChange(banco.id, banco.nome_banco);
    setSelectedNome(banco.nome_banco);
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
    setIsOpen(true);
    if (!newValue && value) {
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
          value={selectedNome || searchTerm}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          autoComplete="off"
          required={required}
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

      {isOpen && filteredBancos.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredBancos.slice(0, 50).map((banco) => (
            <button
              key={banco.id}
              type="button"
              onClick={() => handleSelect(banco)}
              className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                value === banco.id ? 'bg-blue-100' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {banco.nome_banco}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {filteredBancos.length > 50 && (
            <div className="px-4 py-2 text-sm text-slate-500 text-center bg-slate-50">
              Mostrando 50 de {filteredBancos.length} resultados. Continue digitando para refinar.
            </div>
          )}
        </div>
      )}

      {isOpen && searchTerm && filteredBancos.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg p-4">
          <p className="text-sm text-slate-500 text-center">
            Nenhum banco encontrado para "{searchTerm}"
          </p>
        </div>
      )}
    </div>
  );
}
