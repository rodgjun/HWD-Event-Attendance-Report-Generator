import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

type Props = {
  endpoint: string;
  filename?: string;
};

export function DownloadTemplateButton({ endpoint, filename = "template" }: Props) {
  const handleDownload = async () => {
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
    >
      <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
      Download Template
    </button>
  );
}