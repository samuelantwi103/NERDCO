// Single responsibility: fire-and-forget RabbitMQ publisher for auth-service events.
// Only hospital.capacity_updated is published from here.
// If RABBITMQ_URL is not set the publish is silently skipped (dev / test mode).
import type { EventEnvelope, EventRoutingKey } from '@nerdco/domain-types';

const amqplib = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const EXCHANGE = 'emergency_platform';
let channel: any = null;

export async function connectPublisher() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.log('[auth-service] RABBITMQ_URL not set — event publishing disabled');
    return;
  }
  try {
    const conn = await amqplib.connect(url);
    conn.on('error', (err: any) => console.error('[auth-service] RabbitMQ connection error:', err));
    channel = await conn.createChannel();
    channel.on('error', (err: any) => console.error('[auth-service] RabbitMQ channel error:', err));
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    console.log('[auth-service] RabbitMQ publisher ready');
  } catch (err: any) {
    console.warn('[auth-service] RabbitMQ unavailable — events will not be published:', err.message);
  }
}

export function publish(routingKey: EventRoutingKey, payload: unknown) {
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
      { persistent: true },
    );
  } catch {
    // Non-fatal — capacity snapshot will be eventually consistent
  }
}
