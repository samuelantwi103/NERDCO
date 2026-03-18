// Single responsibility: WebSocket server lifecycle and authenticated broadcast
import type { JwtAccessPayload, VehicleLocationUpdatedPayload } from '@nerdco/domain-types';

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const AUTH_TIMEOUT_MS = 5000;
const clients: Set<any> = new Set();

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error('JWT_PUBLIC_KEY is required');
  return key.replace(/\\n/g, '\n');
}

function setup(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/vehicles' });

  wss.on('connection', (ws: any) => {
    ws.authenticated = false;

    // Client must send auth message within 5 seconds or connection is closed
    const timer = setTimeout(() => {
      if (!ws.authenticated) ws.close(4001, 'Authentication timeout');
    }, AUTH_TIMEOUT_MS);

    ws.on('message', (raw) => {
      if (ws.authenticated) return;
      try {
        const { type, token } = JSON.parse(raw.toString());
        if (type !== 'auth' || !token) return ws.close(4001, 'First message must be auth');
        jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] }) as JwtAccessPayload;
        ws.authenticated = true;
        clearTimeout(timer);
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'auth_ok' }));
      } catch {
        ws.close(4001, 'Invalid token');
      }
    });

    ws.on('close', () => { clearTimeout(timer); clients.delete(ws); });
  });
}

function broadcast(payload: { type: 'vehicle.location.updated'; payload: VehicleLocationUpdatedPayload }) {
  const msg = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

module.exports = { setup, broadcast };
