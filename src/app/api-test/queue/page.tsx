'use client';

import React, { useState, useEffect } from 'react';
import {
  PlayCircle,
  PauseCircle,
  RefreshCw,
  Trash2,
  Send,
  FileUp,
  FileDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function QueueTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedQueue, setSelectedQueue] = useState('email-queue');
  const [selectedStatus, setSelectedStatus] = useState('waiting');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch queue statistics
  const fetchQueueStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/queue');
      const data = await response.json();
      if (data.success) {
        setQueueStats(data);
      }
    } catch (err) {
      setError('Failed to fetch queue statistics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch jobs by status
  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/queue?queue=${selectedQueue}&status=${selectedStatus}`);
      const data = await response.json();
      if (data.success) {
        setJobs(data.jobs || []);
      }
    } catch (err) {
      setError('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedQueue && selectedStatus) {
      fetchJobs();
    }
  }, [selectedQueue, selectedStatus]);

  // Add job
  const addJob = async (queue: string, jobData: any) => {
    try {
      setLoading(true);
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue,
          data: jobData,
          options: { priority: 3 }
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Job added: ${data.job.jobId}`);
        fetchQueueStats();
        fetchJobs();
      } else {
        setError(data.error || 'Failed to add job');
      }
    } catch (err) {
      setError('Failed to add job');
    } finally {
      setLoading(false);
    }
  };

  // Queue control
  const controlQueue = async (queue: string, action: 'pause' | 'resume') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/queue?action=${action}&queue=${queue}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        fetchQueueStats();
      } else {
        setError(data.error || `Failed to ${action} queue`);
      }
    } catch (err) {
      setError(`Failed to ${action} queue`);
    } finally {
      setLoading(false);
    }
  };

  // Clear queue
  const clearQueue = async (queue: string, type: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/queue?queue=${queue}&type=${type}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        fetchQueueStats();
        fetchJobs();
      } else {
        setError(data.error || 'Failed to clear queue');
      }
    } catch (err) {
      setError('Failed to clear queue');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="inline-block h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="inline-block h-4 w-4 text-red-500" />;
      case 'active':
        return <Loader2 className="inline-block h-4 w-4 text-blue-500 animate-spin" />;
      case 'delayed':
        return <Clock className="inline-block h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="inline-block h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
        Queue System Test Interface
      </h1>

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '10px', backgroundColor: '#efe', color: '#060', borderRadius: '4px', marginBottom: '20px' }}>
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #e0e0e0', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid #007bff' : 'none',
            color: activeTab === 'overview' ? '#007bff' : '#666',
            cursor: 'pointer'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('add-job')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'add-job' ? '2px solid #007bff' : 'none',
            color: activeTab === 'add-job' ? '#007bff' : '#666',
            cursor: 'pointer'
          }}
        >
          Add Job
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'jobs' ? '2px solid #007bff' : 'none',
            color: activeTab === 'jobs' ? '#007bff' : '#666',
            cursor: 'pointer'
          }}
        >
          Jobs
        </button>
        <button
          onClick={() => setActiveTab('control')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'control' ? '2px solid #007bff' : 'none',
            color: activeTab === 'control' ? '#007bff' : '#666',
            cursor: 'pointer'
          }}
        >
          Queue Control
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Queue System Health</h2>

          {queueStats?.health && (
            <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '20px' }}>
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: queueStats.health.isHealthy ? '#28a745' : '#dc3545',
                color: 'white',
                fontSize: '12px'
              }}>
                {queueStats.health.isHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
              <span style={{ marginLeft: '10px', color: '#666' }}>
                Redis: {queueStats.health.redisConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
            {queueStats?.queues?.map((queue: any) => (
              <div key={queue.name} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <strong>{queue.name}</strong>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    backgroundColor: queue.status.paused ? '#ffc107' : '#28a745',
                    color: 'white',
                    fontSize: '11px'
                  }}>
                    {queue.status.paused ? 'Paused' : 'Active'}
                  </span>
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                  <div>Waiting: <strong>{queue.counts.waiting}</strong></div>
                  <div>Active: <strong style={{ color: '#007bff' }}>{queue.counts.active}</strong></div>
                  <div>Completed: <strong style={{ color: '#28a745' }}>{queue.counts.completed}</strong></div>
                  <div>Failed: <strong style={{ color: '#dc3545' }}>{queue.counts.failed}</strong></div>
                  <div>Delayed: <strong style={{ color: '#ffc107' }}>{queue.counts.delayed}</strong></div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={fetchQueueStats}
            disabled={loading}
            style={{
              marginTop: '20px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            <RefreshCw className="inline-block h-4 w-4 mr-2" />
            Refresh Stats
          </button>
        </div>
      )}

      {/* Add Job Tab */}
      {activeTab === 'add-job' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Add Test Jobs</h2>

          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>Quick Add Jobs</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={() => addJob('email-queue', {
                to: 'test@example.com',
                subject: 'Test Email',
                html: '<p>This is a test email</p>'
              })}
              disabled={loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <Send className="inline-block h-4 w-4 mr-2" />
              Email Job
            </button>

            <button
              onClick={() => addJob('report-queue', {
                tenantId: 'test-tenant',
                reportType: 'schedule',
                format: 'pdf',
                dateRange: {
                  start: new Date().toISOString(),
                  end: new Date().toISOString()
                }
              })}
              disabled={loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <FileDown className="inline-block h-4 w-4 mr-2" />
              Report Job
            </button>

            <button
              onClick={() => addJob('schedule-queue', {
                tenantId: 'test-tenant',
                action: 'generate',
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear()
              })}
              disabled={loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <Clock className="inline-block h-4 w-4 mr-2" />
              Schedule Job
            </button>

            <button
              onClick={() => addJob('notification-queue', {
                tenantId: 'test-tenant',
                type: 'push',
                recipients: ['user1', 'user2'],
                title: 'Test Notification',
                message: 'This is a test notification'
              })}
              disabled={loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <AlertCircle className="inline-block h-4 w-4 mr-2" />
              Notification
            </button>
          </div>

          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>Bulk Add Jobs</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                for (let i = 0; i < 10; i++) {
                  addJob('email-queue', {
                    to: `test${i}@example.com`,
                    subject: `Test Email ${i}`,
                    html: `<p>Test email number ${i}</p>`
                  });
                }
              }}
              disabled={loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              Add 10 Email Jobs
            </button>

            <button
              onClick={() => {
                for (let i = 0; i < 5; i++) {
                  addJob('report-queue', {
                    tenantId: 'test-tenant',
                    reportType: ['schedule', 'kpi', 'employee'][i % 3],
                    format: ['pdf', 'excel'][i % 2],
                    dateRange: {
                      start: new Date().toISOString(),
                      end: new Date().toISOString()
                    }
                  });
                }
              }}
              disabled={loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              Add 5 Report Jobs
            </button>
          </div>
        </div>
      )}

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Job Management</h2>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <select
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            >
              <option value="email-queue">Email Queue</option>
              <option value="report-queue">Report Queue</option>
              <option value="schedule-queue">Schedule Queue</option>
              <option value="notification-queue">Notification Queue</option>
              <option value="analytics-queue">Analytics Queue</option>
              <option value="backup-queue">Backup Queue</option>
              <option value="import-queue">Import Queue</option>
              <option value="export-queue">Export Queue</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            >
              <option value="waiting">Waiting</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="delayed">Delayed</option>
            </select>

            <button
              onClick={fetchJobs}
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <RefreshCw className="inline-block h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>

          <div>
            {jobs.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No jobs found</p>
            ) : (
              jobs.map((job) => (
                <div key={job.jobId} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {getStatusIcon(job.status)}
                      <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>Job #{job.jobId}</span>
                      <span style={{
                        marginLeft: '10px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: '#f0f0f0',
                        fontSize: '12px'
                      }}>
                        {job.status}
                      </span>
                      {job.progress !== undefined && (
                        <span style={{ marginLeft: '10px', color: '#666', fontSize: '14px' }}>
                          Progress: {job.progress}%
                        </span>
                      )}
                      {job.error && (
                        <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
                          Error: {job.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Queue Control Tab */}
      {activeTab === 'control' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Queue Control</h2>

          <div>
            {queueStats?.queues?.map((queue: any) => (
              <div key={queue.name} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong>{queue.name}</strong>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    backgroundColor: queue.status.paused ? '#ffc107' : '#28a745',
                    color: 'white',
                    fontSize: '11px'
                  }}>
                    {queue.status.paused ? 'Paused' : 'Active'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => controlQueue(queue.name, queue.status.paused ? 'resume' : 'pause')}
                    disabled={loading}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: queue.status.paused ? '#28a745' : '#ffc107',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      fontSize: '14px'
                    }}
                  >
                    {queue.status.paused ? (
                      <>
                        <PlayCircle className="inline-block h-4 w-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <PauseCircle className="inline-block h-4 w-4 mr-2" />
                        Pause
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => clearQueue(queue.name, 'completed')}
                    disabled={loading}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      fontSize: '14px'
                    }}
                  >
                    Clear Completed
                  </button>
                  <button
                    onClick={() => clearQueue(queue.name, 'failed')}
                    disabled={loading}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      fontSize: '14px'
                    }}
                  >
                    Clear Failed
                  </button>
                  <button
                    onClick={() => clearQueue(queue.name, 'all')}
                    disabled={loading}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      fontSize: '14px'
                    }}
                  >
                    <Trash2 className="inline-block h-4 w-4 mr-2" />
                    Clear All
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}