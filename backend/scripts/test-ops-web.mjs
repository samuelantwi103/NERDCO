#!/usr/bin/env node
/**
 * NERDCO — Ops & Fleet Web Flow Test
 * Usage: node scripts/test-ops-web.mjs
 *
 * Mirrors the exact API calls made by the Next.js web frontend:
 *
 *   Fleet (org_admin / Ama):
 *     1. Login as ambulance org_admin
 *     2. List own vehicles  (GET /vehicles — filtered by org)
 *     3. Register new vehicle  (POST /vehicles/register)
 *     4. List users  (GET /auth/users)
 *     5. Create staff account  (POST /auth/users)
 *     6. Analytics endpoints
 *
 *   Ops (system_admin / Kwame):
 *     7. Create incident  (POST /incidents)
 *     8. List open incidents  (GET /incidents/open)
 *     9. Override dispatch  (PUT /incidents/:id/assign)
 *    10. Analytics: summary, response-times, resource-utilization, bed-utilization
 *
 * All services must be running. Run `pnpm seed` first.
 */

const AUTH      = process.env.AUTH_URL      || 'http://localhost:3001';
const INCIDENT  = process.env.INCIDENT_URL  || 'http://localhost:3002';
const TRACKING  = process.env.TRACKING_URL  || 'http://localhost:3003';
const ANALYTICS = process.env.ANALYTICS_URL || 'http://localhost:3004';

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
  console.log('║  NERDCO — Ops & Fleet Web Flow Test                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── Pre-flight ─────────────────────────────────────────────────────────────
  console.log('── Pre-flight: Health checks');
  for (const [name, base] of [['auth', AUTH], ['incident', INCIDENT], ['tracking', TRACKING], ['analytics', ANALYTICS]]) {
    const { status, data } = await json('GET', `${base}/health`);
    if (status !== 200 || data?.status !== 'ok') {
      console.error(`  ❌ ${name}-service is not running. Aborting.`);
      process.exit(1);
    }
    console.log(`  ✅ ${name}-service reachable`);
  }

  // ── PART A: Fleet flows (org_admin — Ama) ─────────────────────────────────
  console.log('\n══ PART A: Fleet Admin (org_admin) ══');

  console.log('\n── A1: Login as ambulance org_admin');
  const { status: amaLogin, data: amaData } = await json('POST', `${AUTH}/auth/login`, {
    email: 'ama@nerdco.gov.gh',
    password: 'password',
  });
  ok('POST /auth/login → 200', amaLogin === 200, `got ${amaLogin}`);
  ok('access_token present', !!amaData?.access_token);
  const amaToken = amaData?.access_token;
  if (!amaToken) { console.error('  ❌ org_admin login failed — is seed data populated?'); process.exit(1); }

  // Decode JWT to get org + org_type (same as frontend AuthContext does)
  const amaPayload = JSON.parse(Buffer.from(amaToken.split('.')[1], 'base64').toString());
  const orgId   = amaPayload.org;
  const orgType = amaPayload.org_type;
  console.log(`     org_id=${orgId}  org_type=${orgType}`);
  ok('JWT has org claim', !!orgId);
  ok('JWT has org_type claim', !!orgType);

  console.log('\n── A2: List vehicles (filtered to own org)');
  const { status: lvStatus, data: lvData } = await json('GET', `${TRACKING}/vehicles`, null, amaToken);
  ok('GET /vehicles → 200', lvStatus === 200, `got ${lvStatus}`);
  ok('vehicles array returned', Array.isArray(lvData?.vehicles));
  const initCount = lvData?.vehicles?.length ?? 0;
  console.log(`     Own org vehicles: ${initCount}`);
  // All returned vehicles should belong to this org
  if (lvData?.vehicles?.length > 0) {
    ok('all vehicles belong to own org', lvData.vehicles.every(v => v.organization_id === orgId));
    // Verify correct column names (frontend reads these)
    const v0 = lvData.vehicles[0];
    ok('vehicle has license_plate field', 'license_plate' in v0, `keys: ${Object.keys(v0).join(',')}`);
    ok('vehicle has vehicle_type field',  'vehicle_type'  in v0);
    ok('vehicle has status field',        'status'        in v0);
    ok('vehicle has last_updated field',  'last_updated'  in v0);
  }

  console.log('\n── A3: Register a new vehicle (POST /vehicles/register)');
  const testPlate = `TEST-${Date.now().toString().slice(-6)}`;
  const { status: rvStatus, data: rvData } = await json('POST', `${TRACKING}/vehicles/register`, {
    license_plate:     testPlate,
    vehicle_type:      'ambulance',
    call_sign:         'TEST-AMB',
    organization_id:   orgId,
    organization_type: orgType,
  }, amaToken);
  ok('POST /vehicles/register → 201', rvStatus === 201, `got ${rvStatus}: ${JSON.stringify(rvData)?.slice(0,120)}`);
  ok('vehicle.id present',          !!rvData?.vehicle?.id);
  ok('vehicle.license_plate matches', rvData?.vehicle?.license_plate === testPlate);
  ok('vehicle.vehicle_type = ambulance', rvData?.vehicle?.vehicle_type === 'ambulance');
  ok('vehicle.organization_id matches',  rvData?.vehicle?.organization_id === orgId);
  const newVehicleId = rvData?.vehicle?.id;
  console.log(`     Registered vehicle: ${newVehicleId}`);

  console.log('\n── A4: Verify new vehicle appears in list');
  const { data: afterReg } = await json('GET', `${TRACKING}/vehicles`, null, amaToken);
  ok('vehicle count increased by 1', (afterReg?.vehicles?.length ?? 0) === initCount + 1,
    `before=${initCount}, after=${afterReg?.vehicles?.length}`);

  console.log('\n── A5: Duplicate plate rejected (409)');
  const { status: dupStatus, data: dupData } = await json('POST', `${TRACKING}/vehicles/register`, {
    license_plate:     testPlate,
    vehicle_type:      'ambulance',
    organization_id:   orgId,
    organization_type: orgType,
  }, amaToken);
  ok('POST /vehicles/register duplicate → 409', dupStatus === 409, `got ${dupStatus}`);
  ok('error = conflict', dupData?.error === 'conflict');

  console.log('\n── A6: Invalid vehicle_type rejected (400)');
  const { status: invStatus } = await json('POST', `${TRACKING}/vehicles/register`, {
    license_plate:     `BAD-${Date.now()}`,
    vehicle_type:      'rescue',        // not a valid backend type
    organization_id:   orgId,
    organization_type: orgType,
  }, amaToken);
  ok('vehicle_type "rescue" → 400', invStatus === 400, `got ${invStatus}`);

  console.log('\n── A7: Update vehicle status');
  if (newVehicleId) {
    const { status: vsStatus } = await json('PUT', `${TRACKING}/vehicles/${newVehicleId}/status`, { status: 'unavailable' }, amaToken);
    ok('PUT /vehicles/:id/status → 200', vsStatus === 200, `got ${vsStatus}`);
  } else {
    ok('vehicle status update (skipped — no vehicle)', false);
  }

  console.log('\n── A8: List staff (GET /auth/users)');
  const { status: luStatus, data: luData } = await json('GET', `${AUTH}/auth/users`, null, amaToken);
  ok('GET /auth/users → 200', luStatus === 200, `got ${luStatus}`);
  ok('users array returned', Array.isArray(luData?.users));
  console.log(`     Staff count: ${luData?.users?.length}`);

  console.log('\n── A9: Create staff account (POST /auth/users)');
  const staffEmail = `teststaff_${Date.now()}@nerdco.gov.gh`;
  const { status: cuStatus, data: cuData } = await json('POST', `${AUTH}/auth/users`, {
    name:            'Test Paramedic',
    email:           staffEmail,
    role:            'first_responder',
    organization_id: orgId,
  }, amaToken);
  ok('POST /auth/users → 201', cuStatus === 201, `got ${cuStatus}: ${JSON.stringify(cuData)?.slice(0,80)}`);
  ok('user.id present', !!cuData?.user?.id);
  ok('user.email matches', cuData?.user?.email === staffEmail);

  console.log('\n── A10: Fleet analytics endpoints');
  const { status: faSum }  = await json('GET', `${ANALYTICS}/analytics/summary`,              null, amaToken);
  const { status: faTimes }= await json('GET', `${ANALYTICS}/analytics/response-times`,       null, amaToken);
  const { status: faUtil } = await json('GET', `${ANALYTICS}/analytics/resource-utilization`, null, amaToken);
  ok('GET /analytics/summary → 200',              faSum   === 200, `got ${faSum}`);
  ok('GET /analytics/response-times → 200',       faTimes === 200, `got ${faTimes}`);
  ok('GET /analytics/resource-utilization → 200', faUtil  === 200, `got ${faUtil}`);

  // ── PART B: Ops flows (system_admin — Kwame) ───────────────────────────────
  console.log('\n══ PART B: Ops (system_admin) ══');

  console.log('\n── B1: Login as system_admin');
  const { status: kwLogin, data: kwData } = await json('POST', `${AUTH}/auth/login`, {
    email: 'kwame@nerdco.gov.gh',
    password: 'password',
  });
  ok('POST /auth/login → 200', kwLogin === 200, `got ${kwLogin}`);
  const kwToken = kwData?.access_token;
  if (!kwToken) { console.error('  ❌ system_admin login failed'); process.exit(1); }

  console.log('\n── B2: List open incidents (GET /incidents/open)');
  const { status: openStatus, data: openData } = await json('GET', `${INCIDENT}/incidents/open`, null, kwToken);
  ok('GET /incidents/open → 200', openStatus === 200, `got ${openStatus}`);
  ok('incidents array returned', Array.isArray(openData?.incidents));

  console.log('\n── B3: Create incident (ops new-incident form)');
  const { status: ciStatus, data: ciData } = await json('POST', `${INCIDENT}/incidents`, {
    citizen_name:  'Ops Web Test',
    incident_type: 'medical',
    latitude:       5.5600,
    longitude:     -0.2100,
    location_name: 'Kaneshie Market, Accra',
    notes:         'Ops web flow test',
  }, kwToken);
  ok('POST /incidents → 201', ciStatus === 201, `got ${ciStatus}`);
  ok('incident.id present',          !!ciData?.incident?.id);
  ok('dispatch_override_window_secs present', ciData?.dispatch_override_window_secs >= 0);
  const incId      = ciData?.incident?.id;
  const assignedId = ciData?.incident?.assigned_unit_id;
  console.log(`     Incident: ${incId}  assigned to: ${assignedId}`);

  // B4: Show assigned unit + alternatives (mirrors the success box on new-incident page)
  ok('assigned_unit present OR incident queued', !!ciData?.assigned_unit || ciData?.incident?.status === 'pending');
  if (ciData?.alternative_responders) {
    console.log(`     Alternative responders: ${ciData.alternative_responders.length}`);
  }

  if (incId && ciData?.alternative_responders?.length > 0) {
    console.log('\n── B4: Override dispatch (PUT /incidents/:id/assign)');
    const altId = ciData.alternative_responders[0].id;
    const { status: ovStatus, data: ovData } = await json('PUT', `${INCIDENT}/incidents/${incId}/assign`, {
      vehicle_id: altId,
    }, kwToken);
    ok('PUT /incidents/:id/assign → 200', ovStatus === 200, `got ${ovStatus}: ${JSON.stringify(ovData)?.slice(0,80)}`);
    ok('incident.assigned_unit_id updated', ovData?.incident?.assigned_unit_id === altId);
  } else {
    console.log('\n── B4: Override dispatch (skipped — no alternatives or no incident)');
  }

  console.log('\n── B5: Full analytics suite (ops analytics page)');
  const { status: bSum,  data: bSumData }  = await json('GET', `${ANALYTICS}/analytics/summary`,              null, kwToken);
  const { status: bTimes }                 = await json('GET', `${ANALYTICS}/analytics/response-times`,       null, kwToken);
  const { status: bHeat }                  = await json('GET', `${ANALYTICS}/analytics/heatmap`,              null, kwToken);
  const { status: bUtil }                  = await json('GET', `${ANALYTICS}/analytics/resource-utilization`, null, kwToken);
  const { status: bBed }                   = await json('GET', `${ANALYTICS}/analytics/bed-utilization`,      null, kwToken);
  ok('GET /analytics/summary → 200',              bSum   === 200, `got ${bSum}`);
  ok('GET /analytics/response-times → 200',       bTimes === 200, `got ${bTimes}`);
  ok('GET /analytics/heatmap → 200',              bHeat  === 200, `got ${bHeat}`);
  ok('GET /analytics/resource-utilization → 200', bUtil  === 200, `got ${bUtil}`);
  ok('GET /analytics/bed-utilization → 200',      bBed   === 200, `got ${bBed}`);
  console.log(`     incidents_today=${bSumData?.incidents_today}  open=${bSumData?.open_incidents}  vehicles_available=${bSumData?.vehicles_available}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`Ops & Fleet Results: ${PASS} passed, ${FAIL} failed`);
  if (FAIL === 0) console.log('✅  All ops & fleet web flow tests passed.\n');
  else            { console.log('❌  Some checks failed — review output above.\n'); process.exit(1); }
}

main().catch(err => { console.error('\n❌  Fatal:', err.message); process.exit(1); });
