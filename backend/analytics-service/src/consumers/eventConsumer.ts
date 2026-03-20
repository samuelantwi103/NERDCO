// Single responsibility: consume RabbitMQ events and persist analytics snapshots
const amqplib = require('amqplib');
const repo = require('../repositories/analyticsRepo');

const EXCHANGE = 'emergency_platform';
const QUEUE    = 'analytics.all';
const DLX      = 'emergency_platform.dlx';

const handlers = {
  'incident.created':          (p) => repo.upsertIncidentSnapshot(p),
  'incident.dispatched':       (p) => repo.updateSnapshotDispatched(p.incident_id, p.dispatched_at),
  'incident.in_progress':      (p) => repo.updateSnapshotInProgress(p.incident_id, p.in_progress_at),
  'incident.resolved':         (p) => repo.updateSnapshotResolved(p.incident_id, p.resolved_at),
  'vehicle.location.updated':  (p) => repo.upsertVehicleSnapshot(p),
  'vehicle.status.changed':    (p) => repo.upsertVehicleSnapshot(p),
  'hospital.capacity_updated': (p) => repo.upsertHospitalCapacity(p),
};

async function connect() {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL);
  const ch   = await conn.createChannel();

  await ch.assertExchange(DLX, 'topic', { durable: true });
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  await ch.assertQueue(QUEUE, { durable: true, arguments: { 'x-dead-letter-exchange': DLX } });
  await ch.bindQueue(QUEUE, EXCHANGE, '#');
  ch.prefetch(1);

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    let envelope;
    try { envelope = JSON.parse(msg.content.toString()); } catch { return ch.ack(msg); }

    const { event_id, event, payload } = envelope;

    if (await repo.isDuplicate(event_id)) return ch.ack(msg); // idempotency

    try {
      const handler = handlers[event];
      if (handler) await handler(payload);
      await repo.logEvent(event_id, event, payload, true);
      ch.ack(msg);
    } catch (err: any) {
      console.error('[analytics-consumer] failed:', event, err?.message);
      await repo.logEvent(event_id, event, payload, false);
      ch.nack(msg, false, false); // route to DLX — do not requeue
    }
  }, { noAck: false });

  console.log('[analytics-service] RabbitMQ consumer ready');
}

module.exports = { connect };
