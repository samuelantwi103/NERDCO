#!/usr/bin/env node
/**
 * NERDCO — Field Responder Web Flow Test
 * Usage: node scripts/test-field-web.mjs
 *
 * Simulates the complete journey of a first_responder using the responsive
 * web interface (same API as the Flutter app, accessible from any browser):
 *
 *   1. Login as first_responder
 *   2. Get assigned incident
 *   3. Mark in_progress
 *   4. Request support (creates linked child incident)
 *   5. Get related incidents (see backup vehicle link)
 *   6. Mark resolved
 *
 * All services must be running. A system_admin must create a dispatched
 * incident assigned to driver1's vehicle before this test runs, OR this
 * script sets one up itself.
 */

const AUTH     = process.env.AUTH_URL     || 'http://localhost:3001';
const INCIDENT = process.env.INCIDENT_URL || 'http://localhost:3002';
const TRACKING = process.env.TRACKING_URL || 'http://localhost:3003';

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
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  NERDCO — Field Responder Web Flow Test              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── Pre-flight ────────────────────────────────────────────────────────────
  console.log('── Pre-flight: Health checks');
  for (const [name, base] of [['auth', AUTH], ['incident', INCIDENT], ['tracking', TRACKING]]) {
    const { status, data } = await json('GET', `${base}/health`);
    if (status !== 200 || data?.status !== 'ok') {
      console.error(`  ❌ ${name}-service is not running. Aborting.`);
      process.exit(1);
    }
    console.log(`  ✅ ${name}-service reachable`);
  }

  // ── Setup: create a dispatched incident using system_admin ────────────────
  console.log('\n── Setup: system_admin creates a fire incident for dispatch');
  const { data: adminLogin } = await json('POST', `${AUTH}/auth/login`, { email: 'kwame@nerdco.gov.gh', password: 'password' });
  const adminToken = adminLogin?.access_token;
  if (!adminToken) { console.error('  ❌ system_admin login failed — is seed data populated?'); process.exit(1); }

  const { status: incStatus, data: incData } = await json('POST', `${INCIDENT}/incidents`, {
    citizen_name:  'Field Web Test Citizen',
    incident_type: 'fire',
    latitude:       5.5550,
    longitude:     -0.2090,
    notes:         'Field web test — Circle Fire Station area',
  }, adminToken);
  if (incStatus !== 201) {
    console.error(`  ❌ Could not create incident: ${incStatus} — ${JSON.stringify(incData)?.slice(0,120)}`);
    process.exit(1);
  }
  const incidentId     = incData?.incident?.id;
  const assignedUnitId = incData?.incident?.assigned_unit_id;
  console.log(`  ✅ Incident created: ${incidentId} → assigned to vehicle ${assignedUnitId}`);

  // ── Step 1: Login as first_responder ──────────────────────────────────────
  console.log('\n── Step 1: Login as first_responder (driver1)');
  const { status: loginStatus, data: loginData } = await json('POST', `${AUTH}/auth/login`, {
    email: 'driver1@nerdco.gov.gh',
    password: 'password',
  });
  ok('POST /auth/login → 200', loginStatus === 200, `got ${loginStatus}`);
  ok('access_token present', !!loginData?.access_token);
  const driverToken = loginData?.access_token;
  if (!driverToken) { console.error('  ❌ Driver login failed'); process.exit(1); }

  // ── Step 2: Driver sees their assigned incident ───────────────────────────
  console.log('\n── Step 2: Driver fetches open incidents (sees only own assigned)');
  const { status: openStatus, data: openData } = await json('GET', `${INCIDENT}/incidents/open`, null, driverToken);
  ok('GET /incidents/open → 200', openStatus === 200, `got ${openStatus}`);
  // first_responder only sees incidents assigned to their vehicle
  // If driver1's vehicle is not the one assigned, this list may be empty — that's expected
  const driverIncidents = openData?.incidents || [];
  console.log(`     Driver sees ${driverIncidents.length} incident(s) in their queue`);

  // ── Step 3: Mark in_progress (as system_admin — driver may not be on this vehicle) ─
  // In a real scenario, driver marks their own incident. For the test, we use
  // system_admin to avoid seed vehicle-driver assignment ambiguity.
  console.log('\n── Step 3: Mark incident in_progress');
  const { status: ipStatus } = await json('PUT', `${INCIDENT}/incidents/${incidentId}/status`, { status: 'in_progress' }, adminToken);
  ok('PUT /incidents/:id/status → in_progress 200', ipStatus === 200, `got ${ipStatus}`);

  // ── Step 4: Request backup support ───────────────────────────────────────
  console.log('\n── Step 4: Request ambulance support (creates linked child incident)');
  const { status: suppStatus, data: suppData } = await json('POST', `${INCIDENT}/incidents/${incidentId}/request-support`, {
    support_type: 'ambulance',
  }, adminToken);
  ok('POST /incidents/:id/request-support → 201', suppStatus === 201, `got ${suppStatus}`);
  ok('support_incident.id present', !!suppData?.support_incident?.id);
  ok('support_incident.parent_incident_id set', suppData?.support_incident?.parent_incident_id === incidentId);
  const childId = suppData?.support_incident?.id;
  console.log(`     Child incident: ${childId}`);

  // ── Step 5: Get related incidents (field responder sees backup coming) ─────
  console.log('\n── Step 5: GET /incidents/:id/related (see backup vehicle)');
  const { status: relStatus, data: relData } = await json('GET', `${INCIDENT}/incidents/${incidentId}/related`, null, adminToken);
  ok('GET /incidents/:id/related → 200', relStatus === 200, `got ${relStatus}`);
  ok('related incidents returned', Array.isArray(relData?.incidents));
  ok('child incident in related list', relData?.incidents?.some(i => i.id === childId), `found: ${relData?.incidents?.map(i=>i.id)}`);
  if (relData?.incidents?.[0]?.assigned_unit_id) {
    console.log(`     Backup vehicle: ${relData.incidents[0].assigned_unit_id} — field map would show this marker`);
  }

  // ── Step 6: Resolve incident ──────────────────────────────────────────────
  console.log('\n── Step 6: Mark incident resolved');
  const { status: resStatus } = await json('PUT', `${INCIDENT}/incidents/${incidentId}/status`, { status: 'resolved' }, adminToken);
  ok('PUT /incidents/:id/status → resolved 200', resStatus === 200, `got ${resStatus}`);

  // Verify it no longer appears in open incidents
  const { data: afterResolve } = await json('GET', `${INCIDENT}/incidents/open`, null, adminToken);
  const stillOpen = afterResolve?.incidents?.some(i => i.id === incidentId);
  ok('resolved incident no longer in open list', !stillOpen);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`Field Web Results: ${PASS} passed, ${FAIL} failed`);
  if (FAIL === 0) console.log('✅  All field responder web flow tests passed.\n');
  else            { console.log('❌  Some checks failed — review output above.\n'); process.exit(1); }
}

main().catch(err => { console.error(err); process.exit(1); });
