'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Bell, Info, AlertTriangle, Clock, Calendar, UserCheck, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  actionUrl?: string;
  readAt?: Date | null;
  createdAt: Date;
  data?: Record<string, unknown>;
}

interface NotificationInbox {
  userId: string;
  tenantId: string;
  notifications: Notification[];
  unreadCount: number;
}

export default function NotificationsPage() {
  const currentUser = useCurrentUser();
  const [inbox, setInbox] = useState<NotificationInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ id: string; tenantId: string } | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!currentUser.userId) return;

      try {
        const response = await fetch('/api/users/me');
        if (response.ok) {
          const data = await response.json();
          setUserInfo({ id: data.id, tenantId: data.tenantId });
        }
      } catch (err) {
        console.error('Failed to fetch user info:', err);
      }
    };

    fetchUserInfo();
  }, [currentUser.userId]);

  useEffect(() => {
    if (userInfo) {
      loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo]);

  const loadNotifications = async () => {
    if (!userInfo) return;

    try {
      setLoading(true);

      const response = await fetch('/api/notifications', {
        headers: {
          'x-tenant-id': userInfo.tenantId,
          'x-user-id': userInfo.id,
        },
      });

      if (!response.ok) {
        throw new Error('알림을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setInbox(data.inbox);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err instanceof Error ? err.message : '알림을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!userInfo) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': userInfo.tenantId,
          'x-user-id': userInfo.id,
        },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        // Update local state
        setInbox(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            notifications: prev.notifications.map(n =>
              n.id === notificationId ? { ...n, readAt: new Date() } : n
            ),
            unreadCount: Math.max(0, prev.unreadCount - 1),
          };
        });
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (priority === 'urgent' || priority === 'high') {
      return <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
    }

    switch (type) {
      case 'schedule_published':
      case 'schedule_updated':
        return <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'swap_approved':
      case 'swap_requested':
        return <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'swap_rejected':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'emergency_call':
        return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getNotificationBgColor = (type: string, priority: string) => {
    if (priority === 'urgent') {
      return 'bg-red-100 dark:bg-red-900/30';
    }
    if (priority === 'high') {
      return 'bg-orange-100 dark:bg-orange-900/30';
    }

    switch (type) {
      case 'schedule_published':
      case 'schedule_updated':
        return 'bg-blue-100 dark:bg-blue-900/30';
      case 'swap_approved':
        return 'bg-green-100 dark:bg-green-900/30';
      case 'swap_rejected':
        return 'bg-red-100 dark:bg-red-900/30';
      case 'emergency_call':
        return 'bg-red-100 dark:bg-red-900/30';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (diffInSeconds < 60) {
      return '방금 전';
    }
    if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}분 전`;
    }
    if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    }
    if (diffInSeconds < 604800) {
      return `${Math.floor(diffInSeconds / 86400)}일 전`;
    }
    return new Date(date).toLocaleDateString('ko-KR');
  };

  const todayNotifications = inbox?.notifications.filter(n => {
    const notifDate = new Date(n.createdAt);
    const today = new Date();
    return notifDate.toDateString() === today.toDateString();
  }).length || 0;

  const highPriorityNotifications = inbox?.notifications.filter(n =>
    n.priority === 'high' || n.priority === 'urgent'
  ).length || 0;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-400">알림을 불러오는 중...</div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            알림
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            중요한 알림과 업데이트를 확인하세요
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">읽지 않음</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {inbox?.unreadCount || 0}
                </p>
              </div>
              <Bell className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">오늘</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {todayNotifications}
                </p>
              </div>
              <Clock className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">중요</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {highPriorityNotifications}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Notifications List */}
        {inbox && inbox.notifications.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
            {inbox.notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                  !notification.readAt ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                }`}
                onClick={() => {
                  if (!notification.readAt) {
                    markAsRead(notification.id);
                  }
                  if (notification.actionUrl) {
                    window.location.href = notification.actionUrl;
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 ${getNotificationBgColor(notification.type, notification.priority)} rounded-lg flex-shrink-0`}>
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium text-gray-900 dark:text-gray-100 ${
                        !notification.readAt ? 'font-semibold' : ''
                      }`}>
                        {notification.title}
                      </p>
                      {!notification.readAt && (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              알림이 없습니다
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
