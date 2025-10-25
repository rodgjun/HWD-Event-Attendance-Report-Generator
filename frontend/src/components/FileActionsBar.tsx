import { useState, useRef, useCallback } from 'react';
import { 
  ArrowUpTrayIcon, 
  ArrowDownTrayIcon, 
  DocumentArrowDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { UploadResultModal } from './UploadResultModal';

type UploadResult = { inserted: number; skipped?: number; skip_details?: any[] };
type FilePreview = { name: string; size: number } | null;

type Props = {
  uploadEndpoint: string;
  exportEndpoint: string;
  templateEndpoint: string;
  exportParams: Record<string, string>;
  uploadLabel?: string;
  templateLabel?: string;
  onUploadComplete?: () => void; // Refresh parent
  onBulkDelete?: (ids: number[]) => Promise<void>; // Optional bulk delete
};

export function FileActionsBar({ 
  uploadEndpoint, 
  exportEndpoint, 
  templateEndpoint, 
  exportParams, 
  uploadLabel = "Upload Excel", 
  templateLabel = "Download Template",
    onUploadComplete,
  onBulkDelete
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filePreview, setFilePreview] = useState<FilePreview>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortController = useRef<AbortController | null>(null);

  // === Drag & Drop ===
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(xlsx|xls)$/i.test(file.name)) {
      setFilePreview({ name: file.name, size: file.size });
      handleUpload(file);
    } else {
      toast.error('Invalid file. Only .xlsx or .xls allowed.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFilePreview({ name: file.name, size: file.size });
      handleUpload(file);
    }
  };

  // === Upload with Progress ===
  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    abortController.current = new AbortController();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(uploadEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: abortController.current.signal,
        onUploadProgress: (progressEvent) => {
          const percent = progressEvent.total 
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(percent);
        }
      });
      setUploadResult(res.data);
      setShowModal(true);
      toast.success('Upload complete');
      onUploadComplete?.();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.error('Upload cancelled');
      } else {
        toast.error(err.response?.data?.error || 'Upload failed');
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cancelUpload = () => {
    abortController.current?.abort();
    setFilePreview(null);
    setUploading(false);
    setUploadProgress(0);
  };

  // === Export ===
  const handleExport = async () => {
    try {
      const query = new URLSearchParams(exportParams).toString();
      const res = await api.get(`${exportEndpoint}?${query}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `export-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Exported');
    } catch {
      toast.error('Export failed');
    }
  };

  // === Template ===
  const handleTemplate = async () => {
    try {
      const res = await api.get(templateEndpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  // === Bulk Delete (if provided) ===
  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return toast.error('No rows selected');
    if (!onBulkDelete) return;

    if (!confirm(`Delete ${selectedRows.size} record(s)?`)) return;

    try {
      await onBulkDelete(Array.from(selectedRows));
      toast.success('Deleted');
      setSelectedRows(new Set());
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <>
      {/* Collapsible Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-4 mb-6 transition-all duration-300">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between text-left group"
          aria-expanded={isOpen}
        >
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <ArrowUpTrayIcon className="w-5 h-5 text-blue-600" />
            File Actions
          </h2>
          <div className="transition-transform duration-200 group-hover:scale-110">
            {isOpen ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
          </div>
        </button>

        {isOpen && (
          <div className="mt-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Upload Zone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{uploadLabel}</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                  ${isDragging ? 'border-blue-500 bg-blue-50/50 shadow-inner' : 'border-gray-300 hover:border-gray-400'}
                  ${uploading ? 'opacity-60' : ''}
                `}
              >
                <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  {isDragging ? 'Drop to upload' : 'Drag & drop or click'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Upload file"
                />
              </div>

              {/* File Preview + Progress */}
              {filePreview && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{filePreview.name}</p>
                      <p className="text-xs text-gray-500">{(filePreview.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={cancelUpload}
                      className="text-red-500 hover:text-red-700"
                      aria-label="Cancel upload"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  {uploading && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-right text-gray-600 mt-1">{uploadProgress}%</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExport}
                className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
              >
                <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                Export to Excel
              </button>
              <button
                onClick={handleTemplate}
                className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
              >
                <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                {templateLabel}
              </button>
            </div>

            {/* Bulk Delete (if enabled) */}
            {onBulkDelete && selectedRows.size > 0 && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <span className="text-sm text-gray-600">{selectedRows.size} selected</span>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <UploadResultModal 
        result={uploadResult} 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
      />
    </>
  );
}