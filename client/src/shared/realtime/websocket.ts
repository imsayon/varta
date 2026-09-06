'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/shared/api/api';

interface NotificationPayload {
  id?: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  workspaceId?: string;
  subscriberId?: string;
  onNotification?: (notification: NotificationPayload) => void;
}

export function useWebSocket({ workspaceId, subscriberId, onNotification }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const onNotificationRef = useRef(onNotification);
  useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);

  useEffect(() => {
    if (!workspaceId) return;
    let disposed = false;
    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const retry = () => {
      if (!disposed) reconnectTimer = setTimeout(() => { void connect(); }, 5000);
    };
    const connect = async () => {
      try {
        const path = subscriberId
          ? `/api/v1/workspaces/${workspaceId}/subscribers/${subscriberId}/ws-token`
          : `/api/v1/workspaces/${workspaceId}/ws-token`;
        const result = await apiClient.post<{ token?: string }>(path);
        if (disposed) return;
        const token = result.success ? result.data.token : undefined;
        if (!token) { retry(); return; }
        const endpoint = new URL(process.env.NEXT_PUBLIC_API_URL || window.location.origin);
        endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
        endpoint.pathname = '/ws';
        endpoint.search = `token=${encodeURIComponent(token)}`;
        socket = new WebSocket(endpoint.toString());
        const current = socket;
        current.onopen = () => { if (!disposed) setIsConnected(true); };
        current.onmessage = (event) => {
          if (disposed) return;
          try {
            const message = JSON.parse(event.data);
            if (message.type !== 'notification' && message.type !== 'pending_flush') return;
            if (message.data) onNotificationRef.current?.(message.data);
            if (subscriberId && message.data?.id && current.readyState === WebSocket.OPEN) {
              current.send(JSON.stringify({ type: 'ack', notificationId: message.data.id }));
            }
          } catch { /* Ignore invalid messages; never acknowledge them. */ }
        };
        current.onclose = () => {
          if (disposed) return;
          setIsConnected(false);
          retry();
        };
        current.onerror = () => current.close();
      } catch { retry(); }
    };
    void connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.onmessage = null;
        socket.close();
      }
    };
  }, [workspaceId, subscriberId]);

  return { isConnected };
}
