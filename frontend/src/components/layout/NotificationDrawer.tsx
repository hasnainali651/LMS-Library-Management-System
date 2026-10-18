'use client';

import React, { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Bell,
  X,
  CheckCheck,
  BookOpen,
  AlertTriangle,
  Clock,
  Info,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

export interface NotificationItem {
  _id: string;
  user: string;
  type: 'DUE_REMINDER' | 'OVERDUE' | 'RESERVATION_READY' | 'RESERVATION_CANCELLED' | 'FINE_INC' | 'CUSTOM' | string;
  title?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface NotificationDrawerProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  unreadCount?: number;
  onUnreadCountChange?: (count: number) => void;
}

const typeIconMap: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  DUE_REMINDER: { icon: Clock, color: 'text-[var(--neo-warning)]', bg: 'bg-[var(--neo-warning-surface)]' },
  OVERDUE: { icon: AlertTriangle, color: 'text-[var(--neo-danger)]', bg: 'bg-[var(--neo-danger-surface)]' },
  RESERVATION_READY: { icon: BookOpen, color: 'text-[var(--neo-success)]', bg: 'bg-[var(--neo-success-surface)]' },
  RESERVATION_CANCELLED: { icon: X, color: 'text-[var(--neo-text-3)]', bg: 'bg-[var(--neo-surface)]' },
  FINE_INC: { icon: AlertTriangle, color: 'text-[var(--neo-warning)]', bg: 'bg-[var(--neo-warning-surface)]' },
  CUSTOM: { icon: Info, color: 'text-[var(--neo-accent)]', bg: 'bg-[var(--neo-surface)]' },
};

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  open,
  onOpenChange,
  onClose,
  unreadCount = 0,
  onUnreadCountChange,
}) => {
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (!nextOpen) onClose?.();
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      const docs = res.data?.data?.docs || res.data?.data || [];
      setNotifications(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      const count = res.data?.data?.unreadCount ?? 0;
      onUnreadCountChange?.(count);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    if (open) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [open]);

  useEffect(() => {
    if (user?._id) {
      fetchUnreadCount();
    }
  }, [user?._id]);

  useEffect(() => {
    if (!socket || !user?._id) return;

    const handleNewNotification = (data: any) => {
      const newNotification: NotificationItem = data?.notification || data;
      if (!newNotification) return;

      setNotifications((prev) => [newNotification, ...prev]);
      onUnreadCountChange?.(unreadCount + 1);
      toast.success(newNotification.title || 'New notification received', {
        icon: '🔔',
      });
    };

    socket.on('notification', handleNewNotification);
    socket.on(`user:${user._id}:notification`, handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off(`user:${user._id}:notification`, handleNewNotification);
    };
  }, [socket, user?._id, unreadCount, onUnreadCountChange]);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onUnreadCountChange?.(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to update notifications');
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      onUnreadCountChange?.(Math.max(0, unreadCount - 1));
    } catch (err) {
      // ignore
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--neo-card)] text-[var(--neo-text)] border-l border-[var(--neo-border-light)] [box-shadow:var(--neo-raised-lg)] flex flex-col focus:outline-none duration-300',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[var(--neo-shadow-dark)]/25">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] text-[var(--neo-accent)] flex items-center justify-center [box-shadow:var(--neo-flat)] border border-[var(--neo-border-light)]">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <DialogPrimitive.Title className="font-display text-base font-bold text-[var(--neo-text)]">
                  Notifications
                </DialogPrimitive.Title>
                <p className="text-xs text-[var(--neo-text-3)] tabular-nums font-medium">
                  {unreadCount} unread alert{unreadCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {notifications.some((n) => !n.isRead) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="h-8 text-xs gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                  <span>Mark all read</span>
                </Button>
              )}

              <DialogPrimitive.Close className="neo-btn w-8 h-8 rounded-full flex items-center justify-center text-[var(--neo-text-2)] hover:text-[var(--neo-text)]">
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {loading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3.5 rounded-[var(--neo-r-sm)] bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)] space-y-2">
                    <div className="h-4 bg-[var(--neo-surface)] rounded w-1/3 animate-pulse" />
                    <div className="h-3 bg-[var(--neo-surface)] rounded w-3/4 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="h-full flex items-center justify-center py-12">
                <EmptyState
                  icon={Bell}
                  title="All caught up!"
                  description="You have no notifications at the moment. We will notify you when books are due or reservations are ready."
                />
              </div>
            ) : (
              notifications.map((item) => {
                const config = typeIconMap[item.type] || typeIconMap.CUSTOM;
                const IconComponent = config.icon;
                const timeAgo = item.createdAt
                  ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                  : '';

                return (
                  <div
                    key={item._id}
                    onClick={() => !item.isRead && handleMarkSingleRead(item._id)}
                    className={cn(
                      'group relative flex items-start gap-3.5 p-3.5 rounded-[var(--neo-r-sm)] border transition-all duration-150 cursor-pointer',
                      item.isRead
                        ? 'bg-[var(--neo-card)] border-[var(--neo-border-light)] text-[var(--neo-text-2)] [box-shadow:var(--neo-flat)]'
                        : 'bg-[var(--neo-surface)] border-[var(--neo-border-light)] text-[var(--neo-text)] [box-shadow:var(--neo-raised-sm)] ring-1 ring-[var(--neo-accent)]/20'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-[var(--neo-r-xs)] flex items-center justify-center shrink-0 mt-0.5 border border-[var(--neo-border-light)] [box-shadow:var(--neo-flat)]', config.bg, config.color)}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {item.title && (
                        <h4 className="text-xs font-bold text-[var(--neo-text)] truncate">
                          {item.title}
                        </h4>
                      )}
                      <p className="text-xs text-[var(--neo-text-2)] leading-relaxed mt-0.5">
                        {item.message}
                      </p>
                      <span className="text-[10px] text-[var(--neo-text-3)] font-medium mt-1 block tabular-nums">
                        {timeAgo}
                      </span>
                    </div>

                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[var(--neo-accent)] shrink-0 mt-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
