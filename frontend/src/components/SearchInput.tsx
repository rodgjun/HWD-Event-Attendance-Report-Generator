import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
};

export function SearchInput({ value, onChange, placeholder = "Search...", debounceMs = 300 }: Props) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => onChange(localValue), debounceMs);
    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange]);

  return (
    <div className="relative">
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}

          className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 text-sm transition-colors"
        />
    </div>
  );
}