// Single responsibility: WebSocket server lifecycle and authenticated broadcast
import type { JwtAccessPayload, VehicleLocationUpdatedPayload } from '@nerdco/domain-types';

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const AUTH_TIMEOUT_MS  = 5000;
const PING_INTERVAL_MS = 30_000;

interface AuthedClient {
  ws: any;
  userId: string;
  role: string;
  orgId: string | null;
}

const clients: Set<AuthedClient> = new Set();

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error('JWT_PUBLIC_KEY is required');
  return key.replace(/\\n/g, '\n');
}

function setup(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/vehicles' });

  // Server-side heartbeat: ping all authenticated clients every 30s.
  // Clients that don't respond with pong within the next cycle are terminated.
  setInterval(() => {
    for (const client of clients) {
      if (client.ws.readyState !== 1) continue;
      if (client.ws._pingPending) {
        client.ws.terminate(); // no pong received since last ping
        clients.delete(client);
      } else {
        client.ws._pingPending = true;
        client.ws.ping();
      }
    }
  }, PING_INTERVAL_MS);

  wss.on('connection', (ws: any) => {
    ws.authenticated = false;
    ws._pingPending  = false;

    ws.on('pong', () => { ws._pingPending = false; });

    // Client must send auth message within 5 seconds or connection is closed
    const timer = setTimeout(() => {
      if (!ws.authenticated) ws.close(4001, 'Authentication timeout');
    }, AUTH_TIMEOUT_MS);

    let clientRef: AuthedClient | null = null;

    ws.on('message', (raw) => {
      const msg = (() => { try { return JSON.parse(raw.toString()); } catch { return null; } })();
      if (!msg) return;

      if (!ws.authenticated) {
        // First message must be auth
        if (msg.type !== 'auth' || !msg.token) return ws.close(4001, 'First message must be auth');
        try {
          const payload = jwt.verify(msg.token, getPublicKey(), { algorithms: ['RS256'] }) as JwtAccessPayload;
          ws.authenticated = true;
          clearTimeout(timer);
          clientRef = { ws, userId: payload.sub, role: payload.role, orgId: payload.org ?? null };
          clients.add(clientRef);
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        } catch {
          ws.close(4001, 'Invalid token');
        }
        return;
      }

      // Authenticated client messages (ping / future control messages)
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (clientRef) clients.delete(clientRef);
    });
  });
}

function canReceiveBroadcast(client: AuthedClient, orgId: string | null): boolean {
  if (client.role === 'system_admin') return true;
  if (orgId === null) return true; // unscoped broadcast goes to all
  return client.orgId === orgId;
}

function broadcast(payload: { type: 'vehicle.location.updated'; payload: VehicleLocationUpdatedPayload }) {
  const msg = JSON.stringify(payload);
  const orgId = (payload.payload as any).organization_id ?? null;
  for (const client of clients) {
    if (client.ws.readyState === 1 && canReceiveBroadcast(client, orgId)) {
      client.ws.send(msg);
    }
  }
}

module.exports = { setup, broadcast };
