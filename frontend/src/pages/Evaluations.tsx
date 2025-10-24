import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  XMarkIcon, MagnifyingGlassIcon, PlusIcon, PencilIcon, TrashIcon, 
  CheckCircleIcon, ExclamationTriangleIcon, ArrowDownTrayIcon as DownloadIcon 
} from '@heroicons/react/24/outline';

type EventOption = { event_id: number; event_name: string };

type Evaluation = {
  evaluation_id: number;
  employee_no: string | null;
  employee_name: string;
  event_id: number;
  event: { event_name: string };
  objectives_met: '1' | '2' | '3' | '4' | '5' | 'NA';
  relevance: '1' | '2' | '3' | '4' | '5' | 'NA';
  venue: '1' | '2' | '3' | '4' | '5' | 'NA';
  activity: '1' | '2' | '3' | '4' | '5' | 'NA';
  value_time_spent: '1' | '2' | '3' | '4' | '5' | 'NA';
  overall_rating: '1' | '2' | '3' | '4' | '5' | 'NA';
  topic_clear_effective: '1' | '2' | '3' | '4' | '5' | 'NA';
  answered_questions: '1' | '2' | '3' | '4' | '5' | 'NA';
  presentation_materials: '1' | '2' | '3' | '4' | '5' | 'NA';
  session_helpful: 'Yes' | 'No';
};

type Pagination = { total: number; page: number; limit: number; totalPages: number };

type UploadResult = { 
  inserted: number; 
  skipped?: number; 
  skip_details?: Array<{ reason: string; event_name?: string; employee_name?: string }> 
};

type EvaluationForm = {
  employee_no: string;
  employee_name: string;
  event_id: number;
  objectives_met: '1' | '2' | '3' | '4' | '5' | 'NA';
  relevance: '1' | '2' | '3' | '4' | '5' | 'NA';
  venue: '1' | '2' | '3' | '4' | '5' | 'NA';
  activity: '1' | '2' | '3' | '4' | '5' | 'NA';
  value_time_spent: '1' | '2' | '3' | '4' | '5' | 'NA';
  overall_rating: '1' | '2' | '3' | '4' | '5' | 'NA';
  topic_clear_effective: '1' | '2' | '3' | '4' | '5' | 'NA';
  answered_questions: '1' | '2' | '3' | '4' | '5' | 'NA';
  presentation_materials: '1' | '2' | '3' | '4' | '5' | 'NA';
  session_helpful: 'Yes' | 'No';
};

export function Evaluations() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [form, setForm] = useState<EvaluationForm>({
    employee_no: '',
    employee_name: '',
    event_id: 0,
    objectives_met: 'NA',
    relevance: 'NA',
    venue: 'NA',
    activity: 'NA',
    value_time_spent: 'NA',
    overall_rating: 'NA',
    topic_clear_effective: 'NA',
    answered_questions: 'NA',
    presentation_materials: 'NA',
    session_helpful: 'No'
  });
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [showUploadResult, setShowUploadResult] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    loadEvents();
    loadEvaluations();
  }, [pagination.page, pagination.limit, search]);

  async function loadEvents() {
    try {
      const res = await api.get('/events');
      setEvents(res.data.events || []);
    } catch (e: any) {
      toast.error('Failed to load events');
    }
  }

  async function downloadTemplate() {
    try {
      toast.loading('Preparing template...', { id: 'download' });

      // ✅ Tell Axios we expect binary data (not JSON)
      const res = await api.get('/evaluations/template', {
        responseType: 'blob',
      });

      // ✅ Determine correct file type based on backend response
      const contentType = res.headers['content-type'];
      const isCsv = contentType.includes('text/csv');
      const fileName = isCsv ? 'evaluation-template.csv' : 'evaluation-template.xlsx';

      // ✅ Convert blob to downloadable link
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();

      // ✅ Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded!', { id: 'download' });
    } catch (e) {
      console.error('Download template error:', e);
      toast.error('Failed to download template', { id: 'download' });
    }
  }


  async function loadEvaluations() {
    try {
      setError(null);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search: search.toLowerCase() })
      });
      const res = await api.get(`/evaluations?${params}`);
      setEvaluations(res.data.evaluations || []);
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 0 });
    } catch (e: any) {
      setError('Failed to load evaluations');
      toast.error('Failed to load evaluations');
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
      const res = await api.post('/evaluations/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      e.target.value = '';
      setUploadResult(res.data);
      setShowUploadResult(true);
      toast.success(`Upload completed: ${res.data.inserted} evaluations added`);
      loadEvaluations();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to upload file');
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  function openModal(evaluation?: Evaluation) {
    if (evaluation) {
      setEditingEvaluation(evaluation);
      setForm({
        employee_no: evaluation.employee_no || '',
        employee_name: evaluation.employee_name,
        event_id: evaluation.event_id,
        objectives_met: evaluation.objectives_met,
        relevance: evaluation.relevance,
        venue: evaluation.venue,
        activity: evaluation.activity,
        value_time_spent: evaluation.value_time_spent,
        overall_rating: evaluation.overall_rating,
        topic_clear_effective: evaluation.topic_clear_effective,
        answered_questions: evaluation.answered_questions,
        presentation_materials: evaluation.presentation_materials,
        session_helpful: evaluation.session_helpful
      });
    } else {
      setEditingEvaluation(null);
      setForm({
        employee_no: '',
        employee_name: '',
        event_id: 0,
        objectives_met: 'NA',
        relevance: 'NA',
        venue: 'NA',
        activity: 'NA',
        value_time_spent: 'NA',
        overall_rating: 'NA',
        topic_clear_effective: 'NA',
        answered_questions: 'NA',
        presentation_materials: 'NA',
        session_helpful: 'No'
      });
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingEvaluation(null);
    setForm({
      employee_no: '',
      employee_name: '',
      event_id: 0,
      objectives_met: 'NA',
      relevance: 'NA',
      venue: 'NA',
      activity: 'NA',
      value_time_spent: 'NA',
      overall_rating: 'NA',
      topic_clear_effective: 'NA',
      answered_questions: 'NA',
      presentation_materials: 'NA',
      session_helpful: 'No'
    });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_name.trim() || form.event_id === 0) {
      toast.error('Employee Name and Event are required');
      return;
    }
    try {
      setError(null);
      const payload = { ...form, employee_no: form.employee_no.trim() || null };
      if (editingEvaluation) {
        await api.put(`/evaluations/${editingEvaluation.evaluation_id}`, payload);
        toast.success('Evaluation updated successfully');
      } else {
        await api.post('/evaluations', payload);
        toast.success('Evaluation added successfully');
      }
      closeModal();
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

  function computeAvgRating(evaluation: Evaluation): number {
    const ratings = [
      evaluation.objectives_met, evaluation.relevance, evaluation.venue,
      evaluation.activity, evaluation.value_time_spent, evaluation.overall_rating,
      evaluation.topic_clear_effective, evaluation.answered_questions, evaluation.presentation_materials
    ].map(r => r === 'NA' ? null : parseInt(r));
    const validRatings = ratings.filter(r => r !== null);
    return validRatings.length > 0 ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length : 0;
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
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-lg p-6 max-w-md w-full max-h-[70vh] overflow-y-auto"
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
              <p className="text-green-600 font-medium">✅ {result.inserted} evaluations added successfully</p>
              {result.skipped && result.skipped > 0 && (
                <>
                  <p className="text-yellow-600 font-medium flex items-center gap-1">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    {result.skipped} evaluations skipped (duplicates/errors)
                  </p>
                  {result.skip_details && result.skip_details.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-gray-700 bg-yellow-50 p-3 rounded-md">
                      {result.skip_details.map((detail, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          • {detail.reason} {detail.employee_name && `(Employee: ${detail.employee_name})`}
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
        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} evaluations
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
        <h2 className="text-2xl font-bold text-gray-900">Evaluations Management</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search evaluations..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagination({ ...pagination, page: 1 }); }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 text-sm transition-colors"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors shadow-sm"
            disabled={loading}
            title="Add Evaluation"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium mb-3 text-gray-900">Import Evaluations</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Upload Evaluations.csv or .xlsx:</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={upload}
            disabled={loading}
            className="border border-gray-300 p-2 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 text-sm"
          />
        {/* ✅ Download Template Button */}
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          <DownloadIcon className="w-4 h-4" />
          Download Template
        </button>
          {loading && <span className="text-sm text-blue-600">Uploading...</span>}
        </div>
      </div>

      {/* Evaluations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Helpful?</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {evaluations.map((evaluation, idx) => {
                const avgRating = computeAvgRating(evaluation);
                return (
                  <tr key={evaluation.evaluation_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {evaluation.employee_no || 'Walk-in'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{evaluation.employee_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{evaluation.event.event_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{avgRating.toFixed(1)}/5</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        evaluation.session_helpful === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {evaluation.session_helpful}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => openModal(evaluation)}
                        className="text-blue-600 hover:text-blue-500 p-1 rounded transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this evaluation?')) {
                            await api.delete(`/evaluations/${evaluation.evaluation_id}`);
                            loadEvaluations();
                            toast.success('Evaluation deleted');
                          }
                        }}
                        className="text-red-600 hover:text-red-500 p-1 rounded transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {evaluations.length === 0 && !loading && (
        <p className="text-center text-gray-500 py-8 text-lg">No evaluations yet. Add one to get started—it's quick and easy!</p>
      )}
      {pagination.total > 0 && <PaginationControls />}

      {/* Add/Edit Evaluation Modal */}
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
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingEvaluation ? 'Edit Evaluation' : 'Add New Evaluation'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <ErrorAlert />

              <form onSubmit={submit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee No (Optional)</label>
                    <input
                      type="text"
                      value={form.employee_no}
                      onChange={(e) => setForm({ ...form, employee_no: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., EMP001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name *</label>
                    <input
                      type="text"
                      value={form.employee_name}
                      onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., John Doe"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event *</label>
                    <select
                      value={form.event_id}
                      onChange={(e) => setForm({ ...form, event_id: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value={0}>Select an Event</option>
                      {events.map((event) => (
                        <option key={event.event_id} value={event.event_id}>{event.event_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Overall Conduct Section */}
                <div className="space-y-2">
                  <h4 className="text-md font-medium text-gray-900">Overall Conduct of Activity</h4>
                  {[
                    { key: 'objectives_met', label: 'Objectives were met' },
                    { key: 'relevance', label: 'Relevance' },
                    { key: 'venue', label: 'Venue' },
                    { key: 'activity', label: 'Activity' },
                    { key: 'value_time_spent', label: 'Value of Time Spent' },
                    { key: 'overall_rating', label: 'Overall Rating' }
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 w-48">{label}</label>
                      <select
                        value={form[key as keyof EvaluationForm]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value as any })}
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {['NA', '1', '2', '3', '4', '5'].map((val) => (
                          <option key={val} value={val}>{val === 'NA' ? 'NA' : `${val} - ${['Needs Improvement', 'Fair', 'Good', 'Very Good', 'Excellent'][parseInt(val) - 1]}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Resource Speaker Section */}
                <div className="space-y-2">
                  <h4 className="text-md font-medium text-gray-900">Resource Speaker</h4>
                  {[
                    { key: 'topic_clear_effective', label: 'Discussed topic clearly and effectively' },
                    { key: 'answered_questions', label: 'Answered questions appropriately' },
                    { key: 'presentation_materials', label: 'Presentation/materials' }
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 w-48">{label}</label>
                      <select
                        value={form[key as keyof EvaluationForm]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value as any })}
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {['NA', '1', '2', '3', '4', '5'].map((val) => (
                          <option key={val} value={val}>{val === 'NA' ? 'NA' : `${val} - ${['Needs Improvement', 'Fair', 'Good', 'Very Good', 'Excellent'][parseInt(val) - 1]}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">This session was helpful</label>
                  <select
                    value={form.session_helpful}
                    onChange={(e) => setForm({ ...form, session_helpful: e.target.value as 'Yes' | 'No' })}
                    className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
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
                    {loading ? 'Saving...' : (editingEvaluation ? 'Update' : 'Add')} Evaluation
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