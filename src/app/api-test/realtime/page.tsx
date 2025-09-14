"use client";
import { useState, useEffect, useRef } from "react";
import { Bell, Wifi, WifiOff, Send, Trash2, Check, X, AlertCircle, RefreshCw } from "lucide-react";
import { SSEClient } from "@/lib/sse/client";

export default function RealtimeApiTestPage() {
  const [activeTab, setActiveTab] = useState<'sse' | 'push' | 'notifications' | 'guide'>('guide');
  const [sseConnected, setSseConnected] = useState(false);
  const [sseEvents, setSseEvents] = useState<Array<{ time: string; type: string; data: any }>>([]);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sseClientRef = useRef<SSEClient | null>(null);

  // SSE Connection
  useEffect(() => {
    const client = new SSEClient({
      url: '/api/sse',
      headers: {
        'x-tenant-id': 'test-tenant',
        'x-user-id': 'test-user',
      },
      onOpen: () => {
        setSseConnected(true);
        console.log('SSE connected');
      },
      onClose: () => {
        setSseConnected(false);
        console.log('SSE disconnected');
      },
      onError: (error) => {
        console.error('SSE error:', error);
      },
      onReconnect: (attempt) => {
        console.log(`SSE reconnecting... attempt ${attempt}`);
      },
    });

    // Listen for events
    client.on('connected', (event) => {
      const data = JSON.parse(event.data);
      addSseEvent('connected', data);
    });

    client.on('notification', (event) => {
      const data = JSON.parse(event.data);
      addSseEvent('notification', data);
    });

    client.on('schedule.updated', (event) => {
      const data = JSON.parse(event.data);
      addSseEvent('schedule.updated', data);
    });

    client.on('swap.requested', (event) => {
      const data = JSON.parse(event.data);
      addSseEvent('swap.requested', data);
    });

    client.on('swap.approved', (event) => {
      const data = JSON.parse(event.data);
      addSseEvent('swap.approved', data);
    });

    client.on('ping', (event) => {
      const data = JSON.parse(event.data);
      addSseEvent('ping', data);
    });

    sseClientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
    };
  }, []);

  const addSseEvent = (type: string, data: any) => {
    setSseEvents(prev => [
      {
        time: new Date().toLocaleTimeString(),
        type,
        data,
      },
      ...prev.slice(0, 49), // Keep last 50 events
    ]);
  };

  // Subscribe to push notifications
  const subscribePush = async () => {
    try {
      // Mock subscription for testing
      const mockSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
        expirationTime: null,
        keys: {
          p256dh: 'test-public-key',
          auth: 'test-auth-key',
        },
      };

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          subscription: mockSubscription,
          topics: ['schedule', 'swap', 'emergency'],
        }),
      });

      const result = await response.json();
      if (result.success) {
        setPushSubscribed(true);
        alert('Push notifications subscribed!');
      }
    } catch (error) {
      console.error('Push subscription error:', error);
      alert('Failed to subscribe to push notifications');
    }
  };

  // Unsubscribe from push notifications
  const unsubscribePush = async () => {
    try {
      const response = await fetch('/api/push/subscribe?endpoint=https://fcm.googleapis.com/fcm/send/test-endpoint-123', {
        method: 'DELETE',
        headers: {
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'test-user',
        },
      });

      const result = await response.json();
      if (result.success) {
        setPushSubscribed(false);
        alert('Push notifications unsubscribed!');
      }
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      alert('Failed to unsubscribe from push notifications');
    }
  };

  // Send test notification
  const sendTestNotification = async (type: string, priority: string) => {
    try {
      const notificationData = {
        type,
        priority,
        title: `Test ${type} Notification`,
        message: `This is a test ${priority} priority notification for ${type}`,
        data: {
          testId: Date.now(),
          timestamp: new Date().toISOString(),
        },
        userId: 'test-user',
        actionUrl: '/test',
        actions: priority === 'high' || priority === 'urgent' ? [
          {
            id: 'action1',
            label: 'Accept',
            action: 'accept',
            style: 'primary',
          },
          {
            id: 'action2',
            label: 'Reject',
            action: 'reject',
            style: 'secondary',
          },
        ] : undefined,
      };

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify(notificationData),
      });

      const result = await response.json();
      console.log('Send notification response:', result);
      if (result.success) {
        console.log('Notification sent successfully, fetching inbox...');
        // 약간의 지연 후 인박스 가져오기
        setTimeout(() => {
          fetchNotifications();
        }, 100);
      }
    } catch (error) {
      console.error('Send notification error:', error);
      alert('Failed to send notification');
    }
  };

  // Fetch notifications inbox
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'test-user',
        },
      });

      const result = await response.json();
      console.log('Fetch notifications response:', result);
      if (result.success) {
        console.log('Inbox data:', result.inbox);
        setNotifications(result.inbox.notifications);
        setUnreadCount(result.inbox.unreadCount);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({ notificationId }),
      });

      const result = await response.json();
      if (result.success) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  // Clear all notifications
  const clearNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'test-user',
        },
      });

      const result = await response.json();
      if (result.success) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Clear notifications error:', error);
    }
  };

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-gray-900">Real-time API Test</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {sseConnected ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-600">SSE Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-red-600">SSE Disconnected</span>
                  </>
                )}
              </div>
              <div className="relative">
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'guide'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📖 테스트 가이드
          </button>
          <button
            onClick={() => setActiveTab('sse')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'sse'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            SSE Events
          </button>
          <button
            onClick={() => setActiveTab('push')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'push'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Push Notifications
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 font-medium relative ${
              activeTab === 'notifications'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Notifications Inbox
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Test Guide Tab */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">🚀 실시간 API 테스트 가이드</h2>

              <div className="space-y-8">
                {/* SSE 테스트 가이드 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-blue-600">1️⃣ SSE (Server-Sent Events) 테스트</h3>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                    <p className="text-sm text-gray-700">실시간 서버 이벤트 스트리밍을 테스트합니다.</p>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                      <li><strong>연결 상태 확인</strong>: 상단 우측의 WiFi 아이콘이 초록색으로 표시되는지 확인</li>
                      <li><strong>SSE Events 탭</strong>으로 이동</li>
                      <li><strong>"Send Test Event"</strong> 버튼 클릭하여 테스트 이벤트 전송</li>
                      <li>이벤트 로그에서 실시간으로 수신되는 이벤트 확인</li>
                      <li>각 이벤트의 타입, 시간, 데이터를 확인</li>
                    </ol>
                    <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                      <p className="text-xs font-mono text-gray-600">
                        💡 팁: SSE는 자동으로 재연결되며, 30초마다 heartbeat가 전송됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Push 알림 테스트 가이드 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-green-600">2️⃣ Push Notifications 테스트</h3>
                  <div className="bg-green-50 p-4 rounded-lg space-y-3">
                    <p className="text-sm text-gray-700">Web Push 알림 구독 및 전송을 테스트합니다.</p>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                      <li><strong>Push Notifications 탭</strong>으로 이동</li>
                      <li><strong>"Subscribe to Push"</strong> 버튼 클릭하여 Push 알림 구독</li>
                      <li>구독 성공 메시지 확인</li>
                      <li>다양한 알림 타입 버튼 클릭:
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li><strong>Schedule Published</strong>: 스케줄 발행 알림 (높은 우선순위)</li>
                          <li><strong>Swap Request</strong>: 근무 교환 요청 알림</li>
                          <li><strong>Emergency Call</strong>: 긴급 호출 알림 (최고 우선순위)</li>
                          <li><strong>Shift Reminder</strong>: 근무 알림 (중간 우선순위)</li>
                        </ul>
                      </li>
                      <li>브라우저 콘솔에서 Push 전송 로그 확인</li>
                    </ol>
                    <div className="mt-3 p-3 bg-white rounded border border-green-200">
                      <p className="text-xs font-mono text-gray-600">
                        💡 팁: 높은 우선순위(high, urgent) 알림만 실제 Push가 전송됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 알림 인박스 테스트 가이드 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-purple-600">3️⃣ Notifications Inbox 테스트</h3>
                  <div className="bg-purple-50 p-4 rounded-lg space-y-3">
                    <p className="text-sm text-gray-700">알림 인박스 기능을 테스트합니다.</p>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                      <li><strong>Notifications Inbox 탭</strong>으로 이동</li>
                      <li>먼저 다른 탭에서 테스트 알림을 여러 개 전송</li>
                      <li>인박스에서 알림 목록 확인:
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>새 알림은 <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">New</span> 배지 표시</li>
                          <li>긴급 알림은 🚨 아이콘 표시</li>
                        </ul>
                      </li>
                      <li>알림 우측의 <strong>✓ 체크 버튼</strong> 클릭하여 읽음 처리</li>
                      <li>액션 버튼 테스트 (Approve/Reject 등)</li>
                      <li>상단 <strong>🗑️ 휴지통 버튼</strong>으로 전체 삭제</li>
                      <li>상단 <strong>🔄 새로고침 버튼</strong>으로 인박스 갱신</li>
                    </ol>
                    <div className="mt-3 p-3 bg-white rounded border border-purple-200">
                      <p className="text-xs font-mono text-gray-600">
                        💡 팁: 상단의 벨 아이콘 옆 숫자는 읽지 않은 알림 개수입니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 시나리오 테스트 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-orange-600">4️⃣ 통합 시나리오 테스트</h3>
                  <div className="bg-orange-50 p-4 rounded-lg space-y-3">
                    <p className="text-sm text-gray-700">실제 사용 시나리오를 따라 테스트해보세요.</p>
                    <div className="space-y-4">
                      <div className="p-3 bg-white rounded border border-orange-200">
                        <h4 className="font-semibold text-sm mb-2">📅 스케줄 발행 시나리오</h4>
                        <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1">
                          <li>Push 알림 구독</li>
                          <li>"Schedule Published" 알림 전송</li>
                          <li>SSE 탭에서 실시간 이벤트 확인</li>
                          <li>인박스에서 알림 확인 및 읽음 처리</li>
                        </ol>
                      </div>

                      <div className="p-3 bg-white rounded border border-orange-200">
                        <h4 className="font-semibold text-sm mb-2">🔄 근무 교환 시나리오</h4>
                        <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1">
                          <li>"Swap Request" 알림 전송</li>
                          <li>인박스에서 액션 버튼 확인 (Approve/Reject)</li>
                          <li>SSE 이벤트 로그에서 swap.requested 이벤트 확인</li>
                        </ol>
                      </div>

                      <div className="p-3 bg-white rounded border border-orange-200">
                        <h4 className="font-semibold text-sm mb-2">🚨 긴급 호출 시나리오</h4>
                        <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1">
                          <li>"Emergency Call" 알림 전송</li>
                          <li>최고 우선순위 알림 확인 (🚨 아이콘)</li>
                          <li>Accept 액션 버튼 테스트</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 문제 해결 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-red-600">⚠️ 문제 해결</h3>
                  <div className="bg-red-50 p-4 rounded-lg space-y-3">
                    <div className="space-y-3 text-sm text-gray-600">
                      <div>
                        <strong>SSE 연결이 안 될 때:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>개발 서버가 실행 중인지 확인 (npm run dev)</li>
                          <li>브라우저 콘솔에서 에러 메시지 확인</li>
                          <li>페이지 새로고침 후 재시도</li>
                        </ul>
                      </div>
                      <div>
                        <strong>Push 구독이 실패할 때:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>브라우저가 Push API를 지원하는지 확인</li>
                          <li>HTTPS 환경에서만 작동 (localhost는 예외)</li>
                        </ul>
                      </div>
                      <div>
                        <strong>알림이 표시되지 않을 때:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>Notifications Inbox 새로고침 버튼 클릭</li>
                          <li>네트워크 탭에서 API 응답 확인</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SSE Events Tab */}
        {activeTab === 'sse' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium mb-4">Server-Sent Events</h2>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => sendTestNotification('general', 'low')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Send Test Event
                  </button>
                  <button
                    onClick={() => setSseEvents([])}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Clear Events
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {sseEvents.length === 0 ? (
                    <p className="text-gray-500 text-center">No events received yet</p>
                  ) : (
                    <div className="space-y-2">
                      {sseEvents.map((event, index) => (
                        <div key={index} className="border-b border-gray-100 pb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              {event.type}
                            </span>
                            <span className="text-xs text-gray-500">{event.time}</span>
                          </div>
                          <pre className="text-xs text-gray-600 mt-1 overflow-x-auto">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Push Notifications Tab */}
        {activeTab === 'push' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium mb-4">Web Push Notifications</h2>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {!pushSubscribed ? (
                    <button
                      onClick={subscribePush}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Subscribe to Push
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={unsubscribePush}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Unsubscribe
                      </button>
                      <span className="text-sm text-green-600">✓ Push notifications enabled</span>
                    </>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-2">Send Test Push Notification</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => sendTestNotification('schedule_published', 'high')}
                      className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      Schedule Published
                    </button>
                    <button
                      onClick={() => sendTestNotification('swap_requested', 'high')}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Swap Request
                    </button>
                    <button
                      onClick={() => sendTestNotification('emergency_call', 'urgent')}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Emergency Call
                    </button>
                    <button
                      onClick={() => sendTestNotification('shift_reminder', 'medium')}
                      className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Shift Reminder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Inbox Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Notifications Inbox</h2>
                <div className="flex gap-2">
                  <button
                    onClick={fetchNotifications}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={clearNotifications}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No notifications</p>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`border rounded-lg p-4 ${
                        notification.readAt ? 'bg-gray-50' : 'bg-white border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {notification.priority === 'urgent' && (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                            <h3 className="font-medium text-gray-900">
                              {notification.title}
                            </h3>
                            {!notification.readAt && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-500">
                              {new Date(notification.createdAt).toLocaleString()}
                            </span>
                            {notification.actions && (
                              <div className="flex gap-2">
                                {notification.actions.map((action: any) => (
                                  <button
                                    key={action.id}
                                    className={`text-xs px-2 py-1 rounded ${
                                      action.style === 'primary'
                                        ? 'bg-blue-600 text-white'
                                        : action.style === 'danger'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-200 text-gray-700'
                                    }`}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {!notification.readAt && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}