import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useRef } from 'react';

type Props = {
  onUpload: (file: File) => void;
  accept?: string;
  label?: string;
};

export function FileUpload({ onUpload, accept = ".xlsx,.xls", label = "Upload Excel" }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <label className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer hover:bg-gray-50">
      <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
      <span>{label}</span>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </label>
  );
}