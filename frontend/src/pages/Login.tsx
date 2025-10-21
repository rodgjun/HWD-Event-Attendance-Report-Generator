import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', form);
      localStorage.setItem('token', res.data.token);
      navigate('/');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh]   bg-gray-50 flex items-center justify-center py-8 px-4 overflow-hidden">
      <div className="max-w-md w-full space-y-6 bg-white p-6 rounded-xl shadow-lg">
        {/* Logo */}
        <div className="text-center mb-4">
          <img 
            src="/hwd_logo_2.png" 
            alt="HWD Logo" 
            className="mx-auto h-16 w-auto md:h-20" 
          />
        </div>

        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your HWD admin account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm transition-all">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              autoFocus
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              aria-describedby="username-error"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              aria-describedby="password-error"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            aria-label="Sign in"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-blue-600 hover:text-blue-500 transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}