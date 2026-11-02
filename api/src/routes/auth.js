const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const pool = getPool();
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING RETURNING id, email, name, email_verified`,
      [email, passwordHash, name || null]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role || 'user' }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/google-signin
// Called by NextAuth signIn callback — find or create user by Google account, return JWT
router.post('/google-signin', async (req, res) => {
  // Only the dashboard server may call this: it trusts the email/google_id it is sent.
  const expected = Buffer.from(process.env.INTERNAL_API_SECRET || '');
  const given    = Buffer.from(req.get('x-internal-secret') || '');
  if (!expected.length || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { email, google_id, name } = req.body;
    if (!email || !google_id) return res.status(400).json({ error: 'email and google_id required' });
    const pool = getPool();
    // Try to find existing user by google_id first, then by email
    let result = await pool.query(
      'SELECT id, email, name, role, google_id, password_hash FROM users WHERE google_id = $1',
      [google_id]
    );
    if (result.rows.length === 0) {
      result = await pool.query(
        'SELECT id, email, name, role, google_id, password_hash FROM users WHERE email = $1',
        [email]
      );
    }
    let user;
    if (result.rows.length > 0) {
      // Link google_id to existing account if not already set
      user = result.rows[0];
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [google_id, user.id]);
      }
    } else {
      // Create new user
      const newUser = await pool.query(
        'INSERT INTO users (email, google_id, name, email_verified) VALUES ($1, $2, $3, true) RETURNING id, email, name, role',
        [email, google_id, name || null]
      );
      user = newUser.rows[0];
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role || 'user' }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

// POST /api/auth/link-google — link a Google account to the currently logged-in user
router.post('/link-google', authMiddleware, async (req, res) => {
  try {
    const { google_id, email } = req.body;
    if (!google_id || !email) return res.status(400).json({ error: 'google_id and email required' });
    const pool = getPool();
    const userRes = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRes.rows[0];
    if (user.email !== email) return res.status(403).json({ error: 'Google account email does not match your account email' });
    // Check google_id not already used by another account
    const conflict = await pool.query('SELECT id FROM users WHERE google_id = $1 AND id != $2', [google_id, req.userId]);
    if (conflict.rows.length > 0) return res.status(409).json({ error: 'This Google account is already linked to another user' });
    await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [google_id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to link Google account' });
  }
});

// POST /api/auth/unlink-google — remove Google account link from current user
router.post('/unlink-google', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (!result.rows[0].password_hash) {
      return res.status(400).json({ error: 'Set a password first before disconnecting Google.' });
    }
    await pool.query('UPDATE users SET google_id = NULL WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unlink Google account' });
  }
});

// POST /api/auth/complete-onboarding — mark onboarding done for current user
router.post('/complete-onboarding', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('UPDATE users SET onboarding_complete = true WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// GET /api/auth/extension-token — issues a long-lived (90d) token for the browser extension
router.get('/extension-token', authMiddleware, async (req, res) => {
  try {
    const token = jwt.sign(
      { userId: req.userId },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to issue extension token' });
  }
});

// POST /api/auth/verify-email - stub
router.post('/verify-email', async (_req, res) => {
  res.status(501).json({ error: 'Email verification not yet implemented' });
});

// POST /api/auth/reset-password
// Logged-in user requests a password reset email to their own address.
router.post('/reset-password', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const { email } = result.rows[0];
    // TODO: integrate email provider (SendGrid / Resend) to deliver the link
    console.log(`[auth] password reset requested for ${email}`);
    res.json({ ok: true, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, email, name, role, seniority_level, target_role, primary_skills,
              personalisation_enabled, auto_analyse, email_verified, created_at,
              onboarding_complete,
              google_id IS NOT NULL AS has_google,
              password_hash IS NOT NULL AS has_password
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const {
      name, seniority_level, target_role, primary_skills,
      personalisation_enabled, auto_analyse,
    } = req.body;
    const pool = getPool();
    await pool.query(
      `UPDATE users SET
         name                    = COALESCE($2,  name),
         seniority_level         = COALESCE($3,  seniority_level),
         target_role             = COALESCE($4,  target_role),
         primary_skills          = COALESCE($5,  primary_skills),
         personalisation_enabled = COALESCE($6,  personalisation_enabled),
         auto_analyse            = COALESCE($7,  auto_analyse)
       WHERE id = $1`,
      [req.userId,
        name                  ?? null,
        seniority_level       ?? null,
        target_role           ?? null,
        primary_skills        ?? null,
        personalisation_enabled ?? null,
        auto_analyse          ?? null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
