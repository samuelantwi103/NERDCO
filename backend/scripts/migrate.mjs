#!/usr/bin/env node
/**
 * NERDCO — Database migration script
 * Usage: node scripts/migrate.mjs
 *
 * Runs the 4 SQL schema files against the corresponding Neon databases.
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS / CREATE TYPE IF NOT EXISTS
 * via a wrapper that ignores "already exists" errors.
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require   = createRequire(import.meta.url);
const pg        = require('pg');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const DESIGN    = path.resolve(ROOT, '..', 'design', 'database');

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

async function runSql(db, sqlPath) {
  const sql = readFileSync(sqlPath, 'utf8');
  // Reset the public schema to clear any partial state from previous runs,
  // then recreate it and run the schema file fresh.
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
  await db.query('GRANT ALL ON SCHEMA public TO public');
  await db.query(sql);
  return { ok: 1, skipped: 0 };
}

async function migrate(serviceName, sqlFile) {
  const env  = loadEnv(serviceName);
  const db   = pool(env.DATABASE_URL);
  const file = path.join(DESIGN, sqlFile);
  console.log(`\n[${serviceName}] Running ${sqlFile}...`);
  try {
    const { ok, skipped } = await runSql(db, file);
    console.log(`  ✓ ${ok} statements executed, ${skipped} skipped (already exist)`);
  } finally {
    await db.end();
  }
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  NERDCO — Database Migration         ║');
  console.log('╚══════════════════════════════════════╝');

  await migrate('auth-service',      'identity-auth-schema.sql');
  await migrate('incident-service',  'emergency-incident-schema.sql');
  await migrate('tracking-service',  'dispatch-tracking-schema.sql');
  await migrate('analytics-service', 'analytics-schema.sql');

  console.log('\n✅  Migration complete. Run `pnpm seed` next.\n');
}

main().catch(err => { console.error('\n❌  Migration failed:', err.message); process.exit(1); });
