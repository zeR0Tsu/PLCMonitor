import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const DEFAULT_TIMEOUT = 8000;

/**
 * Socket.IO 连接 Hook
 * 所有请求使用 ack 回调，避免多个 PLC 操作共用全局事件导致结果串台
 */
export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState([]);
  const listenersRef = useRef(new Map());

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-dashboard');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] 连接错误:', err.message);
    });

    const fanOut = (event) => (payload) => {
      for (const fn of listenersRef.current.get(event) || []) {
        try { fn(payload); } catch (err) { console.error(err); }
      }
    };

    const onDataUpdate = fanOut('data-update');
    const onStatus = (statuses) => {
      setConnectionStatuses(Array.isArray(statuses) ? statuses : []);
      fanOut('connection-status')(statuses);
    };
    const onHistory = fanOut('history-data');

    socket.on('data-update', onDataUpdate);
    socket.on('connection-status', onStatus);
    socket.on('history-data', onHistory);

    return () => {
      socket.off('data-update', onDataUpdate);
      socket.off('connection-status', onStatus);
      socket.off('history-data', onHistory);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emitWithAck = useCallback((event, payload, timeout = DEFAULT_TIMEOUT) => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        resolve({ success: false, error: 'Socket 未连接' });
        return;
      }

      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ success: false, error: '操作超时' });
      }, timeout);

      socket.emit(event, payload, (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result || { success: false, error: '无响应' });
      });
    });
  }, []);

  const requestHistory = useCallback(
    (variableId, startTime, endTime) =>
      emitWithAck('request-history', { variableId, startTime, endTime }, 10000),
    [emitWithAck]
  );

  const connectPlc = useCallback(
    (plcId) => emitWithAck('connect-plc', { plcId }, 15000),
    [emitWithAck]
  );

  const disconnectPlc = useCallback(
    (plcId) => emitWithAck('disconnect-plc', { plcId }, 5000),
    [emitWithAck]
  );

  const on = useCallback((event, handler) => {
    if (!listenersRef.current.has(event)) listenersRef.current.set(event, []);
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
    requestHistory,
    connectPlc,
    disconnectPlc,
    on,
  };
}
