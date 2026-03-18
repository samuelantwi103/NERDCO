require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { connect: startConsumer } = require('./consumers/eventConsumer');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/analytics', require('./routes/analytics'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'analytics-service', version: '1.0' }));

const PORT = process.env.PORT || 3004;
app.listen(PORT, async () => {
  console.log(`[analytics-service] NERDCO running on :${PORT}`);
  try { await startConsumer(); } catch (e: any) { console.warn('[analytics-service] RabbitMQ not available:', e?.message); }
});
