const express = require('express');
const { getPool } = require('../db');

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const pool = getPool();
    const jobsResult = await pool.query(
      'SELECT intent_score, status, ghost_risk_flag, analysed_at FROM jobs WHERE user_id = $1',
      [req.userId]
    );
    const jobs = jobsResult.rows;

    const total = jobs.length;
    const highIntent = jobs.filter(j => j.intent_score >= 70).length;
    const ghostRisk = jobs.filter(j => j.ghost_risk_flag).length;
    const applied = jobs.filter(j => j.status === 'applied').length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyActivity = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      weeklyActivity[key] = 0;
    }
    jobs.forEach(j => {
      const key = new Date(j.analysed_at).toISOString().slice(0, 10);
      if (weeklyActivity[key] !== undefined) weeklyActivity[key]++;
    });

    const scoreDistribution = {
      high: jobs.filter(j => j.intent_score >= 70).length,
      medium: jobs.filter(j => j.intent_score >= 40 && j.intent_score < 70).length,
      low: jobs.filter(j => j.intent_score !== null && j.intent_score < 40).length
    };

    res.json({
      total,
      highIntent,
      ghostRisk,
      applied,
      scoreDistribution,
      weeklyActivity: Object.entries(weeklyActivity).map(([date, count]) => ({ date, count }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;
