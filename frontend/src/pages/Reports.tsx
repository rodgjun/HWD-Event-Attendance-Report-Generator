import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function Reports() {
  const [eventId, setEventId] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [overall, setOverall] = useState<any>(null);

  async function load() {
    if (eventId) {
      const s = await api.get(`/reports/event-summary/${eventId}`);
      setSummary(s.data);
    }
    const o = await api.get('/reports/overall');
    setOverall(o.data);
  }
  useEffect(() => { load(); }, [eventId]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Reports</h2>
      <div className="flex items-center gap-3">
        <input className="border p-2 rounded" placeholder="Event ID for summary" value={eventId} onChange={e => setEventId(e.target.value)} />
      </div>
      {summary && (
        <div className="bg-white border rounded p-4">
          <div className="font-medium mb-2">Event Summary</div>
          <div className="grid grid-cols-5 gap-3 text-sm">
            <div>Total: {summary.total}</div>
            <div>Virtual: {summary.virtual}</div>
            <div>Onsite: {summary.onsite}</div>
            <div>Registered: {summary.registered}</div>
            <div>Walk-ins: {summary.walkIns}</div>
          </div>
        </div>
      )}
      {overall && (
        <div className="bg-white border rounded p-4">
          <div className="font-medium mb-2">Top Departments</div>
          <ul className="list-disc pl-6 text-sm">
            {(overall.topDepartments || []).map((d: any) => (
              <li key={d.department}>{d.department}: {d.count}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


