import { useState, useEffect, useRef } from 'react';
import { Search, X, CreditCard } from 'lucide-react';

interface Cartao {
  id: string;
  cartao: string;
  banco_emissor: string;
}

interface CartaoSearchProps {
  cartoes: Cartao[];
  value: string;
  onChange: (cartaoId: string, cartaoNome: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function CartaoSearch({
  cartoes,
  value,
  onChange,
  placeholder = 'Digite para buscar cartão...',
  className = '',
  required = false
}: CartaoSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNome, setSelectedNome] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && cartoes.length > 0) {
      const cartao = cartoes.find(c => c.id === value);
      if (cartao) {
        setSelectedNome(`${cartao.cartao} - ${cartao.banco_emissor}`);
        setSearchTerm('');
      }
    } else {
      setSelectedNome('');
    }
  }, [value, cartoes]);

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

  const filteredCartoes = cartoes.filter(cartao => {
    const searchLower = searchTerm.toLowerCase();
    const nomeMatch = cartao.cartao.toLowerCase().includes(searchLower);
    const bancoMatch = cartao.banco_emissor?.toLowerCase().includes(searchLower);
    return nomeMatch || bancoMatch;
  });

  const handleSelect = (cartao: Cartao) => {
    onChange(cartao.id, `${cartao.cartao} - ${cartao.banco_emissor}`);
    setSelectedNome(`${cartao.cartao} - ${cartao.banco_emissor}`);
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

      {isOpen && filteredCartoes.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredCartoes.slice(0, 50).map((cartao) => (
            <button
              key={cartao.id}
              type="button"
              onClick={() => handleSelect(cartao)}
              className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                value === cartao.id ? 'bg-blue-100' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {cartao.cartao}
                  </p>
                  <p className="text-xs text-slate-500">
                    {cartao.banco_emissor}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {filteredCartoes.length > 50 && (
            <div className="px-4 py-2 text-sm text-slate-500 text-center bg-slate-50">
              Mostrando 50 de {filteredCartoes.length} resultados. Continue digitando para refinar.
            </div>
          )}
        </div>
      )}

      {isOpen && searchTerm && filteredCartoes.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg p-4">
          <p className="text-sm text-slate-500 text-center">
            Nenhum cartão encontrado para "{searchTerm}"
          </p>
        </div>
      )}
    </div>
  );
}
