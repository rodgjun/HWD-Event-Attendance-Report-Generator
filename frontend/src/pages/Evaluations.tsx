import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { Toaster, toast } from 'react-hot-toast';
import { 
  ChevronDownIcon, ChevronUpIcon,
  XMarkIcon, 
  MagnifyingGlassIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { SearchInput } from '../components/SearchInput';
import { EventFilterDropdown } from '../components/EventFilterDropdown';
import { UploadResultModal } from '../components/UploadResultModal';
import { TableContainer } from '../components/TableContainer';
import { Pagination } from '../components/Pagination';
import { FileActionsBar } from '../components/FileActionsBar';

type Evaluation = {
  evaluation_id: number;
  employee_no?: string;
  employee_name: string;
  event_id: number;
  event: { event_name: string };
  objectives_met?: string;
  relevance?: string;
  venue?: string;
  activity?: string;
  value_time_spent?: string;
  overall_rating?: string;
  topic_clear_effective?: string;
  answered_questions?: string;
  presentation_materials?: string;
  session_helpful?: string;
};

type PaginationType = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type UploadResult = {
  inserted: number;
  skipped?: number;
  skip_details?: Array<{ reason: string; employee_name?: string; event_name?: string }>;
};

type FormData = {
  employee_no: string;
  employee_name: string;
  event_id: number;
  objectives_met: string;
  relevance: string;
  venue: string;
  activity: string;
  value_time_spent: string;
  overall_rating: string;
  topic_clear_effective: string;
  answered_questions: string;
  presentation_materials: string;
  session_helpful: string;
};

interface AddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormData;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  events: { event_id: number; event_name: string }[];
  editingId: number | null;
}

function AddEditModal({ 
  isOpen, 
  onClose, 
  form, 
  onFormChange, 
  onSubmit, 
  error, 
  events, 
  editingId 
}: AddEditModalProps) {
  const ErrorAlert = () => error ? (
    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4 transition-all">
      {error}
    </div>
  ) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-25 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[65vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Evaluation' : 'Add Evaluation'}
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <ErrorAlert />
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Basic Information</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Employee No (optional)</label>
                  <input
                    type="text"
                    value={form.employee_no}
                    onChange={(e) => onFormChange({ employee_no: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Employee Name *</label>
                  <input
                    type="text"
                    value={form.employee_name}
                    onChange={(e) => onFormChange({ employee_name: e.target.value })}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Event *</label>
                  <select
                    value={form.event_id}
                    onChange={(e) => onFormChange({ event_id: Number(e.target.value) })}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={0}>Select Event</option>
                    {events.map((event) => (
                      <option key={event.event_id} value={event.event_id}>
                        {event.event_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Criteria Legend */}
              <div className="p-3 bg-gray-50 rounded-md text-xs text-gray-600">
                <strong>Criteria:</strong> 5 – Excellent | 4 – Very Good | 3 – Good | 2 – Fair | 1 – Needs Improvement | NA – Not Applicable
              </div>

              {/* Overall Conduct of Activity */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Overall Conduct of Activity</h4>
                {[
                  { key: 'objectives_met', label: 'Objectives were met' },
                  { key: 'relevance', label: 'Relevance' },
                  { key: 'venue', label: 'Venue' },
                  { key: 'activity', label: 'Activity' },
                  { key: 'value_time_spent', label: 'Value of Time Spent' },
                  { key: 'overall_rating', label: 'Overall Rating' }
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <select
                      value={form[key as keyof FormData] || ''}
                      onChange={(e) => onFormChange({ [key]: e.target.value } as Partial<FormData>)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select</option>
                      {['1', '2', '3', '4', '5', 'NA'].map((val) => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Resource Speaker */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Resource Speaker</h4>
                {[
                  { key: 'topic_clear_effective', label: 'Discussed topic clearly and effectively' },
                  { key: 'answered_questions', label: 'Answered questions appropriately' },
                  { key: 'presentation_materials', label: 'Presentation/materials' }
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <select
                      value={form[key as keyof FormData] || ''}
                      onChange={(e) => onFormChange({ [key]: e.target.value } as Partial<FormData>)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select</option>
                      {['1', '2', '3', '4', '5', 'NA'].map((val) => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Session Helpful */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Session Feedback</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">This session was helpful</label>
                  <select
                    value={form.session_helpful || ''}
                    onChange={(e) => onFormChange({ session_helpful: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                {editingId ? 'Update' : 'Add'} Evaluation
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper to compute average rating (ignores 'NA')
function computeAverage(ratings: (string | undefined)[]): string {
  const valid = ratings.filter(r => r && r !== 'NA').map(Number);
  return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : 'N/A';
}

export function Evaluations() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [form, setForm] = useState<FormData>({
    employee_no: '',
    employee_name: '',
    event_id: 0,
    objectives_met: '',
    relevance: '',
    venue: '',
    activity: '',
    value_time_spent: '',
    overall_rating: '',
    topic_clear_effective: '',
    answered_questions: '',
    presentation_materials: '',
    session_helpful: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [showUploadResult, setShowUploadResult] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [events, setEvents] = useState<{ event_id: number; event_name: string }[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [sortBy, setSortBy] = useState<string>('evaluation_id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const exportParams = {
    ...(search && { search }),
    ...(selectedEventId > 0 && { event_id: selectedEventId.toString() })
  };

  const handleFormChange = useCallback((updates: Partial<FormData>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm({
      employee_no: '',
      employee_name: '',
      event_id: 0,
      objectives_met: '',
      relevance: '',
      venue: '',
      activity: '',
      value_time_spent: '',
      overall_rating: '',
      topic_clear_effective: '',
      answered_questions: '',
      presentation_materials: '',
      session_helpful: ''
    });
    setError(null);
  }, []);

  const handleOpenModal = useCallback((evaluation?: Evaluation) => {
    if (evaluation) {
      setEditingId(evaluation.evaluation_id);
      setForm({
        employee_no: evaluation.employee_no || '',
        employee_name: evaluation.employee_name,
        event_id: evaluation.event_id,
        objectives_met: evaluation.objectives_met || '',
        relevance: evaluation.relevance || '',
        venue: evaluation.venue || '',
        activity: evaluation.activity || '',
        value_time_spent: evaluation.value_time_spent || '',
        overall_rating: evaluation.overall_rating || '',
        topic_clear_effective: evaluation.topic_clear_effective || '',
        answered_questions: evaluation.answered_questions || '',
        presentation_materials: evaluation.presentation_materials || '',
        session_helpful: evaluation.session_helpful || ''
      });
    } else {
      setEditingId(null);
      setForm({
        employee_no: '',
        employee_name: '',
        event_id: 0,
        objectives_met: '',
        relevance: '',
        venue: '',
        activity: '',
        value_time_spent: '',
        overall_rating: '',
        topic_clear_effective: '',
        answered_questions: '',
        presentation_materials: '',
        session_helpful: ''
      });
    }
    setError(null);
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    loadEvents();
    loadEvaluations();
  }, [pagination.page, pagination.limit, search, selectedEventId, sortBy, sortOrder]);

  async function loadEvents() {
    try {
      const res = await api.get('/events/all');
      setEvents(res.data.events || []);
    } catch (e: any) {
      toast.error('Failed to load events');
    }
  }

  async function loadEvaluations() {
  try {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      ...(search && { search }),
      ...(selectedEventId > 0 && { event_id: selectedEventId.toString() }),
      sort: sortBy,
      order: sortOrder
    });
    const res = await api.get(`/evaluations?${params}`);
    setEvaluations(res.data.evaluations || []);
    setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 0 });
  } catch (e: any) {
    setError('Failed to load evaluations');
    toast.error('Failed to load evaluations');
  } finally {
    setLoading(false);
  }
}

  const handleBulkDelete = async () => {
  if (!confirm(`Delete ${selectedRows.size} selected records?`)) return;

  try {
    await api.post('/evaluations/bulk-delete', { ids: Array.from(selectedRows) });
    toast.success('Bulk delete successful');
    setSelectedRows(new Set());
    // --- REFRESH DATA ---
    await loadEvaluations(); // reuse existing load logic
  } catch (e: any) {
    toast.error(e.response?.data?.error || 'Bulk delete failed');
  }
};

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_name.trim() || form.event_id === 0) {
      toast.error('Employee name and event are required');
      return;
    }
    try {
      setError(null);
      const payload = {
        ...form,
        employee_no: form.employee_no.trim() || undefined
      };
      if (editingId) {
        await api.put(`/evaluations/${editingId}`, payload);
        toast.success('Evaluation updated successfully');
      } else {
        await api.post('/evaluations', payload);
        toast.success('Evaluation added successfully');
      }
      handleCloseModal();
      loadEvaluations();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save evaluation');
      toast.error(e.response?.data?.error || 'Failed to save evaluation');
    }
  }

  function handlePageChange(newPage: number) {
    setPagination({ ...pagination, page: newPage });
  }

  function handleLimitChange(newLimit: number) {
    setPagination({ ...pagination, page: 1, limit: newLimit });
  }

    function handleSearchChange(value: string) {
    setSearch(value); // Immediate set; debounce handled in SearchInput
    setPagination(prev => ({ ...prev, page: 1 })); // Reset page
  }

  function handleEventChange(eventId: number) {
    setSelectedEventId(eventId);
    setPagination({ ...pagination, page: 1 });
  }

  function handleSort(column: string) {
    if (sortBy !== column) {
      setSortBy(column);
      setSortOrder('ASC');
    } else {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function toggleRow(id: number) {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  }

  function toggleAll() {
    if (selectedRows.size === evaluations.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(evaluations.map(e => e.evaluation_id)));
    }
  }

  const isAllSelected = evaluations.length > 0 && selectedRows.size === evaluations.length;

  // Compute averages for each evaluation
  const evaluationsWithAverages = evaluations.map(e => ({
    ...e,
    overallConductAvg: computeAverage([
      e.objectives_met, e.relevance, e.venue, e.activity, 
      e.value_time_spent, e.overall_rating
    ]),
    resourceSpeakerAvg: computeAverage([
      e.topic_clear_effective, e.answered_questions, e.presentation_materials
    ])
  }));

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'ASC' ? <ChevronUpIcon className="w-3 h-3 ml-1" /> : <ChevronDownIcon className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Evaluations</h1>
        <div className="flex items-center gap-3">
        <SearchInput value={search} onChange={handleSearchChange} placeholder="Search name or employee no..." />
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-5 h-5" />
        </motion.button>
      </div>
      </div>

      <FileActionsBar
        uploadEndpoint="/evaluations/upload"
        exportEndpoint="/evaluations/export"
        templateEndpoint="/evaluations/template"
        exportParams={exportParams}
        uploadLabel="Upload Registrations"
        onUploadComplete={loadEvaluations}
      />
      
      <div className="overflow-x-auto bg-white rounded-lg shadow">

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
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('employee_no')}
              >
                Employee No {getSortIcon('employee_no')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('employee_name')}
              >
                Name {getSortIcon('employee_name')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                // Note: Computed; sort by employee_name as fallback if needed
              >
                Overall Conduct Avg
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                Resource Speaker Avg
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <TableContainer loading={loading} data={evaluationsWithAverages} emptyMessage="No evaluations found." modulename="evaluations">
              {evaluationsWithAverages.map((evaluation) => (
                <tr key={evaluation.evaluation_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(evaluation.evaluation_id)}
                      onChange={() => toggleRow(evaluation.evaluation_id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {evaluation.employee_no || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {evaluation.employee_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {evaluation.overallConductAvg}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {evaluation.resourceSpeakerAvg}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleOpenModal(evaluation)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Delete this evaluation?')) {
                          try {
                            await api.delete(`/evaluations/${evaluation.evaluation_id}`);
                            toast.success('Evaluation deleted');
                            loadEvaluations();
                          } catch (e: any) {
                            toast.error('Delete failed');
                          }
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </TableContainer>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-gray-700">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
        </div>
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
        disabled={loading}
      />
      </div>

      <UploadResultModal
        result={uploadResult}
        isOpen={showUploadResult}
        onClose={() => setShowUploadResult(false)}
      />

      <AddEditModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        form={form}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
        error={error}
        events={events}
        editingId={editingId}
      />
    </div>
  );
}