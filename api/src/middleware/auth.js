const jwt = require('jsonwebtoken');
const { getPool } = require('../db');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Must be used AFTER authMiddleware (requires req.userId to be set).
// Queries the DB to verify the user has role='admin'.
async function requireAdmin(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('[requireAdmin]', err);
    return res.status(500).json({ error: 'Auth check failed' });
  }
}

module.exports = { authMiddleware, requireAdmin };
