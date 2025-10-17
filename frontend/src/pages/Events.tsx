import { useEffect, useState } from 'react';
import { api } from '../services/api';

type Event = { event_id: number; event_type: string; event_name: string; event_date: string };

export function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState({ event_type: '', event_name: '', event_date: '' });
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // Pagination and filtering state
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [filters, setFilters] = useState({ type: '', name: '', date: '' });
  const [sorting, setSorting] = useState({ sort: 'event_date', order: 'DESC' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sorting.sort,
        order: sorting.order,
        ...(filters.type && { type: filters.type }),
        ...(filters.name && { name: filters.name }),
        ...(filters.date && { date: filters.date })
      });
      
      const res = await api.get(`/events?${params}`);
      setEvents(res.data.events);
      setPagination(res.data.pagination);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401) setError('Unauthorized. Please login first.');
      else setError(e?.response?.data?.error || 'Failed to load events. Check API URL and server.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }
  
  useEffect(() => { load(); }, [pagination.page, pagination.limit, sorting.sort, sorting.order, filters.type, filters.name, filters.date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.event_type || !form.event_name || !form.event_date) return;
    try {
      await api.post('/events', form);
      setForm({ event_type: '', event_name: '', event_date: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to create event');
    }
  }

  async function updateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEvent || !form.event_type || !form.event_name || !form.event_date) return;
    try {
      await api.put(`/events/${editingEvent.event_id}`, form);
      setEditingEvent(null);
      setForm({ event_type: '', event_name: '', event_date: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update event');
    }
  }

  async function deleteEvent(id: number) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete event');
    }
  }

  function startEdit(event: Event) {
    setEditingEvent(event);
    setForm({ event_type: event.event_type, event_name: event.event_name, event_date: event.event_date });
  }

  function cancelEdit() {
    setEditingEvent(null);
    setForm({ event_type: '', event_name: '', event_date: '' });
  }

  function handleSort(field: string) {
    const newOrder = sorting.sort === field && sorting.order === 'ASC' ? 'DESC' : 'ASC';
    setSorting({ sort: field, order: newOrder });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Events</h2>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm text-gray-600">Loading...</div>}
      
      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Event Type</label>
            <input 
              className="border p-2 w-full rounded" 
              placeholder="Filter by event type" 
              value={filters.type} 
              onChange={e => setFilters({ ...filters, type: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Event Name</label>
            <input 
              className="border p-2 w-full rounded" 
              placeholder="Filter by event name" 
              value={filters.name} 
              onChange={e => setFilters({ ...filters, name: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Event Date</label>
            <input 
              className="border p-2 w-full rounded" 
              type="date" 
              value={filters.date} 
              onChange={e => setFilters({ ...filters, date: e.target.value })} 
            />
          </div>
        </div>
      </div>
      
      {/* Import Section */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Import Events (CSV/XLSX):</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const formData = new FormData();
              formData.append('file', file);
              await api.post('/events/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
              await load();
            } catch (e: any) {
              setError(e?.response?.data?.error || 'Failed to upload file');
            } finally {
              setUploading(false);
            }
          }}
          className="border p-2 rounded"
        />
        {uploading && <span className="text-sm text-gray-600">Uploading...</span>}
      </div>
      
      {/* Add/Edit Form */}
      <form onSubmit={editingEvent ? updateEvent : submit} className="grid grid-cols-4 gap-3 items-end">
        <input className="border p-2 rounded" placeholder="Event Type" value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Event Name" value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })} />
        <input className="border p-2 rounded" type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
        <div className="flex gap-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded">
            {editingEvent ? 'Update' : 'Add'}
          </button>
          {editingEvent && (
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
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('event_id')}>
                ID {sorting.sort === 'event_id' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('event_type')}>
                Type {sorting.sort === 'event_type' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('event_name')}>
                Name {sorting.sort === 'event_name' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('event_date')}>
                Date {sorting.sort === 'event_date' && (sorting.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.event_id}>
                <td className="p-2 border">{ev.event_id}</td>
                <td className="p-2 border">{ev.event_type}</td>
                <td className="p-2 border">{ev.event_name}</td>
                <td className="p-2 border">{new Date(ev.event_date).toLocaleDateString()}</td>
                <td className="p-2 border">
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(ev)}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteEvent(ev.event_id)}
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
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} events
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


