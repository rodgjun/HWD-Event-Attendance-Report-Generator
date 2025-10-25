import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

type EventOption = { event_id: number; event_name: string };
type DepartmentOption = string;

export function Kiosk() {
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
  type ModeOfAttendance = 'Onsite' | 'Virtual';
  const [form, setForm] = useState<{ employee_no: string; employee_name: string; department: string; mode_of_attendance: ModeOfAttendance }>({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadEvents();
    loadDepartments();
    // Fullscreen on mount
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
    // Exit on Esc
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') exitKiosk(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

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
      const res = await api.get('employees/departments');
      setDepartments(res.data);
    } catch (e: any) {
      toast.error('Failed to load departments');
    }
  }

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!selectedEvent) {
      toast.error('Select an event');
      return;
    }
    setLoading(true);
    const payload = {
      ...form,
      employee_no: form.employee_no.trim() === '' ? '' : form.employee_no.trim(),
      employee_name: form.employee_name.trim(),
      department: form.department.trim() || null,
      event_name: selectedEvent.event_name
    };
    try {
      await api.post('/attendance', payload);
      setSubmitted(true);
      toast.success(`Thank you! Your attendance for ${selectedEvent.event_name} has been recorded.`);
      setTimeout(() => {
        setForm({ employee_no: '', employee_name: '', department: '', mode_of_attendance: 'Onsite' });
        setSubmitted(false);
      }, 3000);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  function exitKiosk() {
    if (document.exitFullscreen) document.exitFullscreen();
    navigate('/attendance');
  }

  const fadeIn = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
      {/* Exit Button */}
      <motion.button
        onClick={exitKiosk}
        className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-full shadow-lg"
        whileHover={{ scale: 1.1 }}
        aria-label="Exit Kiosk Mode"
      >
        ✕
      </motion.button>

      <AnimatePresence mode="wait">
        {!selectedEvent ? (
          <motion.div key="select" initial="hidden" animate="visible" exit="hidden" variants={fadeIn} className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Select Event for Kiosk</h1>
            <select
              onChange={e => setSelectedEvent(events.find(ev => ev.event_name === e.target.value) || null)}
              className="border p-3 rounded-lg text-lg bg-white shadow-md"
            >
              <option value="">Choose an event...</option>
              {events.map(ev => <option key={ev.event_id} value={ev.event_name}>{ev.event_name}</option>)}
            </select>
          </motion.div>
        ) : submitted ? (
          <motion.div key="success" initial="hidden" animate="visible" exit="hidden" variants={fadeIn} className="text-center">
            <h1 className="text-4xl font-bold text-green-600 mb-4">✅ Thank You!</h1>
            <p className="text-xl text-gray-600">Your attendance for {selectedEvent.event_name} has been recorded.</p>
          </motion.div>
        ) : (
          <motion.form key="form" initial="hidden" animate="visible" exit="hidden" variants={fadeIn} onSubmit={submit} className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full space-y-6">
            <h1 className="text-2xl font-bold text-center text-gray-900">{selectedEvent.event_name} Attendance Kiosk</h1>
            <input className="w-full p-3 border rounded-lg" placeholder="Employee No (optional)" value={form.employee_no} onChange={handleEmployeeNoChange} />
            <input className="w-full p-3 border rounded-lg" placeholder="Name *" value={form.employee_name} onChange={e => setForm({ ...form, employee_name: e.target.value })} required />
            <input 
              className="w-full p-3 border rounded-lg" 
              placeholder="Department" 
              list="departments-list" 
              value={form.department} 
              onChange={e => setForm({ ...form, department: e.target.value })} 
            />
            <datalist id="departments-list">
              {departments.map(dept => <option key={dept} value={dept} />)}
            </datalist>
            <div className="flex gap-4">
              <button type="button" onClick={() => setForm({ ...form, mode_of_attendance: 'Onsite' })} className={`flex-1 p-3 rounded-lg font-semibold ${form.mode_of_attendance === 'Onsite' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Onsite</button>
              <button type="button" onClick={() => setForm({ ...form, mode_of_attendance: 'Virtual' })} className={`flex-1 p-3 rounded-lg font-semibold ${form.mode_of_attendance === 'Virtual' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Virtual</button>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Attendance'}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}