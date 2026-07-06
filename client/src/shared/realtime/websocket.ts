'use client';

import { useState, useCallback } from 'react';

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

// Placeholder until Phase 2 WebSocket implementation
export function useWebSocket(subscriberId: string | null) {
  void subscriberId;
  const [notifications] = useState<Notification[]>([]);
  
  const markAllRead = useCallback(() => {
    // mock function
  }, []);
  
  return {
    notifications,
    isConnected: false,
    unreadCount: 0,
    markAllRead,
  };
}
