'use client';
import { useEffect, useRef, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_TRACKING_URL?.replace(/^http/, 'ws');

export type WsStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Connects to the tracking-service WebSocket, authenticates with the JWT,
 * then calls `onMessage` for every broadcast received.
 *
 * Returns `status` so callers can show a connection indicator.
 * Uses exponential backoff for reconnects (1.5s → 3s → 6s → 10s max).
 */
export function useWebSocket(
  token: string | null,
  onMessage: (payload: any) => void,
): WsStatus {
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  const [status, setStatus] = useState<WsStatus>('disconnected');

  useEffect(() => {
    if (!token || !WS_URL) return;

    let destroyed = false;
    let ws: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function nextDelay() {
      const delay = Math.min(1500 * Math.pow(2, attempt), 10_000);
      attempt++;
      return delay;
    }

    function connect() {
      if (destroyed) return;
      setStatus('connecting');
      try {
        ws = new WebSocket(`${WS_URL}/ws/vehicles`);

        ws.onopen = () => {
          if (!destroyed) {
            ws!.send(JSON.stringify({ type: 'auth', token }));
          }
        };

        ws.onmessage = (event) => {
          if (destroyed) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'auth_ok') {
              attempt = 0;
              setStatus('connected');
              return;
            }
            if (msg.type === 'auth_error') {
              // Invalid/expired token — stop retrying to avoid an infinite loop;
              // the axios 401 interceptor in AuthContext will handle logout.
              destroyed = true;
              setStatus('disconnected');
              ws?.close();
              return;
            }
            cbRef.current(msg);
          } catch {}
        };

        ws.onerror = () => { /* silence — onclose handles retry */ };

        ws.onclose = () => {
          if (!destroyed) {
            setStatus('disconnected');
            retryTimeout = setTimeout(connect, nextDelay());
          }
        };
      } catch {
        if (!destroyed) {
          setStatus('disconnected');
          retryTimeout = setTimeout(connect, nextDelay());
        }
      }
    }

    connect();

    return () => {
      destroyed = true;
      setStatus('disconnected');
      if (retryTimeout) clearTimeout(retryTimeout);
      if (ws) {
        ws.onopen    = null;
        ws.onclose   = null;
        ws.onerror   = null;
        ws.onmessage = null;
        if (ws.readyState === WebSocket.CONNECTING) {
          const pending = ws;
          pending.onopen = () => pending.close();
        } else {
          ws.close();
        }
        ws = null;
      }
    };
  }, [token]);

  return status;
}
