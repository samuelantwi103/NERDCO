require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const { setup: setupWs } = require('./websocket/wsServer');
const { connect: connectMQ } = require('./utils/publisher');

const app    = express();
app.use(cors());
app.use(express.json());

app.use('/vehicles', require('./routes/vehicles'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'tracking-service', version: '1.0' }));

const server = http.createServer(app);
setupWs(server);

const PORT = process.env.PORT || 3003;
server.listen(PORT, async () => {
  console.log(`[tracking-service] NERDCO running on :${PORT} (HTTP + WebSocket)`);
  try { await connectMQ(); } catch (e: any) { console.warn('[tracking-service] RabbitMQ not available:', e?.message); }
});
