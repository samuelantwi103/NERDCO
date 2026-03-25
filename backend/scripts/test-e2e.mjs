#!/usr/bin/env node
/**
 * NERDCO — End-to-End scenario test
 * Usage: node scripts/test-e2e.mjs
 *
 * Scenario: Login → create medical incident → verify auto-dispatch →
 *           update status to in_progress → resolve → check analytics summary
 *
 * All services must be running before executing this script.
 */

const AUTH     = process.env.AUTH_URL     || 'http://localhost:3001';
const INCIDENT = process.env.INCIDENT_URL || 'http://localhost:3002';
const TRACKING = process.env.TRACKING_URL || 'http://localhost:3003';
const ANALYTICS= process.env.ANALYTICS_URL|| 'http://localhost:3004';

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

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  NERDCO — End-to-End Scenario Test           ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── Step 1: Health checks ────────────────────────────────────────────────
  console.log('── Step 1: Health checks');
  for (const [name, base] of [['auth', AUTH], ['incident', INCIDENT], ['tracking', TRACKING], ['analytics', ANALYTICS]]) {
    const { status, data } = await json('GET', `${base}/health`);
    ok(`${name}-service /health`, status === 200 && data?.status === 'ok');
  }

  // ── Step 2: Login ────────────────────────────────────────────────────────
  console.log('\n── Step 2: Login as system_admin');
  const { status: loginStatus, data: loginData } = await json('POST', `${AUTH}/auth/login`, {
    email: 'kwame@nerdco.gov.gh',
    password: 'password',
  });
  ok('POST /auth/login → 200', loginStatus === 200, `got ${loginStatus}`);
  ok('access_token present', !!loginData?.access_token);
  const token = loginData?.access_token;
  if (!token) { console.log('\n❌ Cannot continue without a token. Check: (1) services restarted after key update? (2) seed script run?'); process.exit(1); }

  // ── Step 3: Get profile ──────────────────────────────────────────────────
  console.log('\n── Step 3: Get profile (JWT verification)');
  const { status: profStatus, data: prof } = await json('GET', `${AUTH}/auth/profile`, null, token);
  ok('GET /auth/profile → 200', profStatus === 200, `got ${profStatus}`);
  ok('role = system_admin', prof?.role === 'system_admin');

  // ── Step 4: List vehicles (should have 10 from seed) ────────────────────
  console.log('\n── Step 4: List vehicles from tracking-service');
  const { status: vStatus, data: vData } = await json('GET', `${TRACKING}/vehicles`, null, token);
  ok('GET /vehicles → 200', vStatus === 200);
  ok('Vehicles seeded (≥ 10)', (vData?.vehicles?.length || 0) >= 10, `got ${vData?.vehicles?.length}`);

  // ── Step 5: Create incident → triggers dispatch ──────────────────────────
  console.log('\n── Step 5: Create medical incident (Makola Market, Accra)');
  const { status: incStatus, data: incData } = await json('POST', `${INCIDENT}/incidents`, {
    citizen_name:  'Kwame Mensah',
    incident_type: 'medical',
    latitude:       5.5484,
    longitude:     -0.2170,
    notes:         'E2E test — pedestrian collapsed near Makola Market',
  }, token);
  ok('POST /incidents → 201', incStatus === 201, `got ${incStatus}: ${JSON.stringify(incData)?.slice(0,120)}`);
  ok('incident.id present', !!incData?.incident?.id);
  ok('dispatch_override_window_secs = 30', incData?.dispatch_override_window_secs === 30);
  ok('assigned_unit_id present', !!incData?.incident?.assigned_unit_id);
  ok('alternative_responders returned', Array.isArray(incData?.alternative_responders));

  const incidentId = incData?.incident?.id;
  const assignedId = incData?.incident?.assigned_unit_id;
  console.log(`     Incident ID   : ${incidentId}`);
  console.log(`     Assigned unit : ${assignedId}`);
  console.log(`     Alternatives  : ${incData?.alternative_responders?.length} offered`);

  if (!incidentId) { console.log('\n❌ No incident ID — cannot continue status tests'); process.exit(1); }

  // ── Step 6: Get incident detail ──────────────────────────────────────────
  console.log('\n── Step 6: Get incident detail + status log');
  const { status: getStatus, data: getInc } = await json('GET', `${INCIDENT}/incidents/${incidentId}`, null, token);
  ok('GET /incidents/:id → 200', getStatus === 200);
  ok('status = dispatched', getInc?.incident?.status === 'dispatched', `got ${getInc?.incident?.status}`);
  ok('status_log has entries', (getInc?.status_log?.length || 0) > 0);

  // ── Step 7: Advance to in_progress ──────────────────────────────────────
  console.log('\n── Step 7: Update status → in_progress');
  const { status: ipStatus } = await json('PUT', `${INCIDENT}/incidents/${incidentId}/status`, { status: 'in_progress' }, token);
  ok('PUT /incidents/:id/status in_progress → 200', ipStatus === 200, `got ${ipStatus}`);

  // ── Step 8: Resolve incident ─────────────────────────────────────────────
  console.log('\n── Step 8: Resolve incident');
  const { status: resStatus } = await json('PUT', `${INCIDENT}/incidents/${incidentId}/status`, { status: 'resolved' }, token);
  ok('PUT /incidents/:id/status resolved → 200', resStatus === 200, `got ${resStatus}`);

  // ── Step 9: Check analytics (allow time for RabbitMQ event processing) ───
  console.log('\n── Step 9: Check analytics summary (after 2s for event processing)');
  await new Promise(r => setTimeout(r, 2000));
  const { status: aStatus, data: aData } = await json('GET', `${ANALYTICS}/analytics/summary`, null, token);
  ok('GET /analytics/summary → 200', aStatus === 200);
  ok('incidents_today ≥ 1', (aData?.incidents_today || 0) >= 1, `got ${aData?.incidents_today}`);
  console.log(`     Analytics: incidents_today=${aData?.incidents_today}, open=${aData?.open_incidents}, avg_response_secs=${aData?.avg_response_time_secs_today}, vehicles_available=${aData?.vehicles_available}`);

  // ── Step 10: Duplicate incident detection (409) ─────────────────────────
  console.log('\n── Step 10: Duplicate incident detection — same type within 200m');
  const { status: dupStatus, data: dupData } = await json('POST', `${INCIDENT}/incidents`, {
    citizen_name:  'Ama Serwaa',
    incident_type: 'medical',
    latitude:       5.5485, // ~11m from Step 5 incident (same block)
    longitude:     -0.2171,
    notes:         'E2E test — duplicate detection check',
  }, token);
  ok('POST /incidents within 200m → 409', dupStatus === 409, `got ${dupStatus}`);
  ok('error = duplicate_incident', dupData?.error === 'duplicate_incident');
  ok('existing_incident returned', !!dupData?.existing_incident?.id);

  // ── Step 11: Request support + parent_incident_id linking ─────────────
  console.log('\n── Step 11: Request support creates linked child incident');
  // Create a fresh incident for the support test
  const { data: suppParent } = await json('POST', `${INCIDENT}/incidents`, {
    citizen_name:  'Kofi Boateng',
    incident_type: 'fire',
    latitude:       5.5610,
    longitude:     -0.2050,
    notes:         'Support linkage test — fire at Nkrumah Circle',
  }, token);
  const parentId = suppParent?.incident?.id;
  if (parentId) {
    const { status: suppStatus, data: suppData } = await json('POST', `${INCIDENT}/incidents/${parentId}/request-support`, {
      support_type: 'ambulance',
    }, token);
    ok('POST /incidents/:id/request-support → 201', suppStatus === 201, `got ${suppStatus}`);
    ok('support_incident.id present', !!suppData?.support_incident?.id);
    ok('support_incident.parent_incident_id = parentId', suppData?.support_incident?.parent_incident_id === parentId);

    // ── Step 12: GET /incidents/:id/related ─────────────────────────────
    console.log('\n── Step 12: GET /incidents/:id/related returns child incidents');
    const { status: relStatus, data: relData } = await json('GET', `${INCIDENT}/incidents/${parentId}/related`, null, token);
    ok('GET /incidents/:id/related → 200', relStatus === 200, `got ${relStatus}`);
    ok('related incidents array returned', Array.isArray(relData?.incidents));
    ok('child incident in related list', relData?.incidents?.some(i => i.parent_incident_id === parentId));
  } else {
    ok('support parent incident created', false, 'skipping support tests — parent not created');
  }

  // ── Step 13: User creation (POST /auth/users) ─────────────────────────
  console.log('\n── Step 13: Admin creates a staff account');
  const testEmail = `testdriver_${Date.now()}@nerdco.gov.gh`;
  const { status: uStatus, data: uData } = await json('POST', `${AUTH}/auth/users`, {
    name:            'Test Driver',
    email:           testEmail,
    role:            'first_responder',
    organization_id: null, // system_admin creating without org restriction
  }, token);
  ok('POST /auth/users → 201', uStatus === 201, `got ${uStatus}: ${JSON.stringify(uData)?.slice(0,100)}`);
  ok('user.id present', !!uData?.user?.id);
  ok('user.email matches', uData?.user?.email === testEmail);

  // ── Step 14: List users ───────────────────────────────────────────────
  console.log('\n── Step 14: List users (system_admin sees all)');
  const { status: luStatus, data: luData } = await json('GET', `${AUTH}/auth/users`, null, token);
  ok('GET /auth/users → 200', luStatus === 200, `got ${luStatus}`);
  ok('users array returned', Array.isArray(luData?.users));
  ok('user list non-empty', (luData?.users?.length || 0) >= 1);

  // ── Step 15: Swagger endpoints reachable ──────────────────────────────
  console.log('\n── Step 15: Swagger UI reachable on all services');
  for (const [name, base] of [['auth', AUTH], ['incident', INCIDENT], ['tracking', TRACKING], ['analytics', ANALYTICS]]) {
    const { status } = await json('GET', `${base}/docs/spec.yaml`);
    ok(`${name}-service /docs/spec.yaml → 200`, status === 200, `got ${status}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`E2E Results: ${PASS} passed, ${FAIL} failed`);
  if (FAIL === 0) console.log('✅  All E2E checks passed.\n');
  else            { console.log('❌  Some checks failed — review output above.\n'); process.exit(1); }
}

main().catch(err => { console.error('\n❌  Fatal:', err.message); process.exit(1); });
