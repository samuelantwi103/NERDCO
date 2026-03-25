const fs = require('fs');
const files = [
  'backend/analytics-service/src/db/pool.ts',
  'backend/auth-service/src/db/pool.ts',
  'backend/incident-service/src/db/pool.ts',
  'backend/tracking-service/src/db/pool.ts'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(
    /connectionString:\s*process\.env\.DATABASE_URL,/g,
    "connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true') : undefined,"
  );
  fs.writeFileSync(f, c);
});
console.log('PostgreSQL warning fixed');