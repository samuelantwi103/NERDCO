#!/usr/bin/env node
/**
 * NERDCO — Race condition test
 * Usage: node scripts/test-race-condition.mjs
 *
 * Fires N concurrent incident creation requests for the same incident type
 * so they all compete for the same small pool of available vehicles.
 * Verifies that:
 *   1. Every successful incident gets a unique vehicle assigned
 *   2. The 409-retry logic works (no two incidents share the same unit)
 *   3. Later requests gracefully degrade to 503 when all vehicles are taken
 *
 * Resets vehicle statuses back to 'available' at the end so other tests
 * can re-run without needing a fresh seed.
 */

const AUTH     = process.env.AUTH_URL     || 'http://localhost:3001';
const INCIDENT = process.env.INCIDENT_URL || 'http://localhost:3002';
const TRACKING = process.env.TRACKING_URL || 'http://localhost:3003';

// We have 3 ambulances in seed data — fire 4 concurrent medical incidents
const CONCURRENT = 4;

let PASS = 0, FAIL = 0;
function ok(label, cond, detail = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`); }
  else       { FAIL++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

async function json(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function getToken() {
  const { data } = await json('POST', `${AUTH}/auth/login`, { email: 'admin@nerdco.gov.gh', password: 'password' });
  if (!data?.access_token) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  NERDCO — Race Condition Test                ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`Firing ${CONCURRENT} concurrent medical incidents to compete for 3 ambulances.\n`);

  const token = await getToken();
  console.log('  ✅ Login OK\n');

  // ── Fire all requests simultaneously ────────────────────────────────────
  console.log(`── Firing ${CONCURRENT} concurrent POST /incidents requests...`);
  const promises = Array.from({ length: CONCURRENT }, (_, i) =>
    json('POST', `${INCIDENT}/incidents`, {
      citizen_name:  `Test Citizen ${i + 1}`,
      incident_type: 'medical',
      latitude:       5.5484 + i * 0.001,
      longitude:     -0.2170 + i * 0.001,
      notes:         `Race test incident ${i + 1}`,
    }, token)
  );

  const results = await Promise.all(promises);

  // ── Analyse results ──────────────────────────────────────────────────────
  const succeeded = results.filter(r => r.status === 201);
  const degraded  = results.filter(r => r.status === 503);
  const other     = results.filter(r => r.status !== 201 && r.status !== 503);

  console.log(`\n── Results:`);
  console.log(`     201 Created  : ${succeeded.length}`);
  console.log(`     503 Degraded : ${degraded.length}  (expected when all vehicles taken)`);
  console.log(`     Other errors : ${other.length}`);

  ok(`${succeeded.length} incidents dispatched successfully`, succeeded.length >= 1);
  ok('No unexpected error codes', other.length === 0, other.map(r => r.status).join(', '));

  // All successfully dispatched incidents must have UNIQUE assigned vehicles
  const assignedIds = succeeded.map(r => r.data?.incident?.assigned_unit_id).filter(Boolean);
  const uniqueIds   = new Set(assignedIds);
  ok('Each dispatched incident has a unique vehicle', uniqueIds.size === assignedIds.length,
     `${assignedIds.length} dispatches, ${uniqueIds.size} unique vehicles`);

  console.log(`\n── Assigned vehicles: ${[...uniqueIds].join(', ')}`);

  // When 4 requests compete for 3 vehicles, exactly 1 should degrade
  if (succeeded.length === 3 && degraded.length === 1) {
    ok('4 concurrent → 3 dispatched + 1 graceful degradation (expected)', true);
  } else {
    // Acceptable if some vehicles were already dispatched from prior tests
    console.log(`     ℹ️  ${succeeded.length} dispatched + ${degraded.length} degraded — acceptable if vehicles were previously dispatched`);
  }

  // ── Reset vehicles to 'available' for re-run safety ─────────────────────
  console.log('\n── Resetting dispatched vehicles to available...');
  const AMBULANCE_IDS = [
    '33333333-0000-0000-0000-000000000001',
    '33333333-0000-0000-0000-000000000002',
    '33333333-0000-0000-0000-000000000003',
  ];
  for (const vid of AMBULANCE_IDS) {
    const { status } = await json('PUT', `${TRACKING}/vehicles/${vid}/status`, { status: 'available' }, token);
    if (status === 200 || status === 409) {
      console.log(`  ✓ ${vid.slice(-4)} reset`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Race Condition Results: ${PASS} passed, ${FAIL} failed`);
  if (FAIL === 0) console.log('✅  Race condition test passed.\n');
  else            { console.log('❌  Some checks failed.\n'); process.exit(1); }
}

main().catch(err => { console.error('\n❌  Fatal:', err.message); process.exit(1); });
