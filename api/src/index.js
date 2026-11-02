require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { authMiddleware, requireAdmin } = require('./middleware/auth');
const authRoutes      = require('./routes/auth');
const jobsRoutes      = require('./routes/jobs');
const dashboardRoutes = require('./routes/dashboard');
const companiesRoutes = require('./routes/companies');
const adminRoutes     = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Chrome Private Network Access: must be set before cors() ends the preflight response
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});
app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/auth',    authRoutes);
app.use('/api/jobs',    authMiddleware, jobsRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/companies', authMiddleware, companiesRoutes);
app.use('/api/admin',  authMiddleware, requireAdmin, adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`HireSignal API running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
