require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { connect: connectMQ } = require('./utils/publisher');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/incidents', require('./routes/incidents'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'incident-service', version: '1.0' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, async () => {
  console.log(`[incident-service] NERDCO running on :${PORT}`);
  try { await connectMQ(); } catch (e: any) { console.warn('[incident-service] RabbitMQ not available:', e?.message); }
});
