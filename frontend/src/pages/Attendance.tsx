import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpTrayIcon, ChevronDownIcon, ChevronUpIcon, PlayIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

type AttendanceRow = { 
  attendance_id: number; 
  employee_no: string | null; 
  employee_name: string | null; 
  department: string | null; 
  event_id: number; 
  mode_of_attendance: 'Virtual' | 'Onsite'; 
  validation_status: 'Registered' | 'Not Registered';
  event?: { event_name: string; event_type: string; event_date: string };
};

type EventOption = { event_id: number; event_name: string };
type DepartmentOption = string;

export function Attendance() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [form, setForm] = useState<{ employee_no: string; employee_name: string; department: string; mode_of_attendance: 'Virtual' | 'Onsite'; event_name: string }>({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite', event_name: '' });
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [showFormSection, setShowFormSection] = useState(false);
  
  // Pagination and filtering state
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [filters, setFilters] = useState({ event_name: '', employee_no: '', employee_name: '', department: '' });
  const [sorting, setSorting] = useState({ sort: 'attendance_id', order: 'DESC' });

  useEffect(() => {
    loadEvents();
    loadDepartments();
    load();
  }, [pagination.page, pagination.limit, sorting.sort, sorting.order, filters.event_name, filters.employee_no, filters.employee_name, filters.department]);

  async function loadEvents() {
    try {
      const res = await api.get('/events');
      setEvents(res.data.events || []);
    } catch (e: any) {
      toast.error('Failed to load events');
    }
  }

  async function loadDepartments() {
    try {
      const res = await api.get('/employees/departments');
      setDepartments(res.data);
    } catch (e: any) {
      toast.error('Failed to load departments');
    }
  }

  async function load() {
    try {
      setError(null);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sorting.sort,
        order: sorting.order,
        ...(filters.event_name && { event_name: filters.event_name }),
        ...(filters.employee_no && { employee_no: filters.employee_no }),
        ...(filters.employee_name && { employee_name: filters.employee_name }),
        ...(filters.department && { department: filters.department })
      });
      
      const res = await api.get(`/attendance?${params}`);
      setRows(res.data.attendance);
      setPagination(res.data.pagination);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load attendance');
    }
  }
  
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/attendance/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('File uploaded successfully');
      e.target.value = '';
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to upload file');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = form.employee_name.trim();
    if (form.employee_no.trim() === '' && (!trimmedName || trimmedName.length < 2)) {
      toast.error('Employee Name is required for walk-in attendance');
      return;
    }
    const payload = { 
      ...form, 
      employee_no: form.employee_no.trim() === '' ? '' : form.employee_no.trim(),
      employee_name: trimmedName || null,
      department: form.department.trim() || null,
      event_name: form.event_name.trim()
    };
    try {
      await api.post('/attendance', payload);
      toast.success('Attendance added successfully');
      setForm({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite', event_name: '' });
      setEditingAttendance(null);
      setShowFormSection(false);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create attendance');
    }
  }

  async function updateAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAttendance) return;
    const trimmedName = form.employee_name.trim();
    if (form.employee_no.trim() === '' && (!trimmedName || trimmedName.length < 2)) {
      toast.error('Employee Name is required for walk-in attendance');
      return;
    }
    const payload = { 
      ...form, 
      employee_no: form.employee_no.trim() === '' ? '' : form.employee_no.trim(),
      employee_name: trimmedName || null,
      department: form.department.trim() || null,
      event_name: form.event_name.trim()
    };
    try {
      await api.put(`/attendance/${editingAttendance.attendance_id}`, payload);
      toast.success('Attendance updated successfully');
      setEditingAttendance(null);
      setForm({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite', event_name: '' });
      setShowFormSection(false);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update attendance');
    }
  }

  async function deleteAttendance(id: number) {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/attendance/${id}`);
      toast.success('Attendance deleted');
      await load();
    } catch (e: any) {
      toast.error('Failed to delete attendance');
    }
  }

  function startEdit(attendance: AttendanceRow) {
    setEditingAttendance(attendance);
    setForm({
      employee_no: attendance.employee_no === 'NA' ? '' : (attendance.employee_no || ''),
      employee_name: attendance.employee_name || '',
      department: attendance.department || '',
      mode_of_attendance: attendance.mode_of_attendance,
      event_name: attendance.event?.event_name || ''
    });
    setShowFormSection(true);
  }

  function cancelEdit() {
    setEditingAttendance(null);
    setForm({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite', event_name: '' });
    setShowFormSection(false);
  }

  function handleSort(field: string) {
    const newOrder = sorting.sort === field && sorting.order === 'ASC' ? 'DESC' : 'ASC';
    setSorting({ sort: field, order: newOrder });
  }

  const handleKioskLaunch = () => {
    navigate('/kiosk');
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {/* Top Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900">Attendance Management</h2>
        <motion.button
          whileHover={{ scale: 1.02 }}
          onClick={handleKioskLaunch}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
        >
          Launch Kiosk Mode
        </motion.button>
      </div>

      {/* Collapsible Filters */}
      <motion.details open={showFilters} className="bg-white p-4 rounded-lg shadow-sm">
        <summary className="cursor-pointer flex items-center justify-between font-medium text-gray-900">
          Filters {showFilters ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className="border p-2 rounded" placeholder="Event Name" value={filters.event_name} onChange={e => setFilters({ ...filters, event_name: e.target.value })} />
          <input className="border p-2 rounded" placeholder="Employee No" value={filters.employee_no} onChange={e => setFilters({ ...filters, employee_no: e.target.value })} />
          <input className="border p-2 rounded" placeholder="Employee Name" value={filters.employee_name} onChange={e => setFilters({ ...filters, employee_name: e.target.value })} />
          <input className="border p-2 rounded" placeholder="Department" value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })} />
        </div>
      </motion.details>

      {/* Import Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-3">
        <ArrowUpTrayIcon className="w-5 h-5" />
        <label className="text-sm font-medium">Import Attendance:</label>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={upload} className="border p-2 rounded file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50" />
      </div>

      {/* Collapsible Add/Edit Form */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
      <button
        onClick={() => setShowFormSection(!showFormSection)}
        className="w-full flex items-center justify-between font-medium text-gray-900 py-2"
      >
        {editingAttendance ? 'Edit' : 'Add New Record'}
        {showFormSection ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
      </button>
      <AnimatePresence>
        {showFormSection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 overflow-hidden"
          >
            <form onSubmit={editingAttendance ? updateAttendance : submit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <input className="border p-2 rounded" placeholder="Employee No (optional)" value={form.employee_no} onChange={e => setForm({ ...form, employee_no: e.target.value })} />
              <input className="border p-2 rounded" placeholder="Employee Name" value={form.employee_name} onChange={e => setForm({ ...form, employee_name: e.target.value })} required={form.employee_no.trim() === ''} />
              <input className="border p-2 rounded" placeholder="Department" list="departments-list" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
              <datalist id="departments-list">{departments.map(dept => <option key={dept} value={dept} />)}</datalist>
              <select className="border p-2 rounded" value={form.mode_of_attendance} onChange={e => setForm({ ...form, mode_of_attendance: e.target.value as any })}>
                <option>Onsite</option>
                <option>Virtual</option>
              </select>
              <input className="border p-2 rounded" placeholder="Event Name" list="events-list" value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })} required />
              <datalist id="events-list">{events.map(event => <option key={event.event_id} value={event.event_name} />)}</datalist>
              <div className="flex gap-2 col-span-5">
                <button className="bg-blue-600 text-white px-4 py-2 rounded flex-1" type="submit">
                  {editingAttendance ? 'Update' : 'Add'} Attendance
                </button>
                {editingAttendance && <button type="button" onClick={cancelEdit} className="bg-gray-600 text-white px-4 py-2 rounded flex-1">Cancel</button>}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
      {/* Table with Sticky Header */}
<div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
  <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Attendance records">
    <thead className="bg-gray-50 sticky top-0 z-10">
      <tr className="text-left">
        <th className="px-4 py-3 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-tl-lg" 
            onClick={() => handleSort('attendance_id')} 
            role="columnheader" 
            aria-sort={sorting.sort === 'attendance_id' ? (sorting.order === 'ASC' ? 'ascending' : 'descending') : 'none'}>
          ID 
          {sorting.sort === 'attendance_id' && (sorting.order === 'ASC' ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>)}
        </th>
        <th className="px-4 py-3 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            onClick={() => handleSort('employee_no')} 
            role="columnheader" 
            aria-sort={sorting.sort === 'employee_no' ? (sorting.order === 'ASC' ? 'ascending' : 'descending') : 'none'}>
          Employee No 
          {sorting.sort === 'employee_no' && (sorting.order === 'ASC' ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>)}
        </th>
        <th className="px-4 py-3 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            onClick={() => handleSort('employee_name')} 
            role="columnheader" 
            aria-sort={sorting.sort === 'employee_name' ? (sorting.order === 'ASC' ? 'ascending' : 'descending') : 'none'}>
          Name 
          {sorting.sort === 'employee_name' && (sorting.order === 'ASC' ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>)}
        </th>
        <th className="px-4 py-3 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            onClick={() => handleSort('department')} 
            role="columnheader" 
            aria-sort={sorting.sort === 'department' ? (sorting.order === 'ASC' ? 'ascending' : 'descending') : 'none'}>
          Department 
          {sorting.sort === 'department' && (sorting.order === 'ASC' ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>)}
        </th>
        <th className="px-4 py-3 text-sm font-semibold text-gray-900">Mode</th>
        <th className="px-4 py-3 text-sm font-semibold text-gray-900">Status</th>
        <th className="px-4 py-3 text-sm font-semibold text-gray-900">Event</th>
        <th className="px-4 py-3 text-sm font-semibold text-gray-900 rounded-tr-lg">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200">
      {rows.length === 0 ? (
        <tr>
          <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm" role="row">
            No attendance records found.
          </td>
        </tr>
      ) : (
        rows.map((r, index) => (
          <tr key={r.attendance_id} className={`hover:bg-gray-50 focus-within:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} role="row">
            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900" role="cell">{r.attendance_id}</td>
            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900" role="cell">{r.employee_no || 'N/A'}</td>
            <td className="px-4 py-4 text-sm text-gray-900" role="cell">{r.employee_name || 'N/A'}</td>
            <td className="px-4 py-4 text-sm text-gray-900" role="cell">{r.department || 'N/A'}</td>
            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900" role="cell">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${r.mode_of_attendance === 'Onsite' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                {r.mode_of_attendance}
              </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900" role="cell">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${r.validation_status === 'Registered' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {r.validation_status}
              </span>
            </td>
            <td className="px-4 py-4 text-sm text-gray-900" role="cell">{r.event?.event_name || 'N/A'}</td>
            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium" role="cell">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => startEdit(r)} 
                  className="text-blue-600 hover:text-blue-900 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={`Edit ${r.employee_name || 'record'}`}
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => deleteAttendance(r.attendance_id)} 
                  className="text-red-600 hover:text-red-900 p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Delete ${r.employee_name || 'record'}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        ))
      )}
    </tbody>
  </table>
</div>

      {/* Pagination */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
        <div className="text-sm text-gray-600">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
        </div>
        <div className="flex gap-2">
          <button disabled={pagination.page <= 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}