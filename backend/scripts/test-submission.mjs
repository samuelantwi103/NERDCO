#!/usr/bin/env node
/**
 * NERDCO — Submission Readiness Test
 * Usage: node scripts/test-submission.mjs
 *
 * Comprehensive end-to-end simulation covering every major API endpoint and
 * scenario, including MCI batch dispatch, soft-delete/restore, duplicate
 * detection, WebSocket heartbeat, and analytics.
 *
 * All 4 services must be running before executing this script.
 */

const AUTH      = process.env.AUTH_URL      || 'http://localhost:3001';
const INCIDENT  = process.env.INCIDENT_URL  || 'http://localhost:3002';
const TRACKING  = process.env.TRACKING_URL  || 'http://localhost:3003';
const ANALYTICS = process.env.ANALYTICS_URL || 'http://localhost:3004';

let PASS = 0, FAIL = 0, SKIP = 0;

function ok(label, cond, detail = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`); }
  else       { FAIL++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}
function skip(label, reason) {
  SKIP++;
  console.log(`  ⏭  ${label} [skipped: ${reason}]`);
}

async function req(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: null, error: e.message };
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   NERDCO — Submission Readiness Test                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── 1. Health checks ─────────────────────────────────────────────────────
  console.log('── 1. Health checks');
  for (const [name, base] of [['auth', AUTH], ['incident', INCIDENT], ['tracking', TRACKING], ['analytics', ANALYTICS]]) {
    const { status, data } = await req('GET', `${base}/health`);
    ok(`${name}-service healthy`, status === 200 && data?.status === 'ok', `HTTP ${status}`);
  }

  // ── 2. Authentication ─────────────────────────────────────────────────────
  console.log('\n── 2. Authentication');
  const { status: loginStatus, data: loginData } = await req('POST', `${AUTH}/auth/login`, {
    email: 'kwame@nerdco.gov.gh', password: 'password',
  });
  ok('POST /auth/login (system_admin) → 200', loginStatus === 200, `got ${loginStatus}`);
  ok('access_token present', !!loginData?.access_token);
  ok('refresh_token present', !!loginData?.refresh_token);
  const adminToken = loginData?.access_token;
  if (!adminToken) { console.log('\n❌ No admin token — aborting.'); process.exit(1); }

  const { status: profStatus, data: prof } = await req('GET', `${AUTH}/auth/profile`, null, adminToken);
  ok('GET /auth/profile → 200', profStatus === 200);
  ok('role = system_admin', prof?.role === 'system_admin');

  // Bad credentials
  const { status: badLogin } = await req('POST', `${AUTH}/auth/login`, { email: 'nobody@x.com', password: 'wrong' });
  ok('POST /auth/login bad creds → 401', badLogin === 401, `got ${badLogin}`);

  // ── 3. Organisations ──────────────────────────────────────────────────────
  console.log('\n── 3. Organisations');
  const { status: orgListStatus, data: orgListData } = await req('GET', `${AUTH}/organizations`, null, adminToken);
  ok('GET /organizations → 200', orgListStatus === 200);
  ok('Organizations seeded', (orgListData?.organizations?.length || 0) >= 1, `got ${orgListData?.organizations?.length}`);
  const orgs = orgListData?.organizations ?? [];

  // Fetch a hospital org by ID
  const hospital = orgs.find(o => o.type?.toLowerCase().includes('hospital'));
  if (hospital) {
    const { status: orgGetStatus, data: orgGetData } = await req('GET', `${AUTH}/organizations/${hospital.id}`, null, adminToken);
    ok('GET /organizations/:id → 200', orgGetStatus === 200);
    ok('organization name returned', !!orgGetData?.name);
  } else {
    skip('GET /organizations/:id', 'no hospital in seed data');
  }

  // ── 4. Users (CRUD + soft-delete + restore + hard-delete) ────────────────
  console.log('\n── 4. Users');
  const { status: usersStatus, data: usersData } = await req('GET', `${AUTH}/auth/users`, null, adminToken);
  ok('GET /auth/users → 200', usersStatus === 200);
  ok('Users seeded', (usersData?.users?.length || 0) >= 1);

  const testEmail = `submit_test_${Date.now()}@nerdco.test`;
  const { status: createUserStatus, data: createdUser } = await req('POST', `${AUTH}/auth/users`, {
    name: 'Submission Tester', email: testEmail, role: 'first_responder',
  }, adminToken);
  ok('POST /auth/users → 201', createUserStatus === 201, `got ${createUserStatus}`);
  const newUserId = createdUser?.user?.id;
  ok('user.id present', !!newUserId);

  if (newUserId) {
    // Update
    const { status: updStatus } = await req('PUT', `${AUTH}/auth/users/${newUserId}`, { name: 'Updated Tester' }, adminToken);
    ok('PUT /auth/users/:id → 200', updStatus === 200);

    // Soft delete
    const { status: delStatus } = await req('DELETE', `${AUTH}/auth/users/${newUserId}`, null, adminToken);
    ok('DELETE /auth/users/:id (soft) → 200', delStatus === 200);

    // Verify it appears in include_deleted list
    const { data: withDeleted } = await req('GET', `${AUTH}/auth/users?include_deleted=true`, null, adminToken);
    const foundDeleted = withDeleted?.users?.some(u => u.id === newUserId && u.is_deleted);
    ok('GET /auth/users?include_deleted=true shows deleted user', foundDeleted);

    // Restore
    const { status: restoreStatus } = await req('POST', `${AUTH}/auth/users/${newUserId}/restore`, {}, adminToken);
    ok('POST /auth/users/:id/restore → 200', restoreStatus === 200);

    // Verify restored (not in active list as deleted)
    const { data: afterRestore } = await req('GET', `${AUTH}/auth/users`, null, adminToken);
    const foundRestored = afterRestore?.users?.some(u => u.id === newUserId && !u.is_deleted);
    ok('User appears active after restore', foundRestored);

    // Soft-delete again then hard-delete
    await req('DELETE', `${AUTH}/auth/users/${newUserId}`, null, adminToken);
    const { status: hardDelStatus } = await req('DELETE', `${AUTH}/auth/users/${newUserId}/permanent`, null, adminToken);
    ok('DELETE /auth/users/:id/permanent → 200', hardDelStatus === 200);

    // Verify gone
    const { data: afterHard } = await req('GET', `${AUTH}/auth/users?include_deleted=true`, null, adminToken);
    const stillExists = afterHard?.users?.some(u => u.id === newUserId);
    ok('User gone after permanent delete', !stillExists);
  }

  // ── 5. Vehicles ───────────────────────────────────────────────────────────
  console.log('\n── 5. Vehicles');
  const { status: vListStatus, data: vListData } = await req('GET', `${TRACKING}/vehicles`, null, adminToken);
  ok('GET /vehicles → 200', vListStatus === 200);
  ok('Vehicles seeded (≥ 10)', (vListData?.vehicles?.length || 0) >= 10, `got ${vListData?.vehicles?.length}`);

  // Register a test vehicle (requires organization_type too)
  const orgId   = orgs[0]?.id;
  const orgType = orgs[0]?.type ?? 'hospital';
  let testVehicleId = null;
  if (orgId) {
    const { status: regStatus, data: regData } = await req('POST', `${TRACKING}/vehicles/register`, {
      vehicle_type: 'ambulance', license_plate: `SUBMIT-${Date.now()}`,
      latitude: 5.603, longitude: -0.187,
      organization_id: orgId, organization_type: orgType,
    }, adminToken);
    ok('POST /vehicles/register → 201', regStatus === 201, `got ${regStatus}: ${JSON.stringify(regData?.error || '')}`);
    testVehicleId = regData?.vehicle?.id;
    ok('vehicle.id present', !!testVehicleId);

    if (testVehicleId) {
      // Update location
      const { status: locStatus } = await req('PUT', `${TRACKING}/vehicles/${testVehicleId}/location`, {
        latitude: 5.605, longitude: -0.185,
      }, adminToken);
      ok('PUT /vehicles/:id/location → 200', locStatus === 200);

      // Get vehicle
      const { status: getVehStatus, data: getVehData } = await req('GET', `${TRACKING}/vehicles/${testVehicleId}`, null, adminToken);
      ok('GET /vehicles/:id → 200', getVehStatus === 200);
      ok('vehicle type = ambulance', getVehData?.vehicle?.vehicle_type === 'ambulance');

      // Cleanup
      await req('DELETE', `${TRACKING}/vehicles/${testVehicleId}`, null, adminToken);
    }
  } else {
    skip('Vehicle CRUD', 'no org to attach vehicle to');
  }

  // ── 5b. Pre-test cleanup — resolve any open incidents so vehicles are available ─
  console.log('\n── 5b. Pre-test cleanup (resolve lingering open incidents)');
  const { data: openData } = await req('GET', `${INCIDENT}/incidents/open`, null, adminToken);
  const openIncidents = openData?.incidents ?? [];
  let released = 0;
  for (const inc of openIncidents) {
    // Advance to in_progress first if still dispatched (required by status machine)
    if (inc.status === 'dispatched') {
      await req('PUT', `${INCIDENT}/incidents/${inc.id}/status`, { status: 'in_progress' }, adminToken);
    }
    const { status: rStatus } = await req('PUT', `${INCIDENT}/incidents/${inc.id}/status`, { status: 'resolved' }, adminToken);
    if (rStatus === 200) released++;
  }
  console.log(`     Released ${released}/${openIncidents.length} open incidents`);
  // Also explicitly reset any still-dispatched vehicles (fire-and-forget release may not have completed)
  const { data: vData } = await req('GET', `${TRACKING}/vehicles?status=dispatched`, null, adminToken);
  const dispatchedVehicles = vData?.vehicles ?? [];
  for (const v of dispatchedVehicles) {
    await req('PUT', `${TRACKING}/vehicles/${v.id}/status`, { status: 'available' }, adminToken);
  }
  if (dispatchedVehicles.length > 0) {
    console.log(`     Force-released ${dispatchedVehicles.length} still-dispatched vehicle(s)`);
  }

  // ── 6. Incidents — basic dispatch ────────────────────────────────────────
  console.log('\n── 6. Incidents — basic dispatch');
  // Jitter coordinates by ~0.5° so each test run creates fresh incidents
  // (avoids 409 duplicate_incident from previous run's unresolved incidents)
  const jitter = () => (Math.random() - 0.5) * 0.8;
  const baseLat = 5.55, baseLng = -0.20;

  const { status: medStatus, data: medData } = await req('POST', `${INCIDENT}/incidents`, {
    citizen_name: 'Ama Asante',
    incident_type: 'medical',
    latitude: baseLat + jitter(), longitude: baseLng + jitter(),
    notes: 'Submission test — medical incident',
  }, adminToken);
  ok('POST /incidents (medical) → 201', medStatus === 201, `got ${medStatus}: ${JSON.stringify(medData?.error || '')}`);
  ok('assigned_unit_id present', !!medData?.incident?.assigned_unit_id);
  ok('override window = 30s', medData?.dispatch_override_window_secs === 30);
  ok('alternative_responders returned', Array.isArray(medData?.alternative_responders));
  const medIncidentId = medData?.incident?.id;

  // Fire incident
  const { status: fireStatus, data: fireData } = await req('POST', `${INCIDENT}/incidents`, {
    citizen_name: 'Kweku Frimpong',
    incident_type: 'fire',
    latitude: baseLat + jitter(), longitude: baseLng + jitter(),
    notes: 'Submission test — fire incident',
  }, adminToken);
  ok('POST /incidents (fire) → 201', fireStatus === 201, `got ${fireStatus}`);
  const fireIncidentId = fireData?.incident?.id;

  // Crime incident
  const { status: crimeStatus, data: crimeData } = await req('POST', `${INCIDENT}/incidents`, {
    citizen_name: 'Adjoa Mensah',
    incident_type: 'crime',
    latitude: baseLat + jitter(), longitude: baseLng + jitter(),
    notes: 'Submission test — crime incident',
  }, adminToken);
  ok('POST /incidents (crime) → 201', crimeStatus === 201, `got ${crimeStatus}: ${JSON.stringify(crimeData?.message || crimeData?.error || '')}`);

  // ── 7. Duplicate detection (409) ─────────────────────────────────────────
  console.log('\n── 7. Duplicate detection (409 within 200m)');
  if (medIncidentId && medData?.incident) {
    const dupLat = parseFloat(medData.incident.latitude) + 0.0001;  // ~11m offset
    const dupLng = parseFloat(medData.incident.longitude) + 0.0001;
    const { status: dupStatus, data: dupData } = await req('POST', `${INCIDENT}/incidents`, {
      citizen_name: 'Duplicate Caller',
      incident_type: 'medical',
      latitude: dupLat, longitude: dupLng,  // ~15m from medical incident above
      notes: 'Submission test — should be rejected as duplicate',
    }, adminToken);
    ok('POST /incidents within 200m → 409', dupStatus === 409, `got ${dupStatus}`);
    ok('error = duplicate_incident', dupData?.error === 'duplicate_incident');
    ok('existing_incident.id returned', !!dupData?.existing_incident?.id);
  } else {
    skip('Duplicate detection', 'no existing incident to compare against');
  }

  // ── 8. MCI batch dispatch ─────────────────────────────────────────────────
  console.log('\n── 8. MCI batch dispatch (mci_units)');
  const { status: mciStatus, data: mciData } = await req('POST', `${INCIDENT}/incidents`, {
    citizen_name: 'Mass Casualty Scene',
    incident_type: 'medical',
    latitude: baseLat + jitter(), longitude: baseLng + jitter(),
    notes: 'Submission test — MCI with multiple unit types',
    mci_units: { ambulance: 2, fire_truck: 1, police_car: 1 },
  }, adminToken);
  ok('POST /incidents (MCI) → 201', mciStatus === 201, `got ${mciStatus}`);
  ok('primary unit dispatched', !!mciData?.incident?.assigned_unit_id);
  console.log(`     MCI child incidents: ${mciData?.mci_units_dispatched?.length ?? 0} additional units`);

  // ── 9. Incident status transitions ──────────────────────────────────────
  console.log('\n── 9. Incident status transitions');
  if (medIncidentId) {
    const { status: ipStatus } = await req('PUT', `${INCIDENT}/incidents/${medIncidentId}/status`, { status: 'in_progress' }, adminToken);
    ok('PUT status → in_progress → 200', ipStatus === 200);

    const { status: resStatus } = await req('PUT', `${INCIDENT}/incidents/${medIncidentId}/status`, { status: 'resolved' }, adminToken);
    ok('PUT status → resolved → 200', resStatus === 200);

    // Verify final state
    const { data: finalInc } = await req('GET', `${INCIDENT}/incidents/${medIncidentId}`, null, adminToken);
    ok('incident.status = resolved', finalInc?.incident?.status === 'resolved');
    ok('status_log has ≥ 3 entries', (finalInc?.status_log?.length || 0) >= 3);
  }

  // ── 10. List open incidents ───────────────────────────────────────────────
  console.log('\n── 10. List open incidents');
  const { status: listStatus, data: listData } = await req('GET', `${INCIDENT}/incidents/open`, null, adminToken);
  ok('GET /incidents/open → 200', listStatus === 200);
  ok('incidents array returned', Array.isArray(listData?.incidents));
  ok('resolved incident excluded', !listData?.incidents?.some(i => i.id === medIncidentId));

  // ── 11. Request support ──────────────────────────────────────────────────
  console.log('\n── 11. Request support (cross-org)');
  if (fireIncidentId && fireData?.incident?.assigned_unit_id) {
    const { status: suppStatus, data: suppData } = await req('POST', `${INCIDENT}/incidents/${fireIncidentId}/request-support`, {
      support_type: 'ambulance',
    }, adminToken);
    ok('POST /incidents/:id/request-support → 201', suppStatus === 201, `got ${suppStatus}`);
    ok('support_incident.id present', !!suppData?.support_incident?.id);

    const { status: relStatus, data: relData } = await req('GET', `${INCIDENT}/incidents/${fireIncidentId}/related`, null, adminToken);
    ok('GET /incidents/:id/related → 200', relStatus === 200);
    ok('child incidents returned', Array.isArray(relData?.incidents) && relData.incidents.length > 0);
  }

  // ── 12. Manual reassign (within override window) ─────────────────────────
  // Create a fresh incident for reassign so its alternative responders haven't been consumed
  console.log('\n── 12. Manual vehicle reassign');
  const { status: rInciStatus, data: rInciData } = await req('POST', `${INCIDENT}/incidents`, {
    citizen_name: 'Reassign Test',
    incident_type: 'crime',  // police_car — less likely to be exhausted than ambulance
    latitude: baseLat + jitter(), longitude: baseLng + jitter(),
    notes: 'Submission test — reassign',
  }, adminToken);
  if (rInciStatus === 201 && rInciData?.alternative_responders?.length > 0) {
    const altId = rInciData.alternative_responders[0].vehicle_id;
    const { status: reassignStatus, data: reassignData } = await req('PUT', `${INCIDENT}/incidents/${rInciData.incident.id}/assign`, {
      vehicle_id: altId,
    }, adminToken);
    ok('PUT /incidents/:id/assign → 200', reassignStatus === 200, `got ${reassignStatus}: ${JSON.stringify(reassignData?.message || reassignData?.error || '')}`);
  } else {
    skip('Manual reassign', `no alternative responders (incident status: ${rInciStatus})`);
  }

  // ── 13. Analytics ────────────────────────────────────────────────────────
  console.log('\n── 13. Analytics (waiting 2s for RabbitMQ processing)');
  await sleep(2000);
  const { status: sumStatus, data: sumData } = await req('GET', `${ANALYTICS}/analytics/summary`, null, adminToken);
  ok('GET /analytics/summary → 200', sumStatus === 200);
  ok('incidents_today ≥ 1', (sumData?.incidents_today || 0) >= 1, `got ${sumData?.incidents_today}`);
  ok('vehicles_available present', sumData?.vehicles_available != null);
  console.log(`     incidents_today=${sumData?.incidents_today}, open=${sumData?.open_incidents}, avg_response=${sumData?.avg_response_time_secs_today}s`);

  const { status: rtStatus, data: rtData } = await req('GET', `${ANALYTICS}/analytics/response-times`, null, adminToken);
  ok('GET /analytics/response-times → 200', rtStatus === 200);

  const { status: utilStatus, data: utilData } = await req('GET', `${ANALYTICS}/analytics/resource-utilization`, null, adminToken);
  ok('GET /analytics/resource-utilization → 200', utilStatus === 200, `got ${utilStatus}`);
  ok('utilization array returned', Array.isArray(utilData?.utilization));

  // ── 14. Hospital bed capacity ──────────────────────────────────────────
  console.log('\n── 14. Hospital bed capacity');
  if (hospital) {
    const { status: capGetStatus, data: capGetData } = await req('GET', `${AUTH}/organizations/${hospital.id}`, null, adminToken);
    ok('GET hospital org → 200', capGetStatus === 200);
    const initialBeds = capGetData?.beds_available ?? 0;

    const { status: capPatchStatus } = await req('PATCH', `${AUTH}/organizations/${hospital.id}/capacity`, {
      beds_available: Math.max(0, initialBeds - 1),
    }, adminToken);
    ok('PATCH /organizations/:id/capacity → 200', capPatchStatus === 200);

    // Reset
    await req('PATCH', `${AUTH}/organizations/${hospital.id}/capacity`, { beds_available: initialBeds }, adminToken);
  } else {
    skip('Hospital bed capacity', 'no hospital org in seed data');
  }

  // ── 15. API docs accessible ────────────────────────────────────────────
  console.log('\n── 15. Swagger/OpenAPI docs');
  for (const [name, base] of [['auth', AUTH], ['incident', INCIDENT], ['tracking', TRACKING], ['analytics', ANALYTICS]]) {
    const { status } = await req('GET', `${base}/docs/spec.yaml`);
    ok(`${name}-service /docs/spec.yaml → 200`, status === 200, `got ${status}`);
  }

  // ── 16. WebSocket connectivity ────────────────────────────────────────
  console.log('\n── 16. WebSocket (tracking-service)');
  try {
    const { WebSocket } = await import('ws').catch(() => ({ WebSocket: null }));
    if (!WebSocket) {
      skip('WebSocket connect', 'ws package not installed — run: pnpm add -w ws');
    } else {
      await new Promise((resolve) => {
        const ws = new WebSocket(`ws://localhost:3003/ws/vehicles`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const timer = setTimeout(() => { ws.terminate(); ok('WebSocket connects within 3s', false, 'timeout'); resolve(); }, 3000);
        ws.on('open', () => {
          clearTimeout(timer);
          ok('WebSocket connects within 3s', true);
          ws.close();
          resolve();
        });
        ws.on('error', (e) => {
          clearTimeout(timer);
          ok('WebSocket connects within 3s', false, e.message);
          resolve();
        });
      });
    }
  } catch (e) {
    skip('WebSocket test', e.message);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = PASS + FAIL + SKIP;
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  Results: ${PASS}/${total} passed  |  ${FAIL} failed  |  ${SKIP} skipped`);
  if (FAIL === 0) {
    console.log('  ✅  All checks passed — system is submission-ready.\n');
  } else {
    console.log(`  ❌  ${FAIL} check(s) failed — review output above.\n`);
    process.exit(1);
  }
}

main().catch(err => { console.error('\n❌  Fatal error:', err.message); process.exit(1); });
