const { getPool } = require('../db');

const MONTHLY_SCAN_LIMIT = 50;

// Must be used AFTER authMiddleware (requires req.userId to be set).
// Enforces a monthly scan cap per user. Test users bypass the cap.
// Attaches req.scanInfo = { scans_used, scans_remaining } for the route to include in its response.
async function checkScanLimit(req, res, next) {
  try {
    const pool = getPool();

    // Reset count if we've rolled into a new calendar month, then fetch current state.
    const result = await pool.query(
      `UPDATE users
       SET
         scan_count      = CASE WHEN scan_reset_date < date_trunc('month', NOW()) THEN 0 ELSE scan_count END,
         scan_reset_date = CASE WHEN scan_reset_date < date_trunc('month', NOW()) THEN NOW() ELSE scan_reset_date END
       WHERE id = $1
       RETURNING scan_count, is_test_user`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { scan_count, is_test_user } = result.rows[0];

    // Test users bypass the cap entirely.
    if (is_test_user) {
      req.scanInfo = { scans_used: scan_count, scans_remaining: null, is_test_user: true };
      return next();
    }

    if (scan_count >= MONTHLY_SCAN_LIMIT) {
      return res.status(429).json({
        error: 'Monthly scan limit reached',
        scans_used: scan_count,
        scans_remaining: 0,
        limit: MONTHLY_SCAN_LIMIT,
      });
    }

    // Increment before running the analysis.
    await pool.query(
      'UPDATE users SET scan_count = scan_count + 1 WHERE id = $1',
      [req.userId]
    );

    req.scanInfo = {
      scans_used: scan_count + 1,
      scans_remaining: MONTHLY_SCAN_LIMIT - (scan_count + 1),
    };

    next();
  } catch (err) {
    console.error('[checkScanLimit]', err);
    return res.status(500).json({ error: 'Scan limit check failed' });
  }
}

module.exports = { checkScanLimit, MONTHLY_SCAN_LIMIT };
