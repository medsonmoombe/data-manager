import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

type EventHandler = (data: any) => void;

const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL?.replace(/^http/, 'ws')?.replace(/\/api\/?$/, '') + '/events';

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const [connected, setConnected] = useState(false);
  const token = useAuthStore((s) => s.token);
  const orgId = useAuthStore((s) => s.orgId);

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }

    return () => {
      const handlers = handlersRef.current.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(event);
        }
      }
      socketRef.current?.off(event, handler);
    };
  }, []);

  const subscribeRecord = useCallback((entityType: string, recordId: string) => {
    socketRef.current?.emit('subscribe:record', { entityType, recordId });
    return () => socketRef.current?.emit('unsubscribe:record', { entityType, recordId });
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    for (const [event, handlers] of handlersRef.current) {
      for (const handler of handlers) {
        socket.on(event, handler);
      }
    }

    socketRef.current = socket;
  }, [token]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return { connected, subscribe, subscribeRecord, orgId };
}
