'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { initSocketClient, getSocket } from '@/lib/socket';
import {
  showBookIssuedToast,
  showFineAddedToast,
  showReservationReadyToast,
} from '@/components/providers/ToastProvider';

export function useSocketEvents() {
  const queryClient = useQueryClient();
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const { socket, isConnected } = useSocketStore();
  const activeSocketRef = useRef<any>(null);

  // 1. Initialize or maintain socket connection based on auth state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isAuthenticated && accessToken) {
      const sock = initSocketClient(accessToken);
      activeSocketRef.current = sock;
    } else {
      activeSocketRef.current = null;
    }
  }, [isAuthenticated, accessToken]);

  // 2. Attach real-time event listeners based on user and role
  useEffect(() => {
    const currentSocket = socket || getSocket();
    if (!currentSocket || !isAuthenticated || !user) return;

    const userRole = user.role || 'student';
    const isStaff = ['librarian', 'admin'].includes(userRole);

    /* ─── Event 1: notification:new ─── */
    const handleNotificationNew = (data: any) => {
      const notification = data?.notification || data;
      if (!notification) return;

      // Ensure notification is targeted for this user
      const targetUserId = notification.user?._id || notification.user;
      if (targetUserId && targetUserId !== user._id && notification.memberId !== (user as any).memberId) {
        return;
      }

      const title = notification.title || 'New Notification';
      const message = notification.message || '';

      toast.success(title + (message ? `: ${message}` : ''), {
        id: `notif-${notification._id || Date.now()}`,
        duration: 4500,
      });

      // Invalidate notification queries
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });

      // Optimistically increment unread count in cache if present
      queryClient.setQueryData(
        ['notifications', 'unread-count'],
        (prev: any) => {
          if (typeof prev === 'number') return prev + 1;
          if (prev && typeof prev.count === 'number') return { ...prev, count: prev.count + 1 };
          return 1;
        }
      );
      queryClient.setQueryData(
        ['notifications', 'unread'],
        (prev: any) => (typeof prev === 'number' ? prev + 1 : 1)
      );
    };

    /* ─── Event 2: book:issued ─── */
    const handleBookIssued = (data: any) => {
      if (isStaff) {
        const tx = data?.transaction || data;
        showBookIssuedToast(tx);
        queryClient.invalidateQueries({ queryKey: ['circulation'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
        queryClient.invalidateQueries({ queryKey: ['books'] });
      }
    };

    /* ─── Event 3: book:returned ─── */
    const handleBookReturned = (data: any) => {
      if (isStaff) {
        const tx = data?.transaction;
        const bookTitle = tx?.book?.title || 'Book';
        const fineAdded = data?.fineAdded;

        toast.success(
          `Book returned: "${bookTitle}"${fineAdded ? ` (PKR ${fineAdded} fine recorded)` : ''}`,
          { id: `return-${tx?._id || Date.now()}`, duration: 4000 }
        );

        // Invalidate circulation & dashboard queries
        queryClient.invalidateQueries({ queryKey: ['circulation'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
        queryClient.invalidateQueries({ queryKey: ['fines'] });
        queryClient.invalidateQueries({ queryKey: ['books'] });
      }
    };

    /* ─── Event 4: reservation:created ─── */
    const handleReservationCreated = (data: any) => {
      if (isStaff) {
        const bookTitle = data?.book?.title || 'a book';
        const memberName = data?.member?.name || 'A patron';
        toast(
          `Reservation queue updated: ${memberName} requested "${bookTitle}"`,
          {
            icon: '📋',
            id: `res-created-${data?.reservationId || Date.now()}`,
            duration: 4000,
          }
        );
        queryClient.invalidateQueries({ queryKey: ['reservations'] });
        queryClient.invalidateQueries({ queryKey: ['circulation'] });
      }
    };

    /* ─── Event 5: reservation:ready ─── */
    const handleReservationReady = (data: any) => {
      const bookTitle = data?.book?.title || data?.book || 'Reserved Book';
      const expiresAt = data?.expiresAt || new Date(Date.now() + 48 * 3600 * 1000);
      const coverImage = data?.book?.coverImage || data?.reservation?.book?.coverImage;

      // Show persistent toast with pickup now link
      showReservationReadyToast(
        {
          bookTitle,
          expiresAt,
          coverImage,
          reservationId: data?.reservationId || data?.reservation?._id,
        },
        12000 // Extended persistent duration
      );

      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['my-books'] });
    };

    /* ─── Event 6: reservation:expired ─── */
    const handleReservationExpired = (data: any) => {
      const bookTitle = data?.book?.title || data?.book || 'Reserved title';
      toast.error(`Pickup hold expired for "${bookTitle}".`, {
        id: `res-expired-${data?.reservationId || Date.now()}`,
        duration: 5000,
      });

      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    };

    /* ─── Event 7: overdue:alert ─── */
    const handleOverdueAlert = (data: any) => {
      if (isStaff) {
        const count = data?.count || 'Multiple';
        toast(
          `Overdue Alert: ${count} loan(s) require patron follow-up.`,
          {
            icon: '⚠️',
            id: `overdue-${Date.now()}`,
            duration: 5000,
          }
        );
        queryClient.invalidateQueries({ queryKey: ['overdue'] });
        queryClient.invalidateQueries({ queryKey: ['circulation'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
      }
    };

    /* ─── Event 8: fine:added ─── */
    const handleFineAdded = (data: any) => {
      const amount = data?.fine || 0;
      const bookTitle = data?.book || '';
      const newBalance = data?.newBalance;
      const reason = data?.reason || 'Late return fine';

      showFineAddedToast({
        amount,
        bookTitle,
        reason,
        newBalance,
      });

      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['circulation'] });
    };

    // Attach listeners
    currentSocket.on('notification:new', handleNotificationNew);
    currentSocket.on('reservation:ready', handleReservationReady);
    currentSocket.on('reservation:expired', handleReservationExpired);
    currentSocket.on('fine:added', handleFineAdded);

    if (isStaff) {
      currentSocket.on('book:issued', handleBookIssued);
      currentSocket.on('book:returned', handleBookReturned);
      currentSocket.on('reservation:created', handleReservationCreated);
      currentSocket.on('overdue:alert', handleOverdueAlert);
    }

    // Cleanup on unmount or socket change
    return () => {
      currentSocket.off('notification:new', handleNotificationNew);
      currentSocket.off('reservation:ready', handleReservationReady);
      currentSocket.off('reservation:expired', handleReservationExpired);
      currentSocket.off('fine:added', handleFineAdded);

      if (isStaff) {
        currentSocket.off('book:issued', handleBookIssued);
        currentSocket.off('book:returned', handleBookReturned);
        currentSocket.off('reservation:created', handleReservationCreated);
        currentSocket.off('overdue:alert', handleOverdueAlert);
      }
    };
  }, [socket, isConnected, isAuthenticated, user, queryClient]);
}
