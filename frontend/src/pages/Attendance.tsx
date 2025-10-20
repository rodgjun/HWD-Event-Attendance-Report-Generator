import { useEffect, useState } from 'react';
import { api } from '../services/api';

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
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [form, setForm] = useState({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite', event_name: '' });
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination and filtering state
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [filters, setFilters] = useState({ 
    event_name: '', 
    employee_no: '', 
    employee_name: '', 
    department: ''
  });
  const [sorting, setSorting] = useState({ sort: 'attendance_id', order: 'DESC' });

  async function loadEvents() {
    try {
      const res = await api.get('/events'); // Assumes /events returns { events: [...] }
      setEvents(res.data.events || []);
    } catch (e: any) {
      console.error('Failed to load events:', e);
      setError('Failed to load events for autocomplete');
    }
  }

  async function loadDepartments() {
    try {
      const res = await api.get('/attendance/departments');
      setDepartments(res.data);
    } catch (e: any) {
      console.error('Failed to load departments:', e);
      setError('Failed to load departments for autocomplete');
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
      console.error('Failed to load attendance:', e);
      setError(e.response?.data?.error || 'Failed to load attendance');
    }
  }
  
  useEffect(() => { 
    loadEvents();
    loadDepartments();
    load(); 
  }, [pagination.page, pagination.limit, sorting.sort, sorting.order, filters.event_name, filters.employee_no, filters.employee_name, filters.department]);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setError(null);
      await api.post('/attendance/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (e: any) {
      console.error('Failed to upload file:', e);
      setError(e.response?.data?.error || 'Failed to upload file');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = form.employee_name.trim();
    if (form.employee_no.trim() === '' && (!trimmedName || trimmedName.length < 2)) {
      setError('Employee Name is required for walk-in attendance');
      return;
    }
    const payload = { 
      ...form, 
      employee_no: form.employee_no.trim() === '' ? '' : form.employee_no.trim(),  // Empty → backend to 'NA'
      employee_name: trimmedName || null,
      department: form.department.trim() || null,
      event_name: form.event_name.trim()
    };
    try {
      setError(null);
      await api.post('/attendance', payload);
      setForm({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite', event_name: '' });
      await load();
    } catch (e: any) {
      console.error('Failed to create attendance:', e);
      setError(e.response?.data?.error || (e.response?.data?.details ? `Validation error: ${JSON.stringify(e.response.data.details)}` : 'Failed to create attendance'));
    }
  }

  async function updateAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAttendance) return;
    const trimmedName = form.employee_name.trim();
    if (form.employee_no.trim() === '' && (!trimmedName || trimmedName.length < 2)) {
      setError('Employee Name is required for walk-in attendance');
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
      setError(null);
      await api.put(`/attendance/${editingAttendance.attendance_id}`, payload);
      setEditingAttendance(null);
      setForm({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite', event_name: '' });
      await load();
    } catch (e: any) {
      console.error('Failed to update attendance:', e);
      setError(e.response?.data?.error || (e.response?.data?.details ? `Validation error: ${JSON.stringify(e.response.data.details)}` : 'Failed to update attendance'));
    }
  }

  async function deleteAttendance(id: number) {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      setError(null);
      await api.delete(`/attendance/${id}`);
      await load();
    } catch (e: any) {
      console.error('Failed to delete attendance:', e);
      setError('Failed to delete attendance');
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
    setError(null);
  }

  function cancelEdit() {
    setEditingAttendance(null);
    setForm({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite', event_name: '' });
    setError(null);
  }

  function handleSort(field: string) {
    const newOrder = sorting.sort === field && sorting.order === 'ASC' ? 'DESC' : 'ASC';
    setSorting({ sort: field, order: newOrder });
  }

  // Error display component
  const ErrorAlert = () => error ? (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      {error}
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Attendance</h2>
      
      <ErrorAlert />
      
      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Event Name</label>
            <input 
              className="border p-2 w-full rounded" 
              placeholder="Filter by Event Name" 
              value={filters.event_name} 
              onChange={e => setFilters({ ...filters, event_name: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Employee No</label>
            <input 
              className="border p-2 w-full rounded" 
              placeholder="Filter by Employee No" 
              value={filters.employee_no} 
              onChange={e => setFilters({ ...filters, employee_no: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Employee Name</label>
            <input 
              className="border p-2 w-full rounded" 
              placeholder="Filter by Employee Name" 
              value={filters.employee_name} 
              onChange={e => setFilters({ ...filters, employee_name: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <input 
              className="border p-2 w-full rounded" 
              placeholder="Filter by Department" 
              value={filters.department} 
              onChange={e => setFilters({ ...filters, department: e.target.value })} 
            />
          </div>
        </div>
      </div>
      
      {/* Import Section */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Import Attendance:</label>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={upload} className="border p-2 rounded" />
      </div>
      
      {/* Add/Edit Form */}
      <form onSubmit={editingAttendance ? updateAttendance : submit} className="grid grid-cols-5 gap-3 items-end">
        <input 
          className="border p-2 rounded" 
          placeholder="Employee No (optional)" 
          value={form.employee_no} 
          onChange={e => setForm({ ...form, employee_no: e.target.value })} 
        />
        <input 
          className="border p-2 rounded" 
          placeholder="Employee Name" 
          value={form.employee_name} 
          onChange={e => setForm({ ...form, employee_name: e.target.value })} 
          required={form.employee_no.trim() === ''}
        />
        <input 
          className="border p-2 rounded" 
          placeholder="Department" 
          list="departments-list"
          value={form.department} 
          onChange={e => setForm({ ...form, department: e.target.value })} 
        />
        <datalist id="departments-list">
          {departments.map(dept => <option key={dept} value={dept} />)}
        </datalist>
        <select className="border p-2 rounded" value={form.mode_of_attendance} onChange={e => setForm({ ...form, mode_of_attendance: e.target.value as any })}>
          <option>Onsite</option>
          <option>Virtual</option>
        </select>
        <input 
          className="border p-2 rounded" 
          placeholder="Event Name" 
          list="events-list"
          value={form.event_name} 
          onChange={e => setForm({ ...form, event_name: e.target.value })} 
          required
        />
        <datalist id="events-list">
          {events.map(event => <option key={event.event_id} value={event.event_name} />)}
        </datalist>
        <div className="flex gap-2 col-span-5">
          <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">
            {editingAttendance ? 'Update' : 'Add'} Attendance
          </button>
          {editingAttendance && (
            <button type="button" onClick={cancelEdit} className="bg-gray-600 text-white px-4 py-2 rounded">
              Cancel
            </button>
          )}
        </div>
      </form>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('attendance_id')}>
                ID {sorting.sort === 'attendance_id' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('employee_no')}>
                Emp No {sorting.sort === 'employee_no' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('employee_name')}>
                Name {sorting.sort === 'employee_name' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('department')}>
                Dept {sorting.sort === 'department' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border">Event Name</th>
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('mode_of_attendance')}>
                Mode {sorting.sort === 'mode_of_attendance' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('validation_status')}>
                Status {sorting.sort === 'validation_status' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.attendance_id}>
                <td className="p-2 border">{r.attendance_id}</td>
                <td className="p-2 border">{r.employee_no === 'NA' ? 'N/A' : (r.employee_no || 'N/A')}</td>
                <td className="p-2 border">{r.employee_name || 'N/A'}</td>
                <td className="p-2 border">{r.department || 'N/A'}</td>
                <td className="p-2 border">{r.event?.event_name || 'N/A'}</td>
                <td className="p-2 border">{r.mode_of_attendance}</td>
                <td className="p-2 border">{r.validation_status}</td>
                <td className="p-2 border">
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(r)}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAttendance(r.attendance_id)}
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} attendance
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            disabled={pagination.page <= 1}
            className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            disabled={pagination.page >= pagination.totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}