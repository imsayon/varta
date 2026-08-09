'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const tokenEndpoint = subscriberId
        ? `/api/v1/workspaces/${workspaceId}/subscribers/${subscriberId}/ws-token`
        : `/api/v1/workspaces/${workspaceId}/ws-token`;
      const tokenRes = await apiClient.post<{ token?: string }>(tokenEndpoint);
      const token = tokenRes.success ? tokenRes.data.token : undefined;

      if (!token) return;

      const configuredApi = process.env.NEXT_PUBLIC_API_URL;
      const endpoint = configuredApi ? new URL(configuredApi) : new URL(window.location.origin);
      endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
      endpoint.pathname = '/ws';
      endpoint.search = `token=${encodeURIComponent(token)}`;
      const wsUrl = endpoint.toString();

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'notification' || message.type === 'pending_flush') {
            if (onNotification && message.data) {
              onNotification(message.data);
            }
            if (subscriberId && message.data?.id && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ack', notificationId: message.data.id }));
            }
          }
        } catch {
          // Parse error ignore
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current();
        }, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Token fetch error
    }
  }, [workspaceId, subscriberId, onNotification]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
}
