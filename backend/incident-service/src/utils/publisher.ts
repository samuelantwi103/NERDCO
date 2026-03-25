import type { EventEnvelope, EventRoutingKey } from '@nerdco/domain-types';

const amqplib = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const EXCHANGE = 'emergency_platform';
let channel: any = null;

async function connect() {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL);
  conn.on('error', (err: any) => console.error('[incident-service] RabbitMQ connection error:', err));
  channel = await conn.createChannel();
  channel.on('error', (err: any) => console.error('[incident-service] RabbitMQ channel error:', err));
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  console.log('[incident-service] RabbitMQ connected');
}

function publish(routingKey: EventRoutingKey, payload: unknown) {
  if (!channel) return;
  const envelope: EventEnvelope<unknown> = {
    event_id:  uuidv4(),
    event:     routingKey,
    version:   '1.0',
    timestamp: new Date().toISOString(),
    payload,
  };
  try {
    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: true }
    );
  } catch (err: any) {
    console.error('[incident-service] Failed to publish message:', err?.message);
  }
}

module.exports = { connect, publish };
