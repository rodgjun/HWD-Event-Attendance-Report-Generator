import { useEffect, useState } from 'react';
import { api } from '../services/api';

type Event = { event_id: number; event_type: string; event_name: string; event_date: string };

export function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState({ event_type: '', event_name: '', event_date: '' });
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false); // Toggle for manual add/edit

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const res = await api.get('/events');
      setEvents(res.data.events || []);
      setError(null);
    } catch (e: any) {
      setError('Failed to load events');
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    setError(null);
    try {
      await api.post('/events/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      e.target.value = ''; // Reset file input
      loadEvents();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      const payload = { ...form, event_date: form.event_date || new Date().toISOString().split('T')[0] };
      if (editingEvent) {
        await api.put(`/events/${editingEvent.event_id}`, payload);
      } else {
        await api.post('/events', payload);
      }
      setForm({ event_type: '', event_name: '', event_date: '' });
      setEditingEvent(null);
      setShowForm(false);
      loadEvents();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save event');
    }
  }

  function startEdit(event: Event) {
    setEditingEvent(event);
    setForm({ event_type: event.event_type, event_name: event.event_name, event_date: event.event_date });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingEvent(null);
    setForm({ event_type: '', event_name: '', event_date: '' });
    setShowForm(false);
  }

  const filteredEvents = events.filter(
    (e) => e.event_name.toLowerCase().includes(search.toLowerCase()) || e.event_type.toLowerCase().includes(search.toLowerCase())
  );

  const ErrorAlert = () => error ? (
    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4 transition-all">
      {error}
    </div>
  ) : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Events Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          {showForm ? 'Cancel' : 'Add Event'}
        </button>
      </div>

      {/* Import Section */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-medium mb-3 text-gray-900">Import Events</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Upload Events.csv or .xlsx:</label>
          <input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            onChange={upload} 
            disabled={loading}
            className="border border-gray-300 p-2 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {loading && <span className="text-sm text-blue-600">Uploading...</span>}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-white p-6 rounded-xl shadow-md space-y-4">
          <ErrorAlert />
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                placeholder="e.g., Wellness Session"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                value={form.event_name}
                onChange={(e) => setForm({ ...form, event_name: e.target.value })}
                placeholder="e.g., Yoga Workshop"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors w-full md:w-auto disabled:opacity-50"
          >
            {editingEvent ? 'Update' : 'Create'} Event
          </button>
        </form>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-xl shadow-md">
        <input
          type="text"
          placeholder="Search events by name or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />
      </div>

      {/* Events List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.map((event) => (
          <div key={event.event_id} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{event.event_name}</h3>
            <p className="text-sm text-gray-600 mb-2">{event.event_type}</p>
            <p className="text-sm text-blue-600 font-medium">{new Date(event.event_date).toLocaleDateString()}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => startEdit(event)}
                className="text-blue-600 hover:text-blue-500 text-sm transition-colors"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  if (confirm('Delete this event?')) {
                    await api.delete(`/events/${event.event_id}`);
                    loadEvents();
                  }
                }}
                className="text-red-600 hover:text-red-500 text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {filteredEvents.length === 0 && !loading && (
        <p className="text-center text-gray-500 py-8">No events found. Import or create one to get started!</p>
      )}
    </div>
  );
}