import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView, MotionProps } from 'framer-motion';
import {
  LockClosedIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  ArrowRightIcon,
  ArrowDownTrayIcon as DownloadIcon,
} from '@heroicons/react/24/outline';

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
    navigate('/registrations');
  };

  const handleViewReports = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate('/reports');
  };

  // Memoized variants for stability on re-renders
  const fadeInUp: MotionProps['variants'] = useMemo(
    () => ({
      hidden: { opacity: 0, y: 30 },
      visible: { 
        opacity: 1, 
        y: 0, 
        transition: { duration: 0.6, ease: 'easeOut' } 
      },
    }),
    []
  );

  // Refs for in-view detection
  const heroRef = useRef(null);
  const guideRef = useRef(null);
  const templateRef = useRef(null);
  const inViewHero = useInView(heroRef, { once: true, margin: '-100px' });
  const inViewGuide = useInView(guideRef, { once: true, margin: '-100px' });
  const inViewTemplate = useInView(templateRef, { once: true, margin: '-100px' });

  const handleDownload = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/${filename}`;
    link.download = filename;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <motion.section
      ref={heroRef}
      initial="hidden"
      animate={inViewHero ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className="min-h-[80vh] flex flex-col justify-center items-center px-4 text-center bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 rounded-b-3xl"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          Streamline Health & Wellness
          <br />
          Event Management
        </h1>
        <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
          Effortlessly track attendance, validate registrations, and generate insightful reports for BSP's wellness programs.
        </p>

        {/* Image stays in the same position */}
        <div className="mt-6 mb-6">
          <img
            src="/health-landing.jpg"
            alt="Wellness tracking illustration"
            className="w-[400px] h-[200px] mx-auto rounded-2xl shadow-lg object-cover"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={handleGetStarted}
            className="bg-white text-blue-700 px-8 py-3 text-lg font-semibold rounded-full shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
            aria-label="Get started with registrations"
          >
            Get Started
            <ArrowRightIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleViewReports}
            className="border-2 border-white text-white px-8 py-3 text-lg font-semibold rounded-full hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
            aria-label="View reports"
          >
            View Reports
            <ChartBarIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.section>


      {/* User Guide Section */}
      <motion.section
        ref={guideRef}
        initial="hidden"
        animate={inViewGuide ? 'visible' : 'hidden'}
        variants={fadeInUp}
        className="max-w-6xl mx-auto py-20"
      >
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">How to Use the System</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: LockClosedIcon,
              number: '1',
              title: 'Login as Admin',
              desc: 'Access the dashboard with your credentials to manage events and users.',
            },
            {
              icon: ClipboardDocumentCheckIcon,
              number: '2',
              title: 'Register & Track Attendance',
              desc: 'Upload Excel files or add manual entries for seamless validation.',
            },
            {
              icon: ChartBarIcon,
              number: '3',
              title: 'Generate Reports',
              desc: 'View analytics on participation, departments, and more—export anytime.',
            },
          ].map((step, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.02, backgroundColor: '#dbeafe' }}
              className="bg-white p-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <step.icon className="w-8 h-8 text-white" />
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto text-blue-600 font-bold text-xl">
                {step.number}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-600">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Excel Templates Guide Section */}
      <motion.section
        ref={templateRef}
        initial="hidden"
        animate={inViewTemplate ? 'visible' : 'hidden'}
        variants={fadeInUp}
        className="max-w-6xl mx-auto py-20"
      >
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-8">Excel Templates Guide</h2>
        <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
          Use these CSV/Excel formats for bulk uploads. Event Name is used for matching events.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: 'Events.csv',
              desc: 'Define new events with type, name, and date.',
              headers: ['Event Type', 'Event Name', 'Event Date'],
              sample: ['Wellness Session', 'Yoga Workshop', '2025-10-25'],
              filename: 'events-template.csv',
            },
            {
              title: 'Registrations.csv',
              desc: 'Register participants by employee details and event.',
              headers: ['Employee No', 'Employee Name', 'Department', 'Event Name'],
              sample: ['EMP001', 'John Doe', 'HR', 'Yoga Workshop'],
              filename: 'registrations-template.csv',
            },
            {
              title: 'Attendance.csv',
              desc: 'Record attendance with mode and event details.',
              headers: ['Employee No', 'Employee Name', 'Department', 'Mode', 'Event Name'],
              sample: ['EMP001', 'John Doe', 'HR', 'Onsite', 'Yoga Workshop'],
              filename: 'attendance-template.csv',
            },
          ].map((template, index) => (
            <div key={index} className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="text-xl font-semibold mb-3 text-blue-600 flex items-center justify-between">
                {template.title}
                <button
                  onClick={() => handleDownload(template.filename)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  aria-label={`Download ${template.title}`}
                >
                  Download <DownloadIcon className="w-4 h-4" />
                </button>
              </h3>
              <p className="text-sm text-gray-600 mb-4">{template.desc}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700">
                  <thead className="bg-blue-50">
                    <tr>
                      {template.headers.map((header, hIndex) => (
                        <th key={hIndex} className="px-3 py-2 text-left font-medium text-blue-700">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-gray-50">
                      {template.sample.map((cell, cIndex) => (
                        <td key={cIndex} className="px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}