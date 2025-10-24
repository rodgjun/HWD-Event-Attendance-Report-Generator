import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpTrayIcon, 
  ChevronDownIcon, 
  ChevronUpIcon, 
  PencilIcon, 
  TrashIcon, 
  PlusIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  ArrowDownTrayIcon 
} from '@heroicons/react/24/outline';

type RegistrationRow = { 
  reg_id: number; 
  employee_no: string | null; 
  employee_name: string; 
  department: string | null; 
  event_id: number; 
  event?: { event_name: string; event_type: string; event_date: string };
};

type EventOption = { event_id: number; event_name: string; event_type: string; event_date: string };
type DepartmentOption = string;

type FormData = {
  employee_no: string;
  employee_name: string;
  department: string;
  event_id: number;
};

export function Registrations() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [form, setForm] = useState<FormData>({ employee_no: '', employee_name: '', department: '', event_id: 0 });
  const [editingRegId, setEditingRegId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped?: number; skip_details?: any[] } | null>(null);
  const [showUploadResult, setShowUploadResult] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number>(0); // 0 = All Events
  const [tableLoading, setTableLoading] = useState(false); // For table refetch indicator
  const [selectedEventName, setSelectedEventName] = useState<string>(''); // For read-only display
  
  // Simplified state: unified search
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState({ sort: 'reg_id', order: 'DESC' as 'ASC' | 'DESC' });

  // Refs for form inputs
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Auto-set form event_id and name when selectedEventId changes
  useEffect(() => {
    const event = events.find(e => e.event_id === selectedEventId);
    setForm(prev => ({ ...prev, event_id: selectedEventId }));
    setSelectedEventName(event?.event_name || '');
  }, [selectedEventId, events]);

  // Reset page to 1 when filter/search changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [selectedEventId, search]);

  // Initial loads
  useEffect(() => {
    loadEvents();
    loadDepartments();
  }, []);

  // Load table data (with all deps)
  const load = useCallback(async () => {
    setTableLoading(true);
    try {
      setError(null);
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
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load registrations');
    } finally {
      setTableLoading(false);
    }
  }, [pagination.page, pagination.limit, sorting.sort, sorting.order, search, selectedEventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadEvents() {
    try {
      const res = await api.get('/events/all');
      setEvents(res.data.events || []);
    } catch (e: any) {
      toast.error('Failed to load events');
    }
  }

  async function loadDepartments() {
    try {
      const res = await api.get('/registrations/departments');
      setDepartments(res.data);
    } catch (e: any) {
      toast.error('Failed to load departments');
    }
  }

  // Autofill handler for employee_no
  async function handleEmployeeNoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const no = e.target.value.trim();
    setForm({ ...form, employee_no: no });
    if (no && no !== 'NA') {
      try {
        const res = await api.get(`/employees/by-number/${no}`);
        setForm(prev => ({ ...prev, employee_name: res.data.employee_name || '', department: res.data.department || '' }));
      } catch (e: any) {
        if (e.response?.status === 404) {
          setForm(prev => ({ ...prev, employee_name: '', department: '' }));  // Clear on not found
        } else {
          toast.error('Employee lookup failed');
        }
      }
    } else {
      setForm(prev => ({ ...prev, employee_name: '', department: '' }));  // Clear for manual/walk-in
    }
  }

  const handleAddOrUpdate = useCallback(async (regId?: number) => {
    if (!form.employee_name.trim()) {
      toast.error('Employee Name is required');
      return;
    }
    if (!form.event_id) {
      toast.error('Event is required');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        employee_no: form.employee_no.trim() || null,
        employee_name: form.employee_name.trim(),
        department: form.department.trim() || null,
        event_id: form.event_id
      };
      if (regId && editingRegId) {
        await api.put(`/registrations/${regId}`, payload);
        toast.success('Registration updated successfully');
      } else {
        await api.post('/registrations', payload);
        toast.success('Registration added successfully');
      }
      resetForm();
      setEditingRegId(null);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save registration');
    } finally {
      setLoading(false);
    }
  }, [form, editingRegId, load]);

  function resetForm() {
    setForm({ employee_no: '', employee_name: '', department: '', event_id: selectedEventId });
    setEditingRegId(null);
  }

  async function deleteRegistration(id: number) {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/registrations/${id}`);
      toast.success('Registration deleted');
      await load();
    } catch (e: any) {
      toast.error('Failed to delete registration');
    }
  }

  function startEdit(reg: RegistrationRow) {
    setEditingRegId(reg.reg_id);
    setForm({
      employee_no: reg.employee_no || '',
      employee_name: reg.employee_name || '',
      department: reg.department || '',
      event_id: reg.event_id
    });
    // Focus first input after render
    setTimeout(() => inputRefs.current['employee_no']?.focus(), 0);
  }

  function cancelEdit() {
    resetForm();
  }

  function handleSort(field: keyof RegistrationRow) {
    const newOrder = sorting.sort === field && sorting.order === 'ASC' ? 'DESC' : 'ASC';
    setSorting({ sort: field as string, order: newOrder });
  }

  function handleKeyDown(e: React.KeyboardEvent, regId?: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOrUpdate(regId);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  async function downloadTemplate() {
    try {
      const res = await api.get('/registrations/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'registrations-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (e: any) {
      toast.error('Failed to download template');
    }
  }

  async function exportData() {
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(selectedEventId > 0 && { event_id: selectedEventId.toString() })
      });
      const res = await api.get(`/registrations/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `registrations-export-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (e: any) {
      toast.error('Failed to export data');
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/registrations/upload', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      setUploadResult(res.data);
      setShowUploadResult(true);
      e.target.value = '';
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to upload file');
    }
  }

  const ChevronIcon = ({ field }: { field: string }) => 
    sorting.sort === field ? (
      sorting.order === 'ASC' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
    ) : null;

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrations</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name or employee no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <label className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer hover:bg-gray-50">
            <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
            <span>Upload Excel</span>
            <input type="file" onChange={upload} accept=".xlsx,.xls" className="hidden" />
          </label>
          <button
            onClick={exportData}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700"
          >
            <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
            Export to Excel
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
          >
            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
            Download Template
          </button>
        </div>
      </div>

      {/* Table with Event Filter Dropdown */}
      <motion.div initial="hidden" animate="visible" variants={fadeIn} className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(Number(e.target.value))}
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>All Events</option>
            {events.map((event) => (
              <option key={event.event_id} value={event.event_id}>{event.event_name}</option>
            ))}
          </select>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('reg_id')}>
                  ID <ChevronIcon field="reg_id" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('employee_no')}>
                  Employee No <ChevronIcon field="employee_no" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('employee_name')}>
                  Employee Name <ChevronIcon field="employee_name" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('department')}>
                  Department <ChevronIcon field="department" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                </tr>
              ) : (
                <>
                  {/* Unified Add/Edit Row */}
                  <tr className={editingRegId ? 'bg-yellow-50' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingRegId ? `Edit ${editingRegId}` : 'New'}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        ref={(el) => (inputRefs.current['employee_no'] = el)}
                        type="text"
                        value={form.employee_no}
                        onChange={handleEmployeeNoChange}
                        onKeyDown={(e) => handleKeyDown(e, editingRegId)}
                        className="w-full p-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={form.employee_name}
                        onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                        onKeyDown={(e) => handleKeyDown(e, editingRegId)}
                        className="w-full p-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Required"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        list="departments-list"
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        onKeyDown={(e) => handleKeyDown(e, editingRegId)}
                        className="w-full p-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <datalist id="departments-list">
                        {departments.map((dept) => <option key={dept} value={dept} />)}
                      </datalist>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={() => handleAddOrUpdate(editingRegId)}
                        disabled={loading || !form.employee_name.trim() || !form.event_id}
                        className="text-green-600 hover:text-green-900 mr-2 disabled:opacity-50"
                      >
                        {editingRegId ? <PencilIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                      </motion.button>
                      <button
                        onClick={cancelEdit}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {/* Data Rows */}
                  {rows.map((row) => (
                    <tr key={row.reg_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.reg_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.employee_no || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.employee_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.department || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => startEdit(row)}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRegistration(row.reg_id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
        {!tableLoading && rows.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {selectedEventId > 0 ? `No registrations found for "${selectedEventName}".` : 'No registrations found.'}
          </div>
        )}
      </motion.div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-gray-700">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
            disabled={pagination.page === 1 || tableLoading}
            className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-2 text-sm">{pagination.page} / {pagination.totalPages}</span>
          <button
            onClick={() => setPagination({ ...pagination, page: Math.min(pagination.totalPages, pagination.page + 1) })}
            disabled={pagination.page === pagination.totalPages || tableLoading}
            className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Upload Result Modal - Height limited to 70vh */}
      <AnimatePresence>
        {showUploadResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowUploadResult(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg max-w-md w-full max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">Upload Results</h3>
                <button onClick={() => setShowUploadResult(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-2">Inserted: {uploadResult?.inserted}</p>
                {uploadResult?.skipped && (
                  <p className="text-sm text-gray-600 mb-4">Skipped: {uploadResult.skipped}</p>
                )}
                {uploadResult?.skip_details && uploadResult.skip_details.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Skip Details:</h4>
                    <ul className="text-xs text-gray-600 max-h-32 overflow-y-auto">
                      {uploadResult.skip_details.map((detail: any, idx: number) => (
                        <li key={idx} className="border-b border-gray-200 pb-1">{detail.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}