"use client";
import { useState } from "react";
import { Calendar, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ApiTestPage() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'swap'>('schedule');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSwapId, setCreatedSwapId] = useState<string | null>(null);

  // Sample data for testing - use fixed dates to avoid hydration errors
  const baseDate = "2025-01-13T09:00:00.000Z";
  const endDate = "2025-01-20T09:00:00.000Z";
  const swapDate = "2025-01-15T09:00:00.000Z";

  const sampleScheduleRequest = {
    departmentId: "dept-er",
    startDate: baseDate,
    endDate: endDate,
    employees: [
      {
        id: "emp-1",
        name: "김철수",
        departmentId: "dept-er",
        role: "nurse",
        contractType: "full-time",
        maxHoursPerWeek: 40,
        minHoursPerWeek: 36,
        skills: ["emergency", "critical-care"],
        preferences: {
          preferredShifts: ["day"],
          avoidShifts: ["night"],
          preferredDaysOff: [0, 6],
          maxConsecutiveDays: 5,
          preferNightShift: false
        },
        availability: {
          availableDays: [true, true, true, true, true, false, false],
          unavailableDates: [],
          timeOffRequests: []
        }
      },
      {
        id: "emp-2",
        name: "이영희",
        departmentId: "dept-er",
        role: "nurse",
        contractType: "full-time",
        maxHoursPerWeek: 40,
        minHoursPerWeek: 36,
        skills: ["emergency"],
        preferences: {
          preferredShifts: ["evening"],
          avoidShifts: [],
          preferredDaysOff: [0],
          maxConsecutiveDays: 6,
          preferNightShift: false
        },
        availability: {
          availableDays: [true, true, true, true, true, true, false],
          unavailableDates: [],
          timeOffRequests: []
        }
      }
    ],
    shifts: [
      {
        id: "shift-day",
        type: "day",
        name: "주간",
        time: { start: "07:00", end: "15:00", hours: 8 },
        color: "#3B82F6",
        requiredStaff: 2,
        minStaff: 1,
        maxStaff: 3
      },
      {
        id: "shift-evening",
        type: "evening",
        name: "저녁",
        time: { start: "15:00", end: "23:00", hours: 8 },
        color: "#8B5CF6",
        requiredStaff: 2,
        minStaff: 1,
        maxStaff: 3
      }
    ],
    constraints: [
      {
        id: "legal-max-hours",
        name: "최대 근무시간",
        type: "hard",
        category: "legal",
        weight: 1.0,
        active: true
      }
    ],
    optimizationGoal: "balanced"
  };

  const sampleSwapRequest = {
    requesterId: "emp-1",
    targetEmployeeId: "emp-2",
    originalAssignment: {
      employeeId: "emp-1",
      shiftId: "shift-day",
      date: swapDate,
      isLocked: false
    },
    targetAssignment: {
      employeeId: "emp-2",
      shiftId: "shift-evening",
      date: swapDate,
      isLocked: false
    },
    reason: "개인 사정으로 인한 시프트 교환 요청"
  };

  const callApi = async (endpoint: string, method: string, body?: any) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'test-user',
          'x-user-role': 'admin'
        }
      };

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(endpoint, options);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'API call failed');
      }

      setResponse(data);

      // Save swap request ID if created
      if (endpoint === '/api/swap/request' && data.swapRequest?.id) {
        setCreatedSwapId(data.swapRequest.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const scheduleTests = [
    {
      name: "1. Generate Schedule",
      endpoint: "/api/schedule/generate",
      method: "POST",
      body: sampleScheduleRequest,
      description: "AI 기반 스케줄 생성"
    },
    {
      name: "2. Validate Schedule",
      endpoint: "/api/schedule/validate",
      method: "POST",
      body: {
        schedule: {
          departmentId: "dept-er",
          startDate: baseDate,
          endDate: endDate,
          assignments: [
            {
              employeeId: "emp-1",
              shiftId: "shift-day",
              date: baseDate,
              isLocked: false
            }
          ]
        },
        employees: sampleScheduleRequest.employees,
        shifts: sampleScheduleRequest.shifts,
        constraints: sampleScheduleRequest.constraints
      },
      description: "스케줄 제약조건 검증"
    },
    {
      name: "3. Optimize Schedule",
      endpoint: "/api/schedule/optimize",
      method: "POST",
      body: {
        schedule: {
          departmentId: "dept-er",
          startDate: baseDate,
          endDate: endDate,
          assignments: [
            {
              employeeId: "emp-1",
              shiftId: "shift-day",
              date: baseDate,
              isLocked: false
            }
          ]
        },
        employees: sampleScheduleRequest.employees,
        shifts: sampleScheduleRequest.shifts,
        constraints: sampleScheduleRequest.constraints,
        optimizationGoal: "fairness",
        options: {
          maxIterations: 100,
          targetScore: 90,
          preserveLockedAssignments: true
        }
      },
      description: "스케줄 최적화"
    },
    {
      name: "4. Confirm Schedule",
      endpoint: "/api/schedule/confirm",
      method: "POST",
      body: {
        scheduleId: "test-schedule-001",
        schedule: {
          departmentId: "dept-er",
          startDate: baseDate,
          endDate: endDate,
          assignments: [
            {
              employeeId: "emp-1",
              shiftId: "shift-day",
              date: baseDate,
              isLocked: false
            }
          ]
        },
        validationScore: 95,
        approverNotes: "테스트 승인",
        notifyEmployees: true
      },
      description: "스케줄 확정 및 발행"
    }
  ];

  const swapTests = [
    {
      name: "1. Create Swap Request",
      endpoint: "/api/swap/request",
      method: "POST",
      body: sampleSwapRequest,
      description: "시프트 교환 요청 생성"
    },
    {
      name: "2. Get Pending Swap Requests",
      endpoint: "/api/swap/request?employeeId=emp-1&status=pending",
      method: "GET",
      body: null,
      description: "대기 중인 스왑 요청 목록 조회 (승인/거절 전)"
    },
    {
      name: "3. Get All Swap Requests",
      endpoint: "/api/swap/request?employeeId=emp-1",
      method: "GET",
      body: null,
      description: "모든 스왑 요청 목록 조회 (승인/거절 포함)"
    },
    {
      name: "4. Approve Swap",
      endpoint: "/api/swap/approve",
      method: "POST",
      body: {
        swapRequestId: createdSwapId || "swap-test-001",
        action: "approve",
        comments: "승인합니다",
        validateConstraints: false // Set to false to avoid validation errors with mock data
      },
      description: createdSwapId ? `스왑 요청 승인 (ID: ${createdSwapId})` : "스왑 요청 승인 (먼저 Create를 실행하세요)"
    },
    {
      name: "5. Reject Swap",
      endpoint: "/api/swap/approve",
      method: "POST",
      body: {
        swapRequestId: createdSwapId || "swap-test-002",
        action: "reject",
        comments: "인력 부족으로 거절",
        validateConstraints: false
      },
      description: createdSwapId ? `스왑 요청 거절 (ID: ${createdSwapId})` : "스왑 요청 거절 (먼저 Create를 실행하세요)"
    }
  ];

  const currentTests = activeTab === 'schedule' ? scheduleTests : swapTests;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <a href="/dashboard" className="text-xl font-semibold text-gray-900">
                ShiftEasy API Test
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'schedule'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Calendar className="inline-block w-4 h-4 mr-2" />
            Schedule APIs
          </button>
          <button
            onClick={() => setActiveTab('swap')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'swap'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Send className="inline-block w-4 h-4 mr-2" />
            Swap APIs
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Buttons */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {activeTab === 'schedule' ? 'Schedule API Tests' : 'Swap API Tests'}
            </h2>

            {currentTests.map((test, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{test.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{test.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        test.method === 'POST' ? 'bg-green-100 text-green-800' :
                        test.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {test.method}
                      </span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {test.endpoint}
                      </code>
                    </div>
                  </div>
                  <button
                    onClick={() => callApi(test.endpoint, test.method, test.body)}
                    disabled={loading}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Test'
                    )}
                  </button>
                </div>

                {test.body && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                      View Request Body
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(test.body, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>

          {/* Response Display */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Response</h2>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            )}

            {response && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Success</span>
                </div>
                <pre className="text-xs bg-white p-3 rounded border border-green-200 overflow-x-auto">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}

            {!loading && !error && !response && (
              <p className="text-gray-500 text-center py-12">
                Click a test button to see the API response
              </p>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-medium text-blue-900 mb-2">테스트 순서</h3>
          <ol className="space-y-2 text-sm text-blue-800">
            <li>1. Schedule APIs: Generate → Validate → Optimize → Confirm 순서로 테스트</li>
            <li>2. Swap APIs: Create Request → Get Requests → Approve/Reject 순서로 테스트</li>
            <li>3. 각 API의 Request Body를 확인하여 필요시 수정 가능</li>
            <li>4. Response에서 생성된 ID를 다음 API 테스트에 사용</li>
          </ol>
          {createdSwapId && (
            <div className="mt-4 p-3 bg-green-100 rounded">
              <p className="text-sm text-green-800">
                ✅ 생성된 Swap Request ID: <code className="font-mono bg-green-200 px-1 rounded">{createdSwapId}</code>
              </p>
              <p className="text-xs text-green-700 mt-1">
                이 ID가 Approve/Reject 테스트에 자동으로 사용됩니다.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}