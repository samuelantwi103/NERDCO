require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const swaggerUi    = require('swagger-ui-express');
const yaml         = require('js-yaml');
const fs           = require('fs');
const { connect: connectMQ } = require('./utils/publisher');
const { startRetryJob } = require('./jobs/dispatchRetry');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/incidents', require('./routes/incidents'));

const specPath = path.join(__dirname, 'docs', 'spec.yaml');
const spec     = yaml.load(fs.readFileSync(specPath, 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
app.get('/docs/spec.yaml', (_req, res) => res.sendFile(specPath));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'incident-service', version: '1.0' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, async () => {
  console.log(`[incident-service] NERDCO running on :${PORT}`);
  try { await connectMQ(); } catch (e: any) { console.warn('[incident-service] RabbitMQ not available:', e?.message); }
  startRetryJob();
});
