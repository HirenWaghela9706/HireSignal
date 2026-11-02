const express = require('express');
const { getPool } = require('../db');

const router = express.Router();

// All routes in this file are already guarded by authMiddleware + requireAdmin
// applied in index.js. No further auth checks needed here.

// ── GET /api/admin/stats ──────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const pool = getPool();
    const [
      totalUsers,
      totalJobs,
      todayJobs,
      topCompanies,
      topPlatforms,
      scoreDist,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM jobs'),
      pool.query("SELECT COUNT(*) FROM jobs WHERE analysed_at >= CURRENT_DATE"),
      pool.query(`
        SELECT company_name, COUNT(*) AS count
        FROM jobs WHERE company_name IS NOT NULL
        GROUP BY company_name ORDER BY count DESC LIMIT 10
      `),
      pool.query(`
        SELECT platform, COUNT(*) AS count
        FROM jobs WHERE platform IS NOT NULL
        GROUP BY platform ORDER BY count DESC LIMIT 10
      `),
      pool.query(`
        SELECT
          AVG(intent_score)                                        AS avg_score,
          COUNT(*) FILTER (WHERE intent_score >= 70)              AS high_count,
          COUNT(*) FILTER (WHERE intent_score >= 40
                            AND intent_score < 70)                AS medium_count,
          COUNT(*) FILTER (WHERE intent_score < 40
                            AND intent_score IS NOT NULL)         AS low_count
        FROM jobs
      `),
    ]);

    res.json({
      totalUsers:    parseInt(totalUsers.rows[0].count,  10),
      totalJobs:     parseInt(totalJobs.rows[0].count,   10),
      todayJobs:     parseInt(todayJobs.rows[0].count,   10),
      avgScore:      parseFloat(scoreDist.rows[0].avg_score || 0).toFixed(1),
      scoreHigh:     parseInt(scoreDist.rows[0].high_count,   10),
      scoreMedium:   parseInt(scoreDist.rows[0].medium_count, 10),
      scoreLow:      parseInt(scoreDist.rows[0].low_count,    10),
      topCompanies:  topCompanies.rows.map(r => ({ name: r.company_name, count: parseInt(r.count, 10) })),
      topPlatforms:  topPlatforms.rows.map(r => ({ platform: r.platform, count: parseInt(r.count, 10) })),
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────
router.get('/users', async (_req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.is_test_user,
        u.scan_count,
        u.scan_reset_date,
        u.created_at,
        COUNT(j.id)            AS total_jobs,
        MAX(j.analysed_at)     AS last_active
      FROM users u
      LEFT JOIN jobs j ON j.user_id = u.id
      GROUP BY u.id, u.email, u.name, u.role, u.is_test_user, u.scan_count, u.scan_reset_date, u.created_at
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows.map(r => ({
      ...r,
      total_jobs: parseInt(r.total_jobs, 10),
    })));
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── GET /api/admin/jobs ───────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const pool = getPool();
    const { platform, minScore, maxScore, from, to, limit = 200 } = req.query;

    const conditions = [];
    const params = [];

    if (platform)  { params.push(platform);  conditions.push(`j.platform = $${params.length}`); }
    if (minScore)  { params.push(parseInt(minScore, 10)); conditions.push(`j.intent_score >= $${params.length}`); }
    if (maxScore)  { params.push(parseInt(maxScore, 10)); conditions.push(`j.intent_score <= $${params.length}`); }
    if (from)      { params.push(from);      conditions.push(`j.analysed_at >= $${params.length}`); }
    if (to)        { params.push(to);        conditions.push(`j.analysed_at <= $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(Math.min(parseInt(limit, 10) || 200, 1000));

    const result = await pool.query(`
      SELECT
        j.id, j.company_name, j.role_title, j.intent_score,
        j.confidence_level, j.ghost_risk_flag, j.platform,
        j.status, j.analysed_at, j.url,
        u.email AS user_email
      FROM jobs j
      JOIN users u ON u.id = j.user_id
      ${where}
      ORDER BY j.analysed_at DESC
      LIMIT $${params.length}
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('[admin/jobs]', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ ok: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('[admin/users/delete]', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── PATCH /api/admin/users/:id/test-user ─────────────────────────────────
router.patch('/users/:id/test-user', async (req, res) => {
  const { is_test_user } = req.body;
  if (typeof is_test_user !== 'boolean') {
    return res.status(400).json({ error: 'is_test_user must be a boolean' });
  }
  try {
    const pool = getPool();
    const result = await pool.query(
      'UPDATE users SET is_test_user = $2 WHERE id = $1 RETURNING id, email, is_test_user',
      [req.params.id, is_test_user]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('[admin/users/test-user]', err);
    res.status(500).json({ error: 'Failed to update test user flag' });
  }
});

// ── PATCH /api/admin/users/:id ────────────────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: "role must be 'admin' or 'user'" });
  }
  try {
    const pool = getPool();
    const result = await pool.query(
      'UPDATE users SET role = $2 WHERE id = $1 RETURNING id, email, role',
      [req.params.id, role]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('[admin/users/patch]', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── GET /api/admin/signals ────────────────────────────────────────────────
// Counts how often each signal key fires across all jobs (positive + negative).
router.get('/signals', async (_req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      WITH pos AS (
        SELECT sig->>'key' AS key, sig->>'label' AS label, 'positive' AS type
        FROM jobs, jsonb_array_elements(signals->'positive') AS sig
        WHERE signals IS NOT NULL AND jsonb_typeof(signals->'positive') = 'array'
      ),
      neg AS (
        SELECT sig->>'key' AS key, sig->>'label' AS label, 'negative' AS type
        FROM jobs, jsonb_array_elements(signals->'negative') AS sig
        WHERE signals IS NOT NULL AND jsonb_typeof(signals->'negative') = 'array'
      ),
      combined AS (SELECT * FROM pos UNION ALL SELECT * FROM neg)
      SELECT key, label, type, COUNT(*) AS count
      FROM combined
      GROUP BY key, label, type
      ORDER BY count DESC
    `);
    res.json(result.rows.map(r => ({ ...r, count: parseInt(r.count, 10) })));
  } catch (err) {
    console.error('[admin/signals]', err);
    res.status(500).json({ error: 'Failed to fetch signal stats' });
  }
});

// ── GET /api/admin/perplexity-usage ──────────────────────────────────────
// Cost estimate: Perplexity sonar ~$1/M input + $1/M output tokens.
// Average call: ~500 input + ~900 output = 1400 tokens ≈ $0.0014/call.
const COST_PER_CALL = 0.005; // conservative estimate in USD

router.get('/perplexity-usage', async (_req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE called_at >= CURRENT_DATE)                AS today,
        COUNT(*) FILTER (WHERE called_at >= date_trunc('week',  NOW()))  AS this_week,
        COUNT(*) FILTER (WHERE called_at >= date_trunc('month', NOW()))  AS this_month,
        COUNT(*) FILTER (WHERE called_at >= NOW() - INTERVAL '30 days')  AS last_30_days
      FROM perplexity_usage
    `);

    const r = result.rows[0];
    const toInt = v => parseInt(v, 10) || 0;

    const todayCount     = toInt(r.today);
    const weekCount      = toInt(r.this_week);
    const monthCount     = toInt(r.this_month);
    const last30Count    = toInt(r.last_30_days);
    const totalCount     = toInt(r.total);

    // Estimated monthly cost based on last-30-day call rate
    const estimatedMonthlyCost = (last30Count * COST_PER_CALL).toFixed(2);

    // Daily breakdown for the last 14 days
    const daily = await pool.query(`
      SELECT
        DATE(called_at) AS date,
        COUNT(*)        AS count
      FROM perplexity_usage
      WHERE called_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(called_at)
      ORDER BY date DESC
    `);

    res.json({
      today:                todayCount,
      thisWeek:             weekCount,
      thisMonth:            monthCount,
      last30Days:           last30Count,
      total:                totalCount,
      costPerCall:          COST_PER_CALL,
      estimatedMonthlyCost: parseFloat(estimatedMonthlyCost),
      dailyBreakdown: daily.rows.map(d => ({
        date:  d.date,
        count: parseInt(d.count, 10),
        cost:  parseFloat((parseInt(d.count, 10) * COST_PER_CALL).toFixed(3)),
      })),
    });
  } catch (err) {
    console.error('[admin/perplexity-usage]', err);
    res.status(500).json({ error: 'Failed to fetch Perplexity usage' });
  }
});

// ── GET /api/admin/reposts ────────────────────────────────────────────────
// Jobs that have been reposted with a new posting date — ordered by worst offenders.
router.get('/reposts', async (_req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        company_name,
        role_title,
        platform,
        MAX(repost_count)                                          AS repost_count,
        MIN(COALESCE(first_seen_date, analysed_at::date))         AS first_seen_date,
        MAX(COALESCE(last_seen_date,  analysed_at::date))         AS last_seen_date,
        SUM(COALESCE(cache_hits, 0))                              AS cache_hits,
        MAX(intent_score)                                         AS intent_score
      FROM jobs
      WHERE repost_count > 0
        AND company_name IS NOT NULL
        AND role_title   IS NOT NULL
      GROUP BY company_name, role_title, platform
      ORDER BY repost_count DESC, cache_hits DESC
      LIMIT 100
    `);
    res.json(result.rows.map(r => ({
      company_name: r.company_name,
      role_title:   r.role_title,
      platform:     r.platform,
      repost_count: parseInt(r.repost_count, 10) || 0,
      first_seen_date: r.first_seen_date,
      last_seen_date:  r.last_seen_date,
      cache_hits:   parseInt(r.cache_hits,   10) || 0,
      intent_score: r.intent_score != null ? parseInt(r.intent_score, 10) : null,
    })));
  } catch (err) {
    console.error('[admin/reposts]', err);
    res.status(500).json({ error: 'Failed to fetch repost data' });
  }
});

module.exports = router;
