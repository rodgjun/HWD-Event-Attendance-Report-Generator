import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

type Props = {
  endpoint: string;
  params: Record<string, string>;
  filename?: string;
};

export function ExportButton({ endpoint, params, filename = 'export' }: Props) {
  const handleExport = async () => {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`${endpoint}?${query}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700"
    >
      <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
      Export to Excel
    </button>
  );
}