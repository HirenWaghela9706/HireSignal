const express = require('express');
const { getPool } = require('../db');

const router = express.Router();

// GET /api/companies/:name
router.get('/:name', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM company_signals WHERE company_name = $1',
      [decodeURIComponent(req.params.name)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

module.exports = router;
