import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function AppLayout() {
  const { pathname } = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const NavLink = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium ${
        pathname === to ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-100'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-full">
      <nav className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-semibold">HWD Attendance</div>
            <div className="flex gap-2">
              <NavLink to="/" label="Home" />
              <NavLink to="/events" label="Events" />
              <NavLink to="/registrations" label="Registrations" />
              <NavLink to="/attendance" label="Attendance" />
              <NavLink to="/reports" label="Reports" />
            </div>
          </div>
          <div className="flex gap-2">
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-md text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Logout
              </button>
            ) : (
              <Link
                to="/login"
                className="px-3 py-2 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}


