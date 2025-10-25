import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

type Event = { event_id: number; event_name: string };
type Props = {
  selectedEventId: number;
  onChange: (id: number) => void;
};

export function EventFilterDropdown({ selectedEventId, onChange }: Props) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events/all')
      .then(res => setEvents(res.data.events || []))
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <select
      value={selectedEventId}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={loading}
      className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value={0}>All Events</option>
      {events.map(event => (
        <option key={event.event_id} value={event.event_id}>{event.event_name}</option>
      ))}
    </select>
  );
}