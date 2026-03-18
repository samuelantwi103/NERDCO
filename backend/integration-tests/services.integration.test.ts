import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

type ServiceConfig = {
  name: string;
  baseUrl: string;
  healthPath: string;
  protectedPath: string;
};

const availability = new Map<string, boolean>();

const services: ServiceConfig[] = [
  {
    name: 'auth-service',
    baseUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    healthPath: '/health',
    protectedPath: '/auth/profile',
  },
  {
    name: 'incident-service',
    baseUrl: process.env.INCIDENT_SERVICE_URL || 'http://localhost:3002',
    healthPath: '/health',
    protectedPath: '/incidents/open',
  },
  {
    name: 'tracking-service',
    baseUrl: process.env.TRACKING_SERVICE_URL || 'http://localhost:3003',
    healthPath: '/health',
    protectedPath: '/vehicles',
  },
  {
    name: 'analytics-service',
    baseUrl: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004',
    healthPath: '/health',
    protectedPath: '/analytics/summary',
  },
];

async function getJson(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

async function isReachable(service: ServiceConfig): Promise<boolean> {
  if (availability.has(service.name)) return availability.get(service.name) as boolean;

  try {
    const res = await fetch(`${service.baseUrl}${service.healthPath}`, {
      signal: AbortSignal.timeout(2000),
    });
    const ok = res.ok;
    availability.set(service.name, ok);
    return ok;
  } catch {
    availability.set(service.name, false);
    return false;
  }
}

for (const service of services) {
  test(`${service.name}: health endpoint responds`, async (t: TestContext) => {
    if (!(await isReachable(service))) {
      t.skip(`${service.name} not reachable at ${service.baseUrl}`);
      return;
    }
    const { res, json } = await getJson(`${service.baseUrl}${service.healthPath}`);
    assert.equal(res.status, 200);
    assert.equal(json.status, 'ok');
    assert.equal(json.service, service.name);
  });

  test(`${service.name}: protected endpoint rejects missing JWT`, async (t: TestContext) => {
    if (!(await isReachable(service))) {
      t.skip(`${service.name} not reachable at ${service.baseUrl}`);
      return;
    }
    const { res } = await getJson(`${service.baseUrl}${service.protectedPath}`);
    assert.equal(res.status, 401);
  });
}
