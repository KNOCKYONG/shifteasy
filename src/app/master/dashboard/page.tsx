'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Database,
  Users,
  Building2,
  Calendar,
  LogOut,
  RefreshCw,
  Filter,
  Download,
  Shield
} from 'lucide-react';

type TableType = 'tenants' | 'users' | 'departments' | 'schedules';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Department {
  id: string;
  name: string;
  tenantId: string;
}

export default function MasterDashboardPage() {
  const router = useRouter();
  const [selectedTable, setSelectedTable] = useState<TableType>('tenants');
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  // Check authentication
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('master_admin_authenticated');
    if (isAuthenticated !== 'true') {
      router.replace('/master');
    }
  }, [router]);

  // Load tenants on mount
  useEffect(() => {
    loadTenants();
  }, []);

  // Load departments when tenant is selected
  useEffect(() => {
    if (selectedTenant) {
      loadDepartments(selectedTenant);
    } else {
      setDepartments([]);
      setSelectedDepartment('');
    }
  }, [selectedTenant]);

  const loadTenants = async () => {
    try {
      const response = await fetch('/api/master/data?table=tenants', {
        headers: { 'x-master-auth': 'authenticated' },
      });
      const result = await response.json();
      if (result.data) {
        setTenants(result.data);
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
    }
  };

  const loadDepartments = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/master/data?table=departments&tenantId=${tenantId}`, {
        headers: { 'x-master-auth': 'authenticated' },
      });
      const result = await response.json();
      if (result.data) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let url = `/api/master/data?table=${selectedTable}`;

      if (selectedDepartment) {
        url += `&departmentId=${selectedDepartment}`;
      } else if (selectedTenant) {
        url += `&tenantId=${selectedTenant}`;
      }

      const response = await fetch(url, {
        headers: { 'x-master-auth': 'authenticated' },
      });

      const result = await response.json();
      if (result.data) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('master_admin_authenticated');
    router.push('/master');
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTable}-${Date.now()}.json`;
    link.click();
  };

  const tables = [
    { id: 'tenants', name: 'Tenants', icon: Building2 },
    { id: 'users', name: 'Users', icon: Users },
    { id: 'departments', name: 'Departments', icon: Building2 },
    { id: 'schedules', name: 'Schedules', icon: Calendar },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 rounded-lg">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Master Admin Dashboard</h1>
                <p className="text-sm text-gray-400">Super Administrator Panel</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Table Selection */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Select Table
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tables.map((table) => {
              const Icon = table.icon;
              return (
                <button
                  key={table.id}
                  onClick={() => {
                    setSelectedTable(table.id);
                    setData([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedTable === table.id
                      ? 'border-red-600 bg-red-600/20'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">{table.name}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tenant
              </label>
              <select
                value={selectedTenant}
                onChange={(e) => {
                  setSelectedTenant(e.target.value);
                  setData([]);
                }}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-white"
              >
                <option value="">All Tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setData([]);
                }}
                disabled={!selectedTenant}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Load Data
              </>
            )}
          </button>

          {data.length > 0 && (
            <button
              onClick={exportToJSON}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              <Download className="w-5 h-5" />
              Export JSON
            </button>
          )}
        </div>

        {/* Data Display */}
        {data.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Data ({data.length} records)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <pre className="text-xs bg-gray-900 p-4 rounded-lg overflow-auto max-h-[600px] border border-gray-700">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {!loading && data.length === 0 && (
          <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
            <Database className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">
              Select filters and click &quot;Load Data&quot; to view records
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
