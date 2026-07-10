import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = window.location.origin;

/**
 * Socket.IO 连接 Hook
 * 管理与后端的实时通信
 */
export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState([]);
  const listenersRef = useRef(new Map());

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] 已连接');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] 已断开');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] 连接错误:', err.message);
    });

    socket.on('data-update', (data) => {
      const handlers = listenersRef.current.get('data-update') || [];
      handlers.forEach((fn) => fn(data));
    });

    socket.on('connection-status', (statuses) => {
      setConnectionStatuses(statuses);
      const handlers = listenersRef.current.get('connection-status') || [];
      handlers.forEach((fn) => fn(statuses));
    });

    socket.on('history-data', (data) => {
      const handlers = listenersRef.current.get('history-data') || [];
      handlers.forEach((fn) => fn(data));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinDashboard = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-dashboard');
    }
  }, []);

  const leaveDashboard = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-dashboard');
    }
  }, []);

  const requestHistory = useCallback((variableId, startTime, endTime) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request-history', { variableId, startTime, endTime });
    }
  }, []);

  const connectPlc = useCallback((plcId) => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) return resolve({ success: false, error: 'Socket 未连接' });
      const handler = (result) => {
        cleanup();
        resolve(result);
      };
      const cleanup = () => {
        socketRef.current?.off('connect-plc-result', handler);
      };
      socketRef.current.on('connect-plc-result', handler);
      socketRef.current.emit('connect-plc', { plcId });
      // 超时处理
      setTimeout(() => { cleanup(); resolve({ success: false, error: '连接超时' }); }, 10000);
    });
  }, []);

  const disconnectPlc = useCallback((plcId) => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) return resolve({ success: false });
      const handler = (result) => {
        cleanup();
        resolve(result);
      };
      const cleanup = () => {
        socketRef.current?.off('disconnect-plc-result', handler);
      };
      socketRef.current.on('disconnect-plc-result', handler);
      socketRef.current.emit('disconnect-plc', { plcId });
      setTimeout(() => { cleanup(); resolve({ success: true }); }, 5000);
    });
  }, []);

  const on = useCallback((event, handler) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, []);
    }
    listenersRef.current.get(event).push(handler);
    return () => {
      const handlers = listenersRef.current.get(event) || [];
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }, []);

  return {
    connected,
    connectionStatuses,
    joinDashboard,
    leaveDashboard,
    requestHistory,
    connectPlc,
    disconnectPlc,
    on,
  };
}
