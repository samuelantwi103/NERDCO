#!/usr/bin/env node
/**
 * NERDCO — WebSocket live test
 * Usage: node scripts/test-websocket.mjs
 *
 * 1. Authenticates as system_admin
 * 2. Connects to ws://localhost:3003/ws/vehicles
 * 3. Sends auth message, waits for auth_ok
 * 4. Updates vehicle GR-AM-001 GPS via REST
 * 5. Verifies that vehicle.location.updated broadcast is received over WS
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const AUTH     = process.env.AUTH_URL     || 'http://localhost:3001';
const TRACKING = process.env.TRACKING_URL || 'http://localhost:3003';
const WS_URL   = process.env.WS_URL       || 'ws://localhost:3003/ws/vehicles';
const VEHICLE_ID = '33333333-0000-0000-0000-000000000001'; // GR-AM-001 from seed

let PASS = 0, FAIL = 0;
function ok(label, cond, detail = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`); }
  else       { FAIL++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

async function getToken() {
  const res  = await fetch(`${AUTH}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@nerdco.gov.gh', password: 'password' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  NERDCO — WebSocket Live Test                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const token = await getToken();
  console.log('  ✅ Login OK — token acquired');

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let authOk = false;
    let broadcastReceived = false;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Test timed out after 10s'));
    }, 10000);

    ws.on('open', () => {
      console.log('\n── Step 1: WebSocket connected');
      console.log('── Step 2: Sending auth message');
      ws.send(JSON.stringify({ type: 'auth', token }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'auth_ok' && !authOk) {
        authOk = true;
        ok('WebSocket auth_ok received', true);

        // Trigger the location update via REST — do not await here so the
        // broadcast message handler can run on the same event loop tick.
        const newLat = 5.5350 + Math.random() * 0.001;
        const newLng = -0.2260 + Math.random() * 0.001;
        console.log('\n── Step 3: PUT vehicle location via REST (GR-AM-001)');
        console.log('── Step 4: Waiting for WebSocket broadcast...');
        fetch(`${TRACKING}/vehicles/${VEHICLE_ID}/location`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ latitude: newLat, longitude: newLng }),
        }).then(res => {
          ok(`PUT /vehicles/:id/location → 200`, res.status === 200, `got ${res.status}`);
          console.log(`     New position: (${newLat.toFixed(6)}, ${newLng.toFixed(6)})`);
        });
      }

      if (msg.type === 'vehicle.location.updated' && !broadcastReceived) {
        broadcastReceived = true;
        ok('WS broadcast type = vehicle.location.updated', msg.type === 'vehicle.location.updated');
        ok('WS payload.vehicle_id matches', msg.payload?.vehicle_id === VEHICLE_ID, `got ${msg.payload?.vehicle_id}`);
        ok('WS payload has latitude', typeof msg.payload?.latitude === 'number');
        ok('WS payload has longitude', typeof msg.payload?.longitude === 'number');
        clearTimeout(timeout);
        ws.terminate(); // immediate close — no lingering handles
        resolve();
      }
    });

    ws.on('error', err => { clearTimeout(timeout); reject(err); });
    ws.on('close', (code) => {
      if (!broadcastReceived) {
        ok('WS broadcast received', false, `connection closed with code ${code} before broadcast`);
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`WebSocket Results: ${PASS} passed, ${FAIL} failed`);
  if (FAIL === 0) { console.log('✅  WebSocket test passed.\n'); process.exit(0); }
  else            { console.log('❌  Some checks failed.\n'); process.exit(1); }
}

main().catch(err => { console.error('\n❌  Fatal:', err.message); process.exit(1); });
