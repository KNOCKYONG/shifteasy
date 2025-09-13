'use client';

import { useState, useEffect } from 'react';

type TabType = 'reports' | 'analytics' | 'batch' | 'guide';

export default function DataProcessingTestPage() {
  const [activeTab, setActiveTab] = useState<TabType>('guide');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Report Generation State
  const [reportType, setReportType] = useState('schedule');
  const [reportFormat, setReportFormat] = useState('excel');
  const [reportAsync, setReportAsync] = useState(false);

  // Analytics State
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['attendance']);
  const [timeRangePeriod, setTimeRangePeriod] = useState('monthly');
  const [trendMetric, setTrendMetric] = useState('attendance');

  // Batch Processing State
  const [batchJobType, setBatchJobType] = useState('generate_report');
  const [batchPriority, setBatchPriority] = useState('normal');
  const [batchJobs, setBatchJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  // Fetch batch jobs
  const fetchBatchJobs = async () => {
    try {
      const res = await fetch('/api/batch/jobs');
      const data = await res.json();
      if (data.success) {
        setBatchJobs(data.jobs);
      }
    } catch (err) {
      console.error('Failed to fetch batch jobs:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'batch') {
      fetchBatchJobs();
      const interval = setInterval(fetchBatchJobs, 2000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Generate Report
  const generateReport = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-tenant',
        },
        body: JSON.stringify({
          reportType,
          format: reportFormat,
          period: {
            start: '2024-01-01',
            end: '2024-01-31',
          },
          async: reportAsync,
        }),
      });

      const data = await res.json();
      setResponse(data);

      if (data.reports?.excel?.data) {
        // Create download link for Excel
        const blob = new Blob(
          [Uint8Array.from(atob(data.reports.excel.data), c => c.charCodeAt(0))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.reports.excel.filename;
        a.click();
      }

      if (data.reports?.pdf?.data) {
        // Create download link for PDF
        const blob = new Blob(
          [Uint8Array.from(atob(data.reports.pdf.data), c => c.charCodeAt(0))],
          { type: 'application/pdf' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.reports.pdf.filename;
        a.click();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate Analytics
  const calculateAnalytics = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-tenant',
        },
        body: JSON.stringify({
          metrics: selectedMetrics,
          timeRange: {
            start: '2024-01-01',
            end: '2024-01-31',
            period: timeRangePeriod,
          },
        }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get Trends
  const getTrends = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`/api/analytics/metrics?metric=${trendMetric}&periods=6`, {
        headers: {
          'x-tenant-id': 'test-tenant',
        },
      });

      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create Batch Job
  const createBatchJob = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    const jobData: any = {
      type: batchJobType,
      priority: batchPriority,
      data: {},
    };

    // Add specific data based on job type
    switch (batchJobType) {
      case 'generate_report':
        jobData.data = {
          reportType: 'schedule',
          format: 'excel',
        };
        break;
      case 'calculate_analytics':
        jobData.data = {
          metrics: ['attendance', 'overtime'],
          timeRange: { start: '2024-01-01', end: '2024-01-31' },
        };
        break;
      case 'export_data':
        jobData.data = {
          dataType: 'employees',
          format: 'csv',
        };
        break;
      case 'bulk_update':
        jobData.data = {
          entityType: 'shifts',
          updates: Array.from({ length: 100 }, (_, i) => ({ id: i, status: 'approved' })),
        };
        break;
      case 'optimize_schedule':
        jobData.data = {
          scheduleId: 'schedule_123',
          constraints: { maxHours: 40, minRest: 8 },
        };
        break;
    }

    try {
      const res = await fetch('/api/batch/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify(jobData),
      });

      const data = await res.json();
      setResponse(data);
      if (data.success) {
        setSelectedJobId(data.jobId);
        fetchBatchJobs();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get Job Status
  const getJobStatus = async () => {
    if (!selectedJobId) {
      setError('Please select a job ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`/api/batch/status/${selectedJobId}`);
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cancel Job
  const cancelJob = async () => {
    if (!selectedJobId) {
      setError('Please select a job ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/batch/status/${selectedJobId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      setResponse(data);
      fetchBatchJobs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Data Processing & Reports Test</h1>

      {/* Tab Navigation */}
      <div className="flex space-x-4 mb-8 border-b">
        <button
          onClick={() => setActiveTab('guide')}
          className={`pb-2 px-1 ${activeTab === 'guide' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Test Guide
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-2 px-1 ${activeTab === 'reports' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Report Generation
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-2 px-1 ${activeTab === 'analytics' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Analytics
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`pb-2 px-1 ${activeTab === 'batch' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Batch Processing
        </button>
      </div>

      {/* Test Guide Tab */}
      {activeTab === 'guide' && (
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">📚 Test Guide</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Report Generation</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Select report type (Schedule, KPI, Employee, Shift Pattern)</li>
                <li>Choose format (Excel, PDF, or Both)</li>
                <li>Enable async for background processing</li>
                <li>Generated files will download automatically</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Analytics</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Select metrics to calculate (Attendance, Overtime, Coverage, etc.)</li>
                <li>Choose time period (Daily, Weekly, Monthly, etc.)</li>
                <li>View trends over time for specific metrics</li>
                <li>Results include metadata and drill-down information</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Batch Processing</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Create batch jobs with different priorities</li>
                <li>Monitor job progress in real-time</li>
                <li>Cancel pending or running jobs</li>
                <li>View job results when completed</li>
              </ul>
            </div>

            <div className="bg-yellow-100 p-3 rounded mt-4">
              <p className="text-sm">
                <strong>Note:</strong> All operations use mock data for demonstration.
                In production, these would connect to real databases and services.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Report Generation Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Generate Report</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="schedule">Schedule Report</option>
                  <option value="kpi">KPI Dashboard</option>
                  <option value="employee">Employee Summary</option>
                  <option value="shift_pattern">Shift Pattern</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Format</label>
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={reportAsync}
                  onChange={(e) => setReportAsync(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Process asynchronously</span>
              </label>
            </div>

            <button
              onClick={generateReport}
              disabled={loading}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Calculate Metrics</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Metrics</label>
                <div className="space-y-2">
                  {['attendance', 'overtime', 'coverage', 'swaps'].map((metric) => (
                    <label key={metric} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedMetrics.includes(metric)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMetrics([...selectedMetrics, metric]);
                          } else {
                            setSelectedMetrics(selectedMetrics.filter(m => m !== metric));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{metric}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Time Period</label>
                <select
                  value={timeRangePeriod}
                  onChange={(e) => setTimeRangePeriod(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <button
                onClick={calculateAnalytics}
                disabled={loading || selectedMetrics.length === 0}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Calculating...' : 'Calculate Analytics'}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Trends</h2>

            <div className="flex space-x-4">
              <select
                value={trendMetric}
                onChange={(e) => setTrendMetric(e.target.value)}
                className="flex-1 p-2 border rounded"
              >
                <option value="attendance">Attendance</option>
                <option value="overtime">Overtime</option>
                <option value="coverage">Coverage</option>
              </select>

              <button
                onClick={getTrends}
                disabled={loading}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Get Trends'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Processing Tab */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Create Batch Job</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Job Type</label>
                <select
                  value={batchJobType}
                  onChange={(e) => setBatchJobType(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="generate_report">Generate Report</option>
                  <option value="calculate_analytics">Calculate Analytics</option>
                  <option value="export_data">Export Data</option>
                  <option value="bulk_update">Bulk Update</option>
                  <option value="optimize_schedule">Optimize Schedule</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <select
                  value={batchPriority}
                  onChange={(e) => setBatchPriority(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <button
              onClick={createBatchJob}
              disabled={loading}
              className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Job Management</h2>

            <div className="flex space-x-4 mb-4">
              <input
                type="text"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                placeholder="Job ID"
                className="flex-1 p-2 border rounded"
              />
              <button
                onClick={getJobStatus}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Get Status
              </button>
              <button
                onClick={cancelJob}
                disabled={loading}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="border rounded p-4 max-h-60 overflow-auto">
              <h3 className="font-semibold mb-2">Active Jobs</h3>
              {batchJobs.length === 0 ? (
                <p className="text-gray-500">No jobs found</p>
              ) : (
                <div className="space-y-2">
                  {batchJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className="p-2 border rounded cursor-pointer hover:bg-gray-50 text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="font-mono">{job.id}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Type: {job.type} | Priority: {job.priority} | Progress: {job.progress}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Response Display */}
      {(response || error) && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2">Response:</h3>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
              {error}
            </div>
          )}
          {response && (
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}