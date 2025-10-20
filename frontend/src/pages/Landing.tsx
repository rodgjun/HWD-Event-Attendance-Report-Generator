import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function Landing() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate('/events');
  };

  const handleViewReports = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate('/reports');
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-100 py-20 px-4 text-center rounded-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Streamline Health & Wellness Event Management
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Effortlessly track attendance, validate registrations, and generate insightful reports for BSP's wellness programs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleGetStarted}
              className="bg-blue-600 text-white px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 w-full sm:w-auto"
              aria-label="Get started with registrations"
            >
              Get Started
            </button>
            <button
              onClick={handleViewReports}
              className="border-2 border-blue-600 text-blue-600 px-8 py-4 text-lg font-semibold rounded-lg hover:bg-blue-50 transition-colors duration-200 w-full sm:w-auto"
              aria-label="View reports"
            >
              View Reports
            </button>
          </div>
        </div>
      </section>

      {/* User Guide Section */}
      <section className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How to Use the System</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Login as Admin</h3>
            <p className="text-gray-600">Access the dashboard with your credentials to manage events and users.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Register & Track Attendance</h3>
            <p className="text-gray-600">Upload Excel files or add manual entries for seamless validation.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Generate Reports</h3>
            <p className="text-gray-600">View analytics on participation, departments, and more—export anytime.</p>
          </div>
        </div>
      </section>
    </div>
  );
}