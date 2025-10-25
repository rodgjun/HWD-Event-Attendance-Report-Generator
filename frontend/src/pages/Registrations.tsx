import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { Toaster, toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  ChevronDownIcon, 
  ChevronUpIcon, 
  PencilIcon, 
  TrashIcon, 
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

import { SearchInput } from '../components/SearchInput';
import { EventFilterDropdown } from '../components/EventFilterDropdown';
import { UploadResultModal } from '../components/UploadResultModal';
import { TableContainer } from '../components/TableContainer';
import { Pagination } from '../components/Pagination';
import { FileActionsBar } from '../components/FileActionsBar';

type RegistrationRow = { 
  reg_id: number; 
  employee_no: string | null; 
  employee_name: string; 
  department: string | null; 
  event_id: number; 
  event?: { event_name: string };
};

type FormData = {
  employee_no: string;
  employee_name: string;
  department: string;
  event_id: number;
};

type UploadResult = { inserted: number; skipped?: number; skip_details?: any[] };

export function Registrations() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [form, setForm] = useState<FormData>({ employee_no: '', employee_name: '', department: '', event_id: 0 });
  const [editingRegId, setEditingRegId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number>(0);
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [tableLoading, setTableLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState({ sort: 'reg_id', order: 'DESC' as 'ASC' | 'DESC' });

  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const exportParams = {
  ...(search && { search }),
  ...(selectedEventId > 0 && { event_id: selectedEventId.toString() })
};

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Add events state and fetch events
  const [events, setEvents] = useState<{ event_id: number; event_name: string }[]>([]);

  useEffect(() => {
    api.get('/events/all')
      .then(res => setEvents(res.data.events || []))
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  // Sync event name from dropdown
  useEffect(() => {
    const event = events.find(e => e.event_id === selectedEventId);
    setForm(prev => ({ ...prev, event_id: selectedEventId }));
    setSelectedEventName(event?.event_name || ''); // Always set
  }, [selectedEventId, events]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [selectedEventId, search]);

  useEffect(() => {
    api.get('/registrations/departments')
      .then(res => setDepartments(res.data))
      .catch(() => toast.error('Failed to load departments'));
  }, []);

  const load = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sorting.sort,
        order: sorting.order,
        ...(search && { search }),
        ...(selectedEventId > 0 && { event_id: selectedEventId.toString() })
      });
      const res = await api.get(`/registrations?${params}`);
      setRows(res.data.registrations);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setTableLoading(false);
    }
  }, [pagination.page, pagination.limit, sorting, search, selectedEventId]);

  useEffect(() => { load(); }, [load]);

  // Upload handler
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/registrations/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      setShowUploadModal(true);
      await load();
    } catch {
      toast.error('Upload failed');
    }
  };

  // Employee lookup
  async function handleEmployeeNoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const no = e.target.value.trim();
    setForm({ ...form, employee_no: no });
    if (no && no !== 'NA') {
      try {
        const res = await api.get(`/employees/by-number/${no}`);
        setForm(prev => ({ ...prev, employee_name: res.data.employee_name || '', department: res.data.department || '' }));
      } catch (e: any) {
        if (e.response?.status === 404) {
          setForm(prev => ({ ...prev, employee_name: '', department: '' }));
        } else {
          toast.error('Lookup failed');
        }
      }
    } else {
      setForm(prev => ({ ...prev, employee_name: '', department: '' }));
    }
  }

  const handleAddOrUpdate = useCallback(async (regId?: number) => {
      if (selectedEventId === 0) {
      toast.error('Please select an event before adding/updating a registration.');
      return;
    }
    if (!form.employee_name.trim()) {
      toast.error('Employee Name is required');
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, employee_no: form.employee_no || null, department: form.department || null };
      if (regId && editingRegId) {
        await api.put(`/registrations/${regId}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/registrations', payload);
        toast.success('Added');
      }
      setForm({ employee_no: '', employee_name: '', department: '', event_id: selectedEventId });
      setEditingRegId(null);
      await load();
    } catch {
      toast.error('Save failed');
    } finally {
      setLoading(false);
    }
  }, [form, editingRegId, selectedEventId, load]);

  function startEdit(reg: RegistrationRow) {
    setEditingRegId(reg.reg_id);
    setForm({
      employee_no: reg.employee_no || '',
      employee_name: reg.employee_name,
      department: reg.department || '',
      event_id: reg.event_id
    });
    setTimeout(() => inputRefs.current['employee_no']?.focus(), 0);
  }

  function cancelEdit() {
    setForm({ employee_no: '', employee_name: '', department: '', event_id: selectedEventId });
    setEditingRegId(null);
  }

  async function deleteRegistration(id: number) {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/registrations/${id}`);
      toast.success('Deleted');
      await load();
    } catch {
      toast.error('Delete failed');
    }
  }

  const ChevronIcon = ({ field }: { field: string }) => 
    sorting.sort === field ? (sorting.order === 'ASC' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />) : null;

  // === Bulk Delete Handler ===
const handleBulkDelete = async () => {
  if (selectedRows.size === 0) return;
  if (!confirm(`Delete ${selectedRows.size} record(s)?`)) return;

  try {
    await api.post('/registrations/bulk-delete', { ids: Array.from(selectedRows) });
    toast.success('Deleted successfully');
    setSelectedRows(new Set());
    await load();
  } catch {
    toast.error('Bulk delete failed');
  }
};

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrations</h1>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or employee no..." />
          
        </div>
      </div>
        <FileActionsBar
            uploadEndpoint="/registrations/upload"
            exportEndpoint="/registrations/export"
            templateEndpoint="/registrations/template"
            exportParams={exportParams}
            uploadLabel="Upload Registrations"
          />

      <motion.div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Event Filter + Bulk Delete */}
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Event:</label>
            <EventFilterDropdown selectedEventId={selectedEventId} onChange={setSelectedEventId} />
          </div>

          {/* Bulk Delete Button - Only if rows selected */}
          {selectedRows.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
              aria-label={`Delete ${selectedRows.size} selected records`}
            >
              <TrashIcon className="w-4 h-4" />
              Delete ({selectedRows.size})
            </button>
          )}
        </div>
        <div className="w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === rows.length && rows.length > 0}
                    onChange={(e) => {
                      setSelectedRows(e.target.checked ? new Set(rows.map(r => r.reg_id)) : new Set());
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => setSorting(prev => ({ sort: 'reg_id', order: prev.sort === 'reg_id' && prev.order === 'ASC' ? 'DESC' : 'ASC' }))}>
                  ID <ChevronIcon field="reg_id" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => setSorting(prev => ({ sort: 'employee_no', order: prev.sort === 'employee_no' && prev.order === 'ASC' ? 'DESC' : 'ASC' }))}>
                  Employee No <ChevronIcon field="employee_no" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => setSorting(prev => ({ sort: 'employee_name', order: prev.sort === 'employee_name' && prev.order === 'ASC' ? 'DESC' : 'ASC' }))}>
                  Employee Name <ChevronIcon field="employee_name" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => setSorting(prev => ({ sort: 'department', order: prev.sort === 'department' && prev.order === 'ASC' ? 'DESC' : 'ASC' }))}>
                  Department <ChevronIcon field="department" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <TableContainer loading={tableLoading} data={rows} emptyMessage={selectedEventId > 0 ? `No registrations for "${selectedEventName}".` : 'No registrations.'}>
                {/* Add/Edit Row */}
                <tr className={editingRegId ? 'bg-yellow-50' : 'bg-gray-50'}>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{editingRegId ? `Edit ${editingRegId}` : 'New'}</td>
                  <td className="px-6 py-4"><input ref={el => inputRefs.current['employee_no'] = el} type="text" value={form.employee_no} onChange={handleEmployeeNoChange} className="w-full p-1 border rounded" /></td>
                  <td className="px-6 py-4"><input type="text" value={form.employee_name} onChange={e => setForm({ ...form, employee_name: e.target.value })} className="w-full p-1 border rounded" placeholder="Required" /></td>
                  <td className="px-6 py-4">
                    <input list="departments" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full p-1 border rounded" />
                    <datalist id="departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleAddOrUpdate(editingRegId || undefined)} disabled={loading || !form.employee_name || !form.event_id} className="text-green-600 mr-2">
                      {editingRegId ? <PencilIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                    </button>
                    <button onClick={cancelEdit} className="text-gray-400"><XMarkIcon className="w-4 h-4" /></button>
                  </td>
                </tr>

                {rows.map(row => (
                  <tr key={row.reg_id}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.reg_id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedRows);
                          e.target.checked ? newSet.add(row.reg_id) : newSet.delete(row.reg_id);
                          setSelectedRows(newSet);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.reg_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.employee_no || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.employee_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.department || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => startEdit(row)} className="text-blue-600 mr-2"><PencilIcon className="w-4 h-4" /></button>
                      <button onClick={() => deleteRegistration(row.reg_id)} className="text-red-600"><TrashIcon className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </TableContainer>
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-gray-700">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={p => setPagination({ ...pagination, page: p })} disabled={tableLoading} />
      </div>

      <UploadResultModal 
        result={uploadResult} 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
      />
    </div>
  );
}