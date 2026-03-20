#!/usr/bin/env node
/**
 * NERDCO — Authorization Regression Tests
 * Usage: node scripts/test-auth-regression.mjs
 *
 * Verifies that role and org scoping rules are enforced correctly:
 *   A) org_admin can only read incidents matching their org_type
 *   B) first_responder can only read/update incidents assigned to their vehicle
 *   C) first_responder can only see their own vehicle
 *   D) org_admin can only see vehicles in their own organisation
 *   E) first_responder cannot set "dispatched" status directly
 *
 * All services must be running before executing this script.
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
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function login(email) {
  const { status, data } = await json('POST', `${AUTH}/auth/login`, { email, password: 'password' });
  if (status !== 200 || !data?.access_token) {
    console.error(`  ❌ Login failed for ${email} — status ${status}`);
    process.exit(1);
  }
  return data.access_token;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  NERDCO — Authorization Regression Tests             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── Health checks ─────────────────────────────────────────────────────────
  console.log('── Pre-flight: Health checks');
  for (const [name, base] of [['auth', AUTH], ['incident', INCIDENT], ['tracking', TRACKING]]) {
    const { status, data } = await json('GET', `${base}/health`);
    if (status !== 200 || data?.status !== 'ok') {
      console.error(`  ❌ ${name}-service is not running. Aborting.`);
      process.exit(1);
    }
    console.log(`  ✅ ${name}-service reachable`);
  }

  // ── Login as all test actors ───────────────────────────────────────────────
  console.log('\n── Setup: Login as all test actors');
  const adminToken    = await login('admin@nerdco.gov.gh');    // system_admin
  const nasToken      = await login('ama@nerdco.gov.gh');      // org_admin — ambulance_service (NAS)
  const hospitalToken = await login('akosua@nerdco.gov.gh');   // org_admin — hospital (Korle Bu)
  const policeToken   = await login('police@nerdco.gov.gh');   // org_admin — police_station
  const fireToken     = await login('fire@nerdco.gov.gh');     // org_admin — fire_station
  const driverToken   = await login('driver1@nerdco.gov.gh');  // first_responder — NAS HQ
  console.log('  ✅ All tokens acquired');

  // ── Section A: org_admin incident type scoping ────────────────────────────
  console.log('\n── Section A: org_admin sees only their incident type');

  // Create a medical incident as NAS admin (ambulance_service org — may 503 if no vehicles, incident still saved)
  const { status: createStatus, data: createData } = await json(
    'POST', `${INCIDENT}/incidents`,
    { citizen_name: 'Test Patient', incident_type: 'medical', latitude: 5.555, longitude: -0.200, notes: 'regression test' },
    nasToken,
  );
  const medicalIncidentId = createData?.incident?.id ?? createData?.incident_id;
  ok('hospital admin creates medical incident (201 or 503)', [201, 503].includes(createStatus), `got ${createStatus}`);

  // NAS (ambulance_service) admin should be able to GET medical incidents
  if (medicalIncidentId) {
    const { status: hospGet } = await json('GET', `${INCIDENT}/incidents/${medicalIncidentId}`, null, nasToken);
    ok('NAS admin can GET medical incident → 200', hospGet === 200, `got ${hospGet}`);

    // Police admin must NOT be able to GET a medical incident
    const { status: policeGet } = await json('GET', `${INCIDENT}/incidents/${medicalIncidentId}`, null, policeToken);
    ok('police admin cannot GET medical incident → 403', policeGet === 403, `got ${policeGet}`);

    // Fire admin must NOT be able to GET a medical incident
    const { status: fireGet } = await json('GET', `${INCIDENT}/incidents/${medicalIncidentId}`, null, fireToken);
    ok('fire admin cannot GET medical incident → 403', fireGet === 403, `got ${fireGet}`);

    // system_admin must be able to GET any incident
    const { status: adminGet } = await json('GET', `${INCIDENT}/incidents/${medicalIncidentId}`, null, adminToken);
    ok('system_admin can GET any incident → 200', adminGet === 200, `got ${adminGet}`);
  } else {
    console.log('  ⚠️  No incident ID returned — skipping GET-by-ID scope checks');
    FAIL += 4;
  }

  // ── Section B: listOpen scoping ────────────────────────────────────────────
  console.log('\n── Section B: listOpen returns only matching incident types per org_admin');

  const { data: policeList } = await json('GET', `${INCIDENT}/incidents/open`, null, policeToken);
  const policeIncidents = policeList?.incidents ?? [];
  const policeSeesNonPolice = policeIncidents.some(i => !['robbery', 'crime'].includes(i.incident_type));
  ok('police admin listOpen contains only robbery/crime', !policeSeesNonPolice,
    policeSeesNonPolice ? `saw: ${[...new Set(policeIncidents.map(i => i.incident_type))].join(', ')}` : '');

  const { data: nasListData } = await json('GET', `${INCIDENT}/incidents/open`, null, nasToken);
  const nasIncidents = nasListData?.incidents ?? [];
  const nasSeesNonMedical = nasIncidents.some(i => i.incident_type !== 'medical');
  ok('NAS admin listOpen contains only medical', !nasSeesNonMedical,
    nasSeesNonMedical ? `saw: ${[...new Set(nasIncidents.map(i => i.incident_type))].join(', ')}` : '');

  const { data: fireList } = await json('GET', `${INCIDENT}/incidents/open`, null, fireToken);
  const fireIncidents = fireList?.incidents ?? [];
  const fireSeesNonFire = fireIncidents.some(i => i.incident_type !== 'fire');
  ok('fire admin listOpen contains only fire', !fireSeesNonFire,
    fireSeesNonFire ? `saw: ${[...new Set(fireIncidents.map(i => i.incident_type))].join(', ')}` : '');

  // ── Section C: first_responder incident scoping ───────────────────────────
  console.log('\n── Section C: first_responder sees only their assigned incident');

  const { data: driverList } = await json('GET', `${INCIDENT}/incidents/open`, null, driverToken);
  const driverIncidents = driverList?.incidents ?? [];
  ok('first_responder listOpen returns array', Array.isArray(driverIncidents), typeof driverIncidents);

  // Driver should NOT be able to access a medical incident not assigned to their vehicle
  if (medicalIncidentId) {
    const { status: driverGet } = await json('GET', `${INCIDENT}/incidents/${medicalIncidentId}`, null, driverToken);
    // Incident is either unassigned (403) or assigned to someone else's vehicle (403)
    ok('first_responder cannot GET unassigned/others incident → 403', driverGet === 403, `got ${driverGet}`);
  }

  // Driver cannot set "dispatched" status
  if (medicalIncidentId) {
    const { status: dispatchAttempt } = await json(
      'PUT', `${INCIDENT}/incidents/${medicalIncidentId}/status`,
      { status: 'dispatched' },
      driverToken,
    );
    ok('first_responder cannot set status=dispatched → 403', dispatchAttempt === 403, `got ${dispatchAttempt}`);
  }

  // ── Section D: vehicle list scoping ───────────────────────────────────────
  console.log('\n── Section D: vehicle list scoped by role');

  const { data: driverVehicles } = await json('GET', `${TRACKING}/vehicles`, null, driverToken);
  const driverVehicleList = driverVehicles?.vehicles ?? [];
  const driverSeesOthers = driverVehicleList.some(v => v.driver_user_id !== null && v.driver_user_id !== /* will compare dynamically */ v.driver_user_id);
  // The driver should only see vehicles assigned to them (driver_user_id = their sub)
  ok('first_responder vehicle list returns array', Array.isArray(driverVehicleList), typeof driverVehicleList);
  // All returned vehicles should belong to driver1 (or list may be empty if unassigned)
  const driverProfile = (await json('GET', `${AUTH}/auth/profile`, null, driverToken)).data;
  const driverUserId = driverProfile?.id;
  const driverSeesOnlyOwn = driverVehicleList.every(v => v.driver_user_id === driverUserId);
  ok('first_responder sees only own vehicle(s)', driverSeesOnlyOwn,
    driverSeesOnlyOwn ? '' : `saw vehicles with driver_user_ids: ${driverVehicleList.map(v => v.driver_user_id).join(', ')}`);

  const { data: policeVehicles } = await json('GET', `${TRACKING}/vehicles`, null, policeToken);
  const policeVehicleList = policeVehicles?.vehicles ?? [];
  const policeVehicleHasNonPolice = policeVehicleList.some(v => v.vehicle_type !== 'police_car');
  ok('police admin sees only police_car vehicles', !policeVehicleHasNonPolice,
    policeVehicleHasNonPolice ? `saw types: ${[...new Set(policeVehicleList.map(v => v.vehicle_type))].join(', ')}` : '');

  const { data: nasVehicles } = await json('GET', `${TRACKING}/vehicles`, null, nasToken);
  const nasVehicleList = nasVehicles?.vehicles ?? [];
  const nasSeesNonAmbulance = nasVehicleList.some(v => v.vehicle_type !== 'ambulance');
  ok('NAS admin sees only ambulance vehicles', !nasSeesNonAmbulance,
    nasSeesNonAmbulance ? `saw types: ${[...new Set(nasVehicleList.map(v => v.vehicle_type))].join(', ')}` : '');

  // ── Section E: cross-org vehicle access blocked ────────────────────────────
  console.log('\n── Section E: org_admin cannot access vehicles outside their org');

  // Get a police vehicle ID first
  const { data: adminVehicles } = await json('GET', `${TRACKING}/vehicles`, null, adminToken);
  const policeVehicle = (adminVehicles?.vehicles ?? []).find(v => v.vehicle_type === 'police_car');
  const ambulanceVehicle = (adminVehicles?.vehicles ?? []).find(v => v.vehicle_type === 'ambulance');

  if (policeVehicle && hospitalToken) {
    const { status: hospAccessPolice } = await json('GET', `${TRACKING}/vehicles/${policeVehicle.id}`, null, hospitalToken);
    ok('hospital admin cannot GET police_car vehicle → 403', hospAccessPolice === 403, `got ${hospAccessPolice}`);
  } else {
    console.log('  ⚠️  Skipping cross-org vehicle GET — no police vehicle found in seed data');
    FAIL++;
  }

  if (ambulanceVehicle && policeToken) {
    const { status: policeAccessAmbulance } = await json('GET', `${TRACKING}/vehicles/${ambulanceVehicle.id}`, null, policeToken);
    ok('police admin cannot GET NAS ambulance vehicle → 403', policeAccessAmbulance === 403, `got ${policeAccessAmbulance}`);
  } else {
    console.log('  ⚠️  Skipping cross-org vehicle GET — no ambulance vehicle found in seed data');
    FAIL++;
  }

  // ── Section F: /auth/verify requires service secret (if configured) ────────
  console.log('\n── Section F: /auth/verify is not publicly accessible');
  const { status: verifyNoSecret } = await json('GET', `${AUTH}/auth/verify`);
  // If SERVICE_INTERNAL_SECRET is set in env, expect 403. If not set (dev), expect 401 (no token).
  ok('/auth/verify not reachable without credentials', [401, 403].includes(verifyNoSecret), `got ${verifyNoSecret}`);

  // ── Final result ───────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  Total: ${PASS + FAIL}   Pass: ${PASS}   Fail: ${FAIL}`);
  if (FAIL === 0) {
    console.log('  ✅  All authorization regression tests passed.\n');
    process.exit(0);
  } else {
    console.log('  ❌  Some tests failed — review above for details.\n');
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
