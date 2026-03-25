require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const swaggerUi    = require('swagger-ui-express');
const yaml         = require('js-yaml');
const fs           = require('fs');
const { connectPublisher } = require('./utils/publisher');

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/auth',          require('./routes/auth'));
app.use('/auth/users',    require('./routes/users'));
app.use('/organizations', require('./routes/organizations'));

// Swagger UI — serves the OpenAPI spec for this service
const specPath = path.join(__dirname, 'docs', 'spec.yaml');
const spec     = yaml.load(fs.readFileSync(specPath, 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
app.get('/docs/spec.yaml', (_req, res) => res.sendFile(specPath));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service', version: '1.0' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`[auth-service] NERDCO running on :${PORT}`);
  await connectPublisher();
});
