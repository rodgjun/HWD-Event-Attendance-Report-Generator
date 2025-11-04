// src/pages/Reports.tsx

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { ChevronDownIcon, ArrowDownTrayIcon as DownloadIcon, FunnelIcon as FilterIcon } from '@heroicons/react/24/outline';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { Toaster } from 'react-hot-toast';

// Types
type FilterOptions = { event_types: string[]; departments: string[] };
type MonthlyProgress = { month: string; attendees: number }[];
type TopItem = { event_name?: string; identifier?: string; department?: string; attendees?: number; attendance_count?: number; avg_rating?: string; feedback_count?: number };
type Demographics = { age_ranges: [string, number][]; genders: [string, number][] };
type OverallData = { monthly_progress: MonthlyProgress; top_events: TopItem[]; top_employees: TopItem[]; top_departments: TopItem[]; demographics: Demographics };
type EvaluationsData = { top_conduct_events: TopItem[]; top_speaker_events: TopItem[] };
type Tab = 'attendance' | 'evaluations';

export function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [filters, setFilters] = useState({ date_from: '', date_to: '', event_type: '', department: '' });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ event_types: [], departments: [] });
  const [overallData, setOverallData] = useState<OverallData | null>(null);
  const [evaluationsData, setEvaluationsData] = useState<EvaluationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (filterOptions.event_types.length > 0) {
      loadData();
    }
  }, [filters]);

  const loadFilters = async () => {
    try {
      const res = await api.get('/reports/filters');
      setFilterOptions(res.data);
    } catch (e: any) {
      toast.error('Failed to load filters');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
        ...(filters.event_type && { event_type: filters.event_type }),
        ...(filters.department && { department: filters.department }),
      });

      const [overallRes, evalRes] = await Promise.all([
        api.get(`/reports/overall?${params}`),
        api.get(`/reports/evaluations?${params}`),
      ]);

      setOverallData(overallRes.data);
      setEvaluationsData(evalRes.data);
    } catch (e: any) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleApplyFilters = () => {
    loadData();
    setShowFilters(false);
  };

  const handleResetFilters = () => {
    setFilters({ date_from: '', date_to: '', event_type: '', department: '' });
    loadData();
  };

  const handleExport = async (type: 'overall' | 'evaluations') => {
    try {
      const params = new URLSearchParams({
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
        ...(filters.event_type && { event_type: filters.event_type }),
        ...(filters.department && { department: filters.department }),
      });
      const endpoint = type === 'overall' ? '/reports/export-overall' : '/reports/export-evaluations';
      const res = await api.get(`${endpoint}?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Toaster />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-1">Insights into attendance and evaluations.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleExport('overall')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <DownloadIcon className="w-4 h-4" />
              Export Overview
            </button>
            <button onClick={() => handleExport('evaluations')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <DownloadIcon className="w-4 h-4" />
              Export Evaluations
            </button>
          </div>
        </div>

        {/* Filters */}
        <section className="mb-8 bg-white rounded-lg shadow-sm border p-6">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-between w-full mb-4 text-left">
            <span className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <FilterIcon className="w-5 h-5" />
              Filters
            </span>
            <ChevronDownIcon className="w-5 h-5 text-gray-500" />
          </button>
          {showFilters && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                  <select value={filters.event_type} onChange={(e) => handleFilterChange('event_type', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                    <option value="">All</option>
                    {filterOptions.event_types.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select value={filters.department} onChange={(e) => handleFilterChange('department', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                    <option value="">All</option>
                    {filterOptions.departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input type="date" value={filters.date_from} onChange={(e) => handleFilterChange('date_from', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input type="date" value={filters.date_to} onChange={(e) => handleFilterChange('date_to', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button onClick={handleApplyFilters} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Apply</button>
                <button onClick={handleResetFilters} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">Reset</button>
              </div>
            </div>
          )}
        </section>

        {/* Tabs */}
        <section className="mb-8">
          <div className="flex border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`py-4 px-1 text-sm font-medium border-b-2 ${activeTab === 'attendance' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Attendance
              </button>
              <button
                onClick={() => setActiveTab('evaluations')}
                className={`py-4 px-1 text-sm font-medium border-b-2 ${activeTab === 'evaluations' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Evaluations
              </button>
            </nav>
          </div>
        </section>

        {/* Content */}
        <section className="space-y-6">
          {activeTab === 'attendance' && overallData && (
            <>
              {/* Monthly Progress */}
              <section className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Engagement</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overallData.monthly_progress}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="attendees" stroke="#3B82F6" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Top Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Events</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overallData.top_events}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="event_name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="attendees">
                          {overallData.top_events.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Departments</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overallData.top_departments}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="attendees">
                          {overallData.top_departments.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              {/* Demographics */}
              <section className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Demographics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={overallData.demographics.age_ranges.map(([name, value]) => ({ name, value }))} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={80} 
                          fill="#8884d8"
                        >
                          {overallData.demographics.age_ranges.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={overallData.demographics.genders.map(([name, value]) => ({ name, value }))} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={80} 
                          fill="#8884d8"
                        >
                          {overallData.demographics.genders.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'evaluations' && evaluationsData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 3 Conduct Ratings</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evaluationsData.top_conduct_events}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="event_name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg_rating">
                        {evaluationsData.top_conduct_events.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 3 Speaker Ratings</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evaluationsData.top_speaker_events}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="event_name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg_rating">
                        {evaluationsData.top_speaker_events.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 mt-12 pt-8 border-t border-gray-200">
          <p>Generated on {new Date().toLocaleDateString()}</p>
        </footer>
      </div>
    </div>
  );
}