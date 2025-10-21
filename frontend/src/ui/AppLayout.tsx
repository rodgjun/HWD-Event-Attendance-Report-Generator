import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = !!localStorage.getItem('token'); // Compute directly for real-time updates

  // In AppLayout component, wrap navbar in conditional
  const isKiosk = pathname === '/kiosk';

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const NavLink = ({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) => (
    <Link
      to={to}
      onClick={onClick}
      className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        pathname === to
          ? 'bg-blue-600 text-white'
          : 'text-gray-700 hover:bg-blue-100 hover:text-blue-700'
      }`}
      aria-current={pathname === to ? 'page' : undefined}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {!isKiosk && (
      <nav className="bg-white shadow-sm border-b border-gray-200 fixed w-full z-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo/Brand */}
            <div className="flex items-center">
              <Link to="/">
                <img src="/hwd_logo_2.png" alt="HWD Logo" className="h-8 w-auto" />
              </Link>
              <Link 
              to="/" 
              className="pl-2 text-l font-[Poppins] font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200"
            > 
              HWD 
            </Link>


            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              <NavLink to="/" label="Home" />
              <NavLink to="/events" label="Events" />
              <NavLink to="/registrations" label="Registrations" />
              <NavLink to="/attendance" label="Attendance" />
              <NavLink to="/reports" label="Reports" />
            </div>

            {/* Auth Button */}
            <div className="hidden md:flex items-center space-x-2">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  aria-label="Logout"
                >
                  Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  Login
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-700 hover:text-blue-600 p-2"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-1">
              <NavLink to="/" label="Home" onClick={() => setMobileMenuOpen(false)} />
              <NavLink to="/events" label="Events" onClick={() => setMobileMenuOpen(false)} />
              <NavLink to="/registrations" label="Registrations" onClick={() => setMobileMenuOpen(false)} />
              <NavLink to="/attendance" label="Attendance" onClick={() => setMobileMenuOpen(false)} />
              <NavLink to="/reports" label="Reports" onClick={() => setMobileMenuOpen(false)} />
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
              )}
            </div>
          )}
        </div>
      </nav>
      )}
    <main className={`mx-auto max-w-6xl p-4 ${isKiosk ? 'pt-0' : 'pt-20'}`}>
      <Outlet />
    </main>
    <Toaster position="top-right" containerStyle={{ zIndex: 9999 }} />  {/* Global, high z-index for kiosk fullscreen */}
    </div>
  );
}