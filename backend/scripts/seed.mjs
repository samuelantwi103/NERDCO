#!/usr/bin/env node
/**
 * NERDCO — Seed Script
 * Usage: pnpm seed   (from backend/)
 *
 * Org hierarchy:
 *   system_admin (call centre) — no org
 *   NAS HQ (ambulance_service) — Ama + Driver 1
 *   Korle Bu Teaching Hospital (hospital) — Akosua
 *   37 Military Hospital (hospital) — own admin
 *   Kaneshie Police Station (police_station) — own admin
 *   Madina Police Station (police_station) — own admin
 *   Circle Fire Station (fire_station) — own admin
 *   Accra Fire Station (fire_station) — own admin
 *
 * Police & fire: simplified — station admins manage everything, no first_responder accounts.
 * Safe to re-run — INSERT ... ON CONFLICT DO NOTHING.
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const pg      = require('pg');
const bcrypt  = require('bcryptjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

function loadEnv(serviceName) {
  const envPath = path.join(ROOT, serviceName, '.env');
  const raw = readFileSync(envPath, 'utf8');
  const result = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val   = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    result[key] = val;
  }
  return result;
}

function pool(connectionString) {
  return new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
}

// ── Fixed UUIDs so vehicles can reference orgs cross-service ─────────────────
const ORG = {
  nas:             '11111111-0000-0000-0000-000000000001',
  korlebu:         '11111111-0000-0000-0000-000000000002',
  military:        '11111111-0000-0000-0000-000000000003',
  kaneshie_police: '11111111-0000-0000-0000-000000000004',
  madina_police:   '11111111-0000-0000-0000-000000000005',
  circle_fire:     '11111111-0000-0000-0000-000000000006',
  accra_fire:      '11111111-0000-0000-0000-000000000007',
};

const USER = {
  kwame:           '22222222-0000-0000-0000-000000000001', // system_admin (call centre senior)
  efua:            '22222222-0000-0000-0000-000000000002', // system_admin (call centre operator)
  ama:             '22222222-0000-0000-0000-000000000003', // org_admin — NAS HQ
  akosua:          '22222222-0000-0000-0000-000000000004', // org_admin — Korle Bu
  military_admin:  '22222222-0000-0000-0000-000000000005', // org_admin — 37 Military Hospital
  kaneshie_police: '22222222-0000-0000-0000-000000000006', // org_admin — Kaneshie Police Station
  madina_police:   '22222222-0000-0000-0000-000000000007', // org_admin — Madina Police Station
  circle_fire:     '22222222-0000-0000-0000-000000000008', // org_admin — Circle Fire Station
  accra_fire:      '22222222-0000-0000-0000-000000000009', // org_admin — Accra Fire Station
  driver:          '22222222-0000-0000-0000-000000000010', // first_responder — NAS HQ
};

// ── seed auth_db ─────────────────────────────────────────────────────────────
async function seedAuth(db) {
  console.log('\n[auth_db] Seeding organisations...');
  await db.query(`
    INSERT INTO organizations (id, name, type, latitude, longitude, address, beds_available, beds_total, capabilities)
    VALUES
      ($1,  'National Ambulance Service HQ', 'ambulance_service', 5.5717, -0.1969, 'Liberation Rd, Accra',           0,  0, '{}'),
      ($2,  'Korle Bu Teaching Hospital',    'hospital',          5.5370, -0.2284, 'Guggisberg Ave, Accra',          45, 50, '{"Trauma","Burn Center","Pediatrics"}'),
      ($3,  '37 Military Hospital',          'hospital',          5.5842, -0.1907, 'Liberation Rd, Accra',           30, 35, '{"Trauma","Surgery","Orthopedics"}'),
      ($4,  'Kaneshie Police Station',       'police_station',    5.5490, -0.2290, 'Kaneshie, Accra',                 0,  0, '{}'),
      ($5,  'Madina Police Station',         'police_station',    5.6680,  0.0030, 'Madina, Accra',                   0,  0, '{}'),
      ($6,  'Circle Fire Station',           'fire_station',      5.5570, -0.2063, 'Kwame Nkrumah Circle, Accra',     0,  0, '{}'),
      ($7,  'Accra Fire Station',            'fire_station',      5.5532, -0.2063, 'Castle Rd, Accra',                0,  0, '{}')
    ON CONFLICT (id) DO NOTHING
  `, [ORG.nas, ORG.korlebu, ORG.military, ORG.kaneshie_police, ORG.madina_police, ORG.circle_fire, ORG.accra_fire]);
  console.log('  ✓ 7 organisations');

  // Remove any users that would conflict on email (handles re-seeding after schema changes)
  await db.query(`DELETE FROM users WHERE email = ANY($1)`, [[
    'kwame@nerdco.gov.gh', 'efua@nerdco.gov.gh', 'ama@nerdco.gov.gh', 'akosua@nerdco.gov.gh',
    'military@nerdco.gov.gh', 'kaneshie@nerdco.gov.gh', 'madina@nerdco.gov.gh',
    'circle@nerdco.gov.gh', 'accrafire@nerdco.gov.gh', 'driver1@nerdco.gov.gh',
  ]]);

  const PW = await bcrypt.hash('password', 12);
  console.log('[auth_db] Seeding users...');
  await db.query(`
    INSERT INTO users (id, name, email, password_hash, role, organization_id)
    VALUES
      ($1,  'Kwame — Ops Centre',           'kwame@nerdco.gov.gh',          $11, 'system_admin',    NULL),
      ($2,  'Efua — Call Centre',           'efua@nerdco.gov.gh',           $11, 'system_admin',    NULL),
      ($3,  'Ama — NAS Fleet Admin',        'ama@nerdco.gov.gh',            $11, 'org_admin',       $12),
      ($4,  'Akosua — Korle Bu Admin',      'akosua@nerdco.gov.gh',         $11, 'org_admin',       $13),
      ($5,  '37 Military Admin',            'military@nerdco.gov.gh',       $11, 'org_admin',       $14),
      ($6,  'Kaneshie Police Admin',        'kaneshie@nerdco.gov.gh',       $11, 'org_admin',       $15),
      ($7,  'Madina Police Admin',          'madina@nerdco.gov.gh',         $11, 'org_admin',       $16),
      ($8,  'Circle Fire Admin',            'circle@nerdco.gov.gh',         $11, 'org_admin',       $17),
      ($9,  'Accra Fire Admin',             'accrafire@nerdco.gov.gh',      $11, 'org_admin',       $18),
      ($10, 'Ambulance Driver 1',           'driver1@nerdco.gov.gh',        $11, 'first_responder', $12)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
      organization_id = EXCLUDED.organization_id
  `, [
    USER.kwame, USER.efua, USER.ama, USER.akosua, USER.military_admin,
    USER.kaneshie_police, USER.madina_police, USER.circle_fire, USER.accra_fire, USER.driver,
    PW,
    ORG.nas, ORG.korlebu, ORG.military, ORG.kaneshie_police,
    ORG.madina_police, ORG.circle_fire, ORG.accra_fire,
  ]);
  console.log('  ✓ 10 users (all passwords: "password")');
}

// ── seed tracking_db ──────────────────────────────────────────────────────────
async function seedTracking(db) {
  console.log('\n[tracking_db] Seeding vehicles...');

  const vehicles = [
    // Ambulances — National Ambulance Service
    { id: '33333333-0000-0000-0000-000000000001', org: ORG.nas,             org_type: 'ambulance_service', type: 'ambulance',  plate: 'GR-AM-001', lat: 5.5340, lng: -0.2270 },
    { id: '33333333-0000-0000-0000-000000000002', org: ORG.nas,             org_type: 'ambulance_service', type: 'ambulance',  plate: 'GR-AM-002', lat: 5.5740, lng: -0.1670 },
    { id: '33333333-0000-0000-0000-000000000003', org: ORG.nas,             org_type: 'ambulance_service', type: 'ambulance',  plate: 'GR-AM-003', lat: 5.5717, lng: -0.1969 },
    // Police cars — Kaneshie Police Station
    { id: '33333333-0000-0000-0000-000000000004', org: ORG.kaneshie_police, org_type: 'police_station',    type: 'police_car', plate: 'GR-PC-001', lat: 5.5490, lng: -0.2290 },
    { id: '33333333-0000-0000-0000-000000000005', org: ORG.kaneshie_police, org_type: 'police_station',    type: 'police_car', plate: 'GR-PC-002', lat: 5.5450, lng: -0.2200 },
    // Police cars — Madina Police Station
    { id: '33333333-0000-0000-0000-000000000006', org: ORG.madina_police,   org_type: 'police_station',    type: 'police_car', plate: 'GR-PC-003', lat: 5.6680,  lng: 0.0030 },
    { id: '33333333-0000-0000-0000-000000000007', org: ORG.madina_police,   org_type: 'police_station',    type: 'police_car', plate: 'GR-PC-004', lat: 5.6650,  lng: 0.0100 },
    // Fire trucks — Circle Fire Station
    { id: '33333333-0000-0000-0000-000000000008', org: ORG.circle_fire,     org_type: 'fire_station',      type: 'fire_truck', plate: 'GR-FT-001', lat: 5.5570, lng: -0.2063 },
    { id: '33333333-0000-0000-0000-000000000009', org: ORG.circle_fire,     org_type: 'fire_station',      type: 'fire_truck', plate: 'GR-FT-002', lat: 5.5540, lng: -0.2390 },
    // Fire truck — Accra Fire Station
    { id: '33333333-0000-0000-0000-000000000010', org: ORG.accra_fire,      org_type: 'fire_station',      type: 'fire_truck', plate: 'GR-FT-003', lat: 5.5532, lng: -0.2063 },
  ];

  for (const v of vehicles) {
    await db.query(`
      INSERT INTO vehicles (id, organization_id, organization_type, vehicle_type, license_plate, status, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, 'available', $6, $7)
      ON CONFLICT (id) DO NOTHING
    `, [v.id, v.org, v.org_type, v.type, v.plate, v.lat, v.lng]);
    console.log(`  ✓ ${v.type.padEnd(10)} ${v.plate}  org: ${v.org.slice(-4)}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  NERDCO — Database Seed Script       ║');
  console.log('╚══════════════════════════════════════╝');

  const authEnv  = loadEnv('auth-service');
  const authPool = pool(authEnv.DATABASE_URL);
  try {
    await seedAuth(authPool);
  } finally {
    await authPool.end();
  }

  const trkEnv  = loadEnv('tracking-service');
  const trkPool = pool(trkEnv.DATABASE_URL);
  try {
    await seedTracking(trkPool);
  } finally {
    await trkPool.end();
  }

  console.log('\n✅  Seed complete.\n');
  console.log('Demo credentials (password: "password" for all):');
  console.log('');
  console.log('  CALL CENTRE (system_admin — any incident type):');
  console.log('    kwame@nerdco.gov.gh     — senior ops / national oversight');
  console.log('    efua@nerdco.gov.gh      — call centre operator');
  console.log('');
  console.log('  AMBULANCE SERVICE (org_admin):');
  console.log('    ama@nerdco.gov.gh       — NAS HQ fleet admin');
  console.log('');
  console.log('  HOSPITALS (org_admin):');
  console.log('    akosua@nerdco.gov.gh    — Korle Bu Teaching Hospital');
  console.log('    military@nerdco.gov.gh  — 37 Military Hospital');
  console.log('');
  console.log('  POLICE STATIONS (org_admin):');
  console.log('    kaneshie@nerdco.gov.gh  — Kaneshie Police Station');
  console.log('    madina@nerdco.gov.gh    — Madina Police Station');
  console.log('');
  console.log('  FIRE STATIONS (org_admin):');
  console.log('    circle@nerdco.gov.gh    — Circle Fire Station');
  console.log('    accrafire@nerdco.gov.gh — Accra Fire Station');
  console.log('');
  console.log('  FIELD:');
  console.log('    driver1@nerdco.gov.gh   — Ambulance Driver 1 (first_responder)');
}

main().catch(err => { console.error('\n❌  Seed failed:', err.message); process.exit(1); });
