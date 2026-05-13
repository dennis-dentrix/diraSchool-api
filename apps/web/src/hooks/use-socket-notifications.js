'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { notificationsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';

const showNotificationToast = (notification) => {
  const { type, title, message } = notification;
  const opts = { description: message || undefined };
  if (type === 'success') toast.success(title, opts);
  else if (type === 'error') toast.error(title, opts);
  else if (type === 'warning') toast.warning(title, opts);
  else toast.info(title, opts);
};

/**
 * Replaces the two polling useQuery calls in the header.
 *
 * - Loads the initial notification list and unread count from the REST API once.
 * - Connects to Socket.io and keeps the list + badge updated in real time via
 *   'notification:new' and 'notification:count' events — zero polling.
 * - Exposes markRead / markAllRead that optimistically update local state before
 *   the server responds so the UI feels instant.
 */
export function useSocketNotifications({ enabled = true, listLimit = 8 } = {}) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [connected, setConnected]         = useState(false);
  const loadedRef = useRef(false);

  // ── Initial data load (one-shot REST fetch) ───────────────────────────────
  useEffect(() => {
    if (!enabled || !user || loadedRef.current) return;
    if (user.role === 'superadmin') return;

    loadedRef.current = true;

    Promise.all([
      notificationsApi.unreadCount(),
      notificationsApi.list({ page: 1, limit: listLimit }),
    ])
      .then(([countRes, listRes]) => {
        const count = countRes.data?.count ?? countRes.data?.data?.count ?? 0;
        const list  = listRes.data?.notifications ?? listRes.data?.data ?? [];
        setUnreadCount(count);
        setNotifications(Array.isArray(list) ? list : []);
      })
      .catch(() => {}); // REST failure is non-fatal — socket will keep things live
  }, [enabled, user, listLimit]);

  // ── Socket.io real-time updates ───────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !user || user.role === 'superadmin') return;

    const sock = getSocket();

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onNew = ({ notification, unreadCount: count }) => {
      setNotifications((prev) => [notification, ...prev].slice(0, listLimit));
      setUnreadCount(count);
      showNotificationToast(notification);
    };

    const onCount = ({ count }) => setUnreadCount(count);

    sock.on('connect',            onConnect);
    sock.on('disconnect',         onDisconnect);
    sock.on('notification:new',   onNew);
    sock.on('notification:count', onCount);

    if (sock.connected) setConnected(true);

    return () => {
      sock.off('connect',            onConnect);
      sock.off('disconnect',         onDisconnect);
      sock.off('notification:new',   onNew);
      sock.off('notification:count', onCount);
    };
  }, [enabled, user, listLimit]);

  // ── Optimistic actions ────────────────────────────────────────────────────

  const markRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n._id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await notificationsApi.markRead(id);
      // Server also emits notification:count which will reconcile if we were off by one
    } catch { /* server emit will correct the count */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await notificationsApi.markAllRead();
    } catch { /* optimistic update stands */ }
  }, []);

  return { notifications, unreadCount, connected, markRead, markAllRead };
}
