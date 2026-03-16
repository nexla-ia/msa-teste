import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface FilterComboboxProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FilterCombobox({ label, options, value, onChange, placeholder }: FilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!options.includes(inputValue)) {
          onChange(inputValue);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inputValue, options, onChange]);

  const filtered = options.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()));

  const handleSelect = (opt: string) => {
    setInputValue(opt);
    onChange(opt);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    onChange('');
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' && filtered.length === 1) {
      handleSelect(filtered[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-[160px]">
      <div
        className={`flex items-center border rounded-lg bg-white transition-all ${
          open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || `Filtrar ${label.toLowerCase()}...`}
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400 min-w-0"
        />
        <div className="flex items-center pr-2 gap-1">
          {inputValue && (
            <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => { setOpen(o => !o); inputRef.current?.focus(); }}
            className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {!inputValue && (
            <button
              onClick={() => handleSelect('')}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
            >
              {placeholder || `Todos`}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</div>
          ) : (
            filtered.map(opt => (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                  value === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  filters: {
    label: string;
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }[];
  onClear?: () => void;
}

export function FilterBar({ filters, onClear }: FilterBarProps) {
  const hasActive = filters.some(f => f.value !== '');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <FilterCombobox
          key={f.label}
          label={f.label}
          options={f.options}
          value={f.value}
          onChange={f.onChange}
          placeholder={f.placeholder}
        />
      ))}
      {hasActive && onClear && (
        <button
          onClick={onClear}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Limpar
        </button>
      )}
    </div>
  );
}
