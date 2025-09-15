"use client";
import { useState, useEffect, useCallback } from "react";
import { Bell, X, Check, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export interface Notification {
  id: string;
  type: 'swap.request' | 'swap.approved' | 'swap.rejected' | 'schedule.updated' | 'schedule.published' | 'emergency_call' | 'shift_reminder' | 'general';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actions?: Array<{
    label: string;
    action: string;
  }>;
  requestId?: string;
  metadata?: any;
}

interface NotificationCenterProps {
  userId: string;
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // 초기 알림 가져오기
  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'x-user-id': userId,
          'x-tenant-id': 'default-tenant'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setNotifications(result.data.notifications);
          setUnreadCount(result.data.unreadCount);
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  // SSE 연결 설정
  useEffect(() => {
    const connectSSE = () => {
      setConnectionStatus('connecting');
      const es = new EventSource(`/api/sse`, {
        withCredentials: false
      });

      es.addEventListener('open', () => {
        console.log('SSE Connected');
        setConnectionStatus('connected');
      });

      es.addEventListener('notification', (event) => {
        const data = JSON.parse(event.data);
        handleNewNotification(data);
      });

      es.addEventListener('swap.requested', (event) => {
        const data = JSON.parse(event.data);
        handleSwapRequest(data);
      });

      es.addEventListener('swap.approved', (event) => {
        const data = JSON.parse(event.data);
        handleSwapApproval(data);
      });

      es.addEventListener('schedule.updated', (event) => {
        const data = JSON.parse(event.data);
        handleScheduleUpdate(data);
      });

      es.addEventListener('ping', () => {
        // Heartbeat 수신
      });

      es.addEventListener('error', () => {
        console.error('SSE Error');
        setConnectionStatus('disconnected');
        es.close();
        // 지수 백오프로 재연결
        const retryDelay = Math.min(30000, 3000 * Math.pow(2, Math.random() * 3));
        setTimeout(connectSSE, retryDelay);
      });

      setEventSource(es);
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [userId]);

  const handleNewNotification = useCallback((data: any) => {
    const notification: Notification = {
      id: `notif-${Date.now()}`,
      type: data.type || 'general',
      title: data.title,
      message: data.message,
      timestamp: Date.now(),
      read: false,
      actions: data.actions,
      requestId: data.requestId
    };

    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // 브라우저 알림 표시
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico'
      });
    }
  }, []);

  const handleSwapRequest = useCallback((data: any) => {
    if (data.targetId === userId) {
      handleNewNotification({
        type: 'swap.request',
        title: '새로운 근무 교대 요청',
        message: `${data.requesterName}님이 근무 교대를 요청했습니다.`,
        requestId: data.requestId,
        actions: [
          { label: '승인', action: 'approve' },
          { label: '거절', action: 'reject' }
        ]
      });
    }
  }, [userId, handleNewNotification]);

  const handleSwapApproval = useCallback((data: any) => {
    handleNewNotification({
      type: 'swap.approved',
      title: '근무 교대 승인됨',
      message: '교대 요청이 승인되었습니다.',
      requestId: data.swapId
    });
  }, [handleNewNotification]);

  const handleScheduleUpdate = useCallback((data: any) => {
    handleNewNotification({
      type: 'schedule.updated',
      title: '스케줄 업데이트',
      message: '새로운 스케줄이 생성되었습니다.',
    });
  }, [handleNewNotification]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleAction = async (notification: Notification, action: string) => {
    if (notification.type === 'swap.request' && notification.requestId) {
      // 스왑 요청 처리
      try {
        const response = await fetch(`/api/swap/${notification.requestId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
            'x-tenant-id': 'default-tenant'
          },
          body: JSON.stringify({
            action,
            [action === 'approve' ? 'approvedBy' : 'rejectedBy']: userId,
            metadata: notification.metadata
          })
        });

        if (response.ok) {
          markAsRead(notification.id);
          // 성공 메시지 표시
          alert(action === 'approve' ? '스왑 요청을 승인했습니다.' : '스왑 요청을 거절했습니다.');
          // 알림 목록 새로고침
          fetchNotifications();
        }
      } catch (error) {
        console.error('Action failed:', error);
        alert('요청 처리에 실패했습니다.');
      }
    } else if (notification.type === 'emergency_call') {
      // 긴급 호출 응답
      alert('긴급 호출에 응답하였습니다.');
      markAsRead(notification.id);
    }
  };

  const deleteAllNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
          'x-tenant-id': 'default-tenant'
        }
      });

      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to delete notifications:', error);
    }
  };

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'swap.request':
        return <ArrowRight className="w-4 h-4" />;
      case 'swap.approved':
        return <Check className="w-4 h-4" />;
      case 'swap.rejected':
        return <X className="w-4 h-4" />;
      case 'schedule.updated':
      case 'schedule.published':
        return <Clock className="w-4 h-4" />;
      case 'emergency_call':
        return <AlertCircle className="w-4 h-4" />;
      case 'shift_reminder':
        return <Bell className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: Notification['type'], priority?: string) => {
    if (priority === 'urgent') {
      return 'bg-red-50 text-red-600';
    }

    switch (type) {
      case 'swap.request':
        return 'bg-blue-50 text-blue-600';
      case 'swap.approved':
        return 'bg-green-50 text-green-600';
      case 'swap.rejected':
        return 'bg-red-50 text-red-600';
      case 'schedule.updated':
      case 'schedule.published':
        return 'bg-purple-50 text-purple-600';
      case 'emergency_call':
        return 'bg-red-50 text-red-600';
      case 'shift_reminder':
        return 'bg-yellow-50 text-yellow-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="relative">
      {/* 알림 벨 아이콘 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full">
            <span className="sr-only">{unreadCount}개의 읽지 않은 알림</span>
          </span>
        )}
      </button>

      {/* 알림 드롭다운 */}
      {isOpen && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 알림 패널 */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-[500px] overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">알림</h3>
                <div className="flex items-center gap-2">
                  {connectionStatus === 'connected' && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="연결됨" />
                  )}
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      모두 읽음
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={deleteAllNotifications}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      모두 삭제
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* 알림 목록 */}
            <div className="overflow-y-auto max-h-[400px]">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm">새로운 알림이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50/30' : ''
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getNotificationColor(notification.type, notification.priority)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(notification.timestamp, "M월 d일 HH:mm", { locale: ko })}
                          </p>

                          {/* 액션 버튼 */}
                          {notification.actions && notification.actions.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              {notification.actions.map((action) => (
                                <button
                                  key={action.action}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(notification, action.action);
                                  }}
                                  className={`px-3 py-1 text-xs font-medium rounded-lg ${
                                    action.action === 'approve'
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}