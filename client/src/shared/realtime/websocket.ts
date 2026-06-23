'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { IWSNotification, IWSMessage } from '../types/domain';

interface UseWebSocketReturn {
  notifications: IWSNotification[];
  isConnected: boolean;
  unreadCount: number;
  markAllRead: () => void;
}

/**
 * Hook for real-time in-app notifications via WebSocket using Socket.IO.
 */
export function useWebSocket(subscriberId: string | null): UseWebSocketReturn {
  const [notifications, setNotifications] = useState<IWSNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!subscriberId || typeof window === 'undefined') return;

    const token = localStorage.getItem('varta_token') || '';

    const socket: Socket = io({
      path: '/ws',
      query: { subscriberId, token },
      transports: ['websocket'], // Force websocket
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('notification', (data: IWSNotification) => {
      const notif = { ...data, timestamp: new Date().toISOString() };
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    socket.on('pending_flush', (batch: IWSNotification[]) => {
      const formattedBatch = batch.map((n) => ({
        ...n,
        timestamp: n.timestamp || new Date().toISOString(),
      }));
      setNotifications((prev) => [...formattedBatch, ...prev]);
      setUnreadCount((prev) => prev + formattedBatch.length);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [subscriberId]);

  return { notifications, isConnected, unreadCount, markAllRead };
}
