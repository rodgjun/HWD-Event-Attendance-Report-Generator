import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', form);
      localStorage.setItem('token', res.data.token);
      navigate('/');
      window.location.reload(); // Refresh to update auth state
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div className="max-w-sm mx-auto bg-white border rounded p-6 mt-10">
      <div className="text-lg font-semibold mb-4">Admin Login</div>
      <form onSubmit={submit} className="space-y-3">
        <input className="border p-2 w-full rounded" placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        <input type="password" className="border p-2 w-full rounded" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Login</button>
      </form>
    </div>
  );
}


