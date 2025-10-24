import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { XMarkIcon, MagnifyingGlassIcon, PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type Event = { event_id: number; event_type: string; event_name: string; event_date: string };

type Pagination = { total: number; page: number; limit: number; totalPages: number };

type UploadResult = { inserted: number; skipped?: number; skip_details?: Array<{ reason: string; event_name?: string; event_type?: string }> };

export function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState({ event_type: '', event_name: '', event_date: '' });
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [showUploadResult, setShowUploadResult] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    loadEvents();
  }, [pagination.page, pagination.limit, search]);

  async function loadEvents() {
    try {
      setError(null);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search: search.toLowerCase() })
      });
      const res = await api.get(`/events?${params}`);
      setEvents(res.data.events || []);
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 0 });
    } catch (e: any) {
      setError('Failed to load events');
      toast.error('Failed to load events');
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
      const res = await api.post('/events/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      e.target.value = '';
      setUploadResult(res.data);
      setShowUploadResult(true);
      toast.success(`Upload completed: ${res.data.inserted} events added`);
      loadEvents();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to upload file');
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  function openModal(event?: Event) {
    if (event) {
      setEditingEvent(event);
      setForm({
        event_type: event.event_type,
        event_name: event.event_name,
        event_date: event.event_date.split('T')[0] // Format for input
      });
    } else {
      setEditingEvent(null);
      setForm({ event_type: '', event_name: '', event_date: '' });
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingEvent(null);
    setForm({ event_type: '', event_name: '', event_date: '' });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.event_name.trim() || !form.event_type.trim() || !form.event_date.trim()) {
      toast.error('All fields are required');
      return;
    }
    try {
      setError(null);
      if (editingEvent) {
        await api.put(`/events/${editingEvent.event_id}`, form);
        toast.success('Event updated successfully');
      } else {
        await api.post('/events', form);
        toast.success('Event added successfully');
      }
      closeModal();
      loadEvents();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save event');
      toast.error(e.response?.data?.error || 'Failed to save event');
    }
  }

  function handlePageChange(newPage: number) {
    setPagination({ ...pagination, page: newPage });
  }

  function handleLimitChange(newLimit: number) {
    setPagination({ ...pagination, page: 1, limit: newLimit });
  }

  const ErrorAlert = () => error ? (
    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4 transition-all">
      {error}
    </div>
  ) : null;

  const UploadResultModal = ({ isOpen, onClose, result }: { isOpen: boolean; onClose: () => void; result: UploadResult | null }) => (
    <AnimatePresence>
      {isOpen && result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-25 p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Upload Summary</h3>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-green-600 font-medium">✅ {result.inserted} events added successfully</p>
              {result.skipped && result.skipped > 0 && (
                <>
                  <p className="text-yellow-600 font-medium flex items-center gap-1">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    {result.skipped} events skipped (duplicates/errors)
                  </p>
                  {result.skip_details && result.skip_details.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-gray-700 bg-yellow-50 p-3 rounded-md">
                      {result.skip_details.map((detail, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          • {detail.reason} {detail.event_name && `(Event: ${detail.event_name})`}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full mt-4 bg-gray-600 text-white py-2 rounded-md font-semibold hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const PaginationControls = () => (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
      <div className="text-sm text-gray-700">
        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} events
      </div>
      <div className="flex items-center gap-2">
        <select
          value={pagination.limit}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className="border border-gray-300 rounded-md px-2 py-1 text-sm"
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
        </select>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm font-medium">{pagination.page} / {pagination.totalPages}</span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Events Management</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagination({ ...pagination, page: 1 }); }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 text-sm transition-colors"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors shadow-sm"
            disabled={loading}
            title="Add Event"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium mb-3 text-gray-900">Import Events</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Upload Events.csv or .xlsx:</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={upload}
            disabled={loading}
            className="border border-gray-300 p-2 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 text-sm"
          />
          {loading && <span className="text-sm text-blue-600">Uploading...</span>}
        </div>
      </div>

      {/* Events List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.event_id} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{event.event_name}</h3>
            <p className="text-sm text-gray-600 mb-2">{event.event_type}</p>
            <p className="text-sm text-blue-600 font-medium">{new Date(event.event_date).toLocaleDateString()}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => openModal(event)}
                className="text-blue-600 hover:text-blue-500 p-1 rounded transition-colors"
                title="Edit"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this event?')) {
                    await api.delete(`/events/${event.event_id}`);
                    loadEvents();
                    toast.success('Event deleted');
                  }
                }}
                className="text-red-600 hover:text-red-500 p-1 rounded transition-colors"
                title="Delete"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {events.length === 0 && !loading && (
        <p className="text-center text-gray-500 py-8 text-lg">No events yet. Add one to get started—it's quick and easy!</p>
      )}
      {pagination.total > 0 && <PaginationControls />}

      {/* Add/Edit Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-25 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingEvent ? 'Edit Event' : 'Add New Event'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <ErrorAlert />

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                  <input
                    type="text"
                    value={form.event_type}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Wellness Seminar"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                  <input
                    type="text"
                    value={form.event_name}
                    onChange={(e) => setForm({ ...form, event_name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Yoga Session"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    type="button"
                    onClick={closeModal}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : (editingEvent ? 'Update' : 'Add')} Event
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UploadResultModal isOpen={showUploadResult} onClose={() => setShowUploadResult(false)} result={uploadResult} />
    </div>
  );
}