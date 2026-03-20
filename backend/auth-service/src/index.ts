require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { connectPublisher } = require('./utils/publisher');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth',          require('./routes/auth'));
app.use('/organizations', require('./routes/organizations'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service', version: '1.0' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`[auth-service] NERDCO running on :${PORT}`);
  await connectPublisher();
});
