import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon, PlayIcon } from '@heroicons/react/24/outline';
import { Toaster, toast } from 'react-hot-toast';
import { api } from '../services/api';
import { SearchInput } from '../components/SearchInput';
import { EventFilterDropdown } from '../components/EventFilterDropdown';
import { UploadResultModal } from '../components/UploadResultModal';
import { TableContainer } from '../components/TableContainer';
import { Pagination } from '../components/Pagination';
import { FileActionsBar } from '../components/FileActionsBar';
import { useNavigate } from 'react-router-dom';

type AttendanceRow = {
  attendance_id: number;
  employee_no: string | null;
  employee_name: string;
  department: string | null;
  mode_of_attendance: 'Virtual' | 'Onsite';
  validation_status: 'Registered' | 'Not Registered';
  event: { event_id: number; event_name: string };
};

type PaginationData = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type Event = { event_id: number; event_name: string };

type UploadResult = { inserted: number; skipped?: number; skip_details?: any[] };
type DepartmentOption = string;

export function Attendance() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<number>(0);
  const [selectedEventName, setSelectedEventName] =useState('');
  const [sorting, setSorting] = useState({ sort: 'attendance_id', order: 'DESC' as 'ASC' | 'DESC' });
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingRegId, setEditingRegId] = useState<number | null>(null);
  const [form, setForm] = useState({
    employee_no: '',
    employee_name: '',
    department: '',
    mode_of_attendance: 'Onsite' as 'Virtual' | 'Onsite',
    event_id: 0  // Only used for edits
  });
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [loading, setLoading] = useState(false);

  const exportParams = {
    ...(search && { search }),
    ...(selectedEventId > 0 && { event_id: selectedEventId.toString() })
  };

  const ChevronIcon = ({ field }: { field: string }) => 
    sorting.sort === field ? (sorting.order === 'ASC' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />) : null;

  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    api.get('/events/all')  // Or '/events' per backend
      .then(res => setEvents(res.data.events || []))
      .catch(() => toast.error('Failed to load events'));
  }, []);


  // Load departments once
  useEffect(() => {
    loadDepartments();
  }, []);

  // Sync event name from dropdown
  useEffect(() => {
    const event = events.find(e => e.event_id === selectedEventId);
    setForm(prev => ({ ...prev, event_id: selectedEventId }));
    setSelectedEventName(event?.event_name || ''); // Always set
  }, [selectedEventId, events]);

  async function loadDepartments() {
    try {
      const res = await api.get('/employees/departments');
      setDepartments(res.data);
    } catch (e: any) {
      toast.error('Failed to load departments');
    }
  }

  // Load attendance data
  useEffect(() => {
    
    load();
  }, [pagination.page, pagination.limit, sorting, selectedEventId, search]);

  const load = async () => {
      setTableLoading(true);
      try {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          sort: sorting.sort,
          order: sorting.order,
          ...(selectedEventId && { event_id: selectedEventId.toString() }),
          ...(search && { search })
        });

        const res = await api.get(`/attendance?${params}`);
        setRows(res.data.attendance);
        setPagination(res.data.pagination);
      } catch (e: any) {
        toast.error(e.response?.data?.error || 'Failed to load attendance');
      } finally {
        setTableLoading(false);
      }
    };

  // Handle form submission
  const handleAddOrUpdate = useCallback(async (attendanceId?: number) => {
  if (selectedEventId === 0) {
    toast.error('Please select an event before adding/updating attendance.');
    return;
  }
  if (!form.employee_name.trim()) {
    toast.error('Employee Name is required');
    return;
  }
  setTableLoading(true);
  try {
    const payload = {
      ...form,
      employee_no: form.employee_no.trim() || null,
      department: form.department.trim() || null,
      event_id: attendanceId ? form.event_id : selectedEventId,  // Use row's event for edit; filter for new
      mode_of_attendance: form.mode_of_attendance
    };
    if (attendanceId && editingRegId) {
      await api.put(`/attendance/${attendanceId}`, payload);
      toast.success('Attendance updated');
    } else {
      await api.post('/attendance', payload);
      toast.success('Attendance added');
    }
    // Reset form (use selectedEventId for new)
    setForm({
      employee_no: '',
      employee_name: '',
      department: '',
      mode_of_attendance: 'Onsite',
      event_id: selectedEventId
    });
    setEditingRegId(null);
    await load();
  } catch (e: any) {
    toast.error(e.response?.data?.details || e.response?.data?.error || 'Save failed');
  } finally {
    setTableLoading(false);
  }
}, [form, editingRegId, selectedEventId, load]);

  const resetForm = () => {
    setEditingRegId(null);
    setForm({
      employee_no: '',
      employee_name: '',
      department: '',
      mode_of_attendance: 'Onsite',
      event_id: selectedEventId || 0
    });
  };

  const startEdit = (row: AttendanceRow) => {
    setEditingRegId(row.attendance_id);
    setForm({
      employee_no: row.employee_no || '',
      employee_name: row.employee_name,
      department: row.department || '',
      mode_of_attendance: row.mode_of_attendance,
      event_id: row.event.event_id  // Preserve original event
    });
    inputRefs.current['employee_no']?.focus();
  };

  const cancelEdit = () => {
    resetForm();
  };

  const deleteRegistration = async (id: number) => {
    if (!confirm('Delete this attendance record?')) return;
    try {
      await api.delete(`/attendance/${id}`);
      toast.success('Deleted');
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed');
    }
  };

  const handleBulkDelete = async () => {
  if (!confirm(`Delete ${selectedRows.size} selected records?`)) return;

  try {
    await api.post('/attendance/bulk-delete', { ids: Array.from(selectedRows) });
    toast.success('Bulk delete successful');
    setSelectedRows(new Set());
    // --- REFRESH DATA ---
    await load(); // reuse existing load logic
  } catch (e: any) {
    toast.error(e.response?.data?.error || 'Bulk delete failed');
  }
};

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
    setShowUploadModal(true);
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

  // const ChevronIcon = ({ field }: { field: string }) => {
  //   if (sorting.sort !== field) return null;
  //   return sorting.order === 'ASC' ? (
  //     <span className="ml-1 inline-block">↑</span>
  //   ) : (
  //     <span className="ml-1 inline-block">↓</span>
  //   );
  // };

  const handleKioskLaunch = () => {
    navigate('/kiosk');
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or employee no..." />
          {/* Kiosk Mode Button - Placeholder (will move beside search later) */}
          <motion.button
          whileHover={{ scale: 1.02 }}
          onClick={handleKioskLaunch}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <PlayIcon className="w-4 h-4" />
            Kiosk Mode
        </motion.button>
        </div>
      </div>

      {/* File Actions */}
      <FileActionsBar
        uploadEndpoint="/attendance/upload"
        exportEndpoint="/attendance/export"
        templateEndpoint="/attendance/template"
        exportParams={exportParams}
        uploadLabel="Upload Registrations"
        onUploadComplete={load}
      />

      {/* Filters & Bulk Actions */}
      

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      >
        {/* Event Filter + Bulk Delete */}
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Event:</label>
            <EventFilterDropdown selectedEventId={selectedEventId} onChange={setSelectedEventId} />
          </div>

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
                      setSelectedRows(e.target.checked ? new Set(rows.map(r => r.attendance_id)) : new Set());
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSorting(prev => ({
                    sort: 'attendance_id',
                    order: prev.sort === 'attendance_id' && prev.order === 'ASC' ? 'DESC' : 'ASC'
                  }))}
                >
                  ID <ChevronIcon field="attendance_id" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSorting(prev => ({
                    sort: 'employee_no',
                    order: prev.sort === 'employee_no' && prev.order === 'ASC' ? 'DESC' : 'ASC'
                  }))}
                >
                  Employee No <ChevronIcon field="employee_no" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSorting(prev => ({
                    sort: 'employee_name',
                    order: prev.sort === 'employee_name' && prev.order === 'ASC' ? 'DESC' : 'ASC'
                  }))}
                >
                  Employee Name <ChevronIcon field="employee_name" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSorting(prev => ({
                    sort: 'department',
                    order: prev.sort === 'department' && prev.order === 'ASC' ? 'DESC' : 'ASC'
                  }))}
                >
                  Department <ChevronIcon field="department" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {/* Always-Visible Add/Edit Row (Outside TableContainer) */}
            <tr className={editingRegId ? 'bg-yellow-50' : 'bg-gray-50'}>
              <td className="px-6 py-4 w-10"></td> {/* Checkbox placeholder */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {editingRegId ? `Edit ${editingRegId}` : 'New'}
              </td>
              <td className="px-6 py-4">
                <input
                  ref={el => (inputRefs.current['employee_no'] = el)}
                  type="text"
                  value={form.employee_no}
                  onChange={handleEmployeeNoChange}
                  className="w-full p-1 border rounded text-sm"
                  placeholder="Optional (or 'NA' for walk-in)"
                />
              </td>
              <td className="px-6 py-4">
                <input
                  type="text"
                  value={form.employee_name}
                  onChange={e => setForm({ ...form, employee_name: e.target.value })}
                  className="w-full p-1 border rounded text-sm"
                  placeholder="Required"
                />
              </td>
              <td className="px-6 py-4">
                <input
                  list="departments"
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  className="w-full p-1 border rounded text-sm"
                />
                <datalist id="departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
              </td>
              <td className="px-6 py-4">
                <select
                  value={form.mode_of_attendance}
                  onChange={e => setForm({ ...form, mode_of_attendance: e.target.value as 'Virtual' | 'Onsite' })}
                  className="w-full p-1 border rounded text-sm"
                >
                  <option value="Onsite">Onsite</option>
                  <option value="Virtual">Virtual</option>
                </select>
              </td>
              <td className="px-6 py-4 text-xs text-gray-500 italic">Computed on save</td> {/* Status placeholder */}
              
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onClick={() => handleAddOrUpdate(editingRegId || undefined)} className="text-green-600 mr-2">
                      {editingRegId ? <PencilIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                    </button>
                    <button onClick={cancelEdit} className="text-gray-400"><XMarkIcon className="w-4 h-4" /></button>
              </td>
            </tr>

            {/* Data Rows Only (Handled by TableContainer) */}
            <TableContainer
              loading={tableLoading}
              data={rows}
              emptyMessage={
                selectedEventId
                  ? `No existing attendance for "${selectedEventName}". Use the row above to add the first record.`
                  : 'No attendance records found. Use the row above to add your first entry.'
              }
              modulename="attendance"
              numColumns={9}  // Ensures proper colSpan alignment
            >
              {rows.map(row => (
                <tr key={row.attendance_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.attendance_id)}
                      onChange={e => {
                        const newSet = new Set(selectedRows);
                        e.target.checked ? newSet.add(row.attendance_id) : newSet.delete(row.attendance_id);
                        setSelectedRows(newSet);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.attendance_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.employee_no || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{row.employee_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{row.department || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      row.mode_of_attendance === 'Onsite' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {row.mode_of_attendance}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      row.validation_status === 'Registered' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {row.validation_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => startEdit(row)} className="text-blue-600 hover:text-blue-900 mr-2 p-1 rounded">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteRegistration(row.attendance_id)} className="text-red-600 hover:text-red-900 p-1 rounded">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </TableContainer>
          </tbody>
          </table>
        </div>
      </motion.div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-gray-700">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={p => setPagination({ ...pagination, page: p })}
          disabled={tableLoading}
        />
      </div>

      {/* Upload Result Modal */}
      <UploadResultModal
        result={uploadResult}
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)} 
      />
    </div>
  );
}