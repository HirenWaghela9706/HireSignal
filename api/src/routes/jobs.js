const express = require('express');
const { getPool } = require('../db');
const { calculateScore } = require('../scoring');
const { checkScanLimit } = require('../middleware/scanLimit');
const { fetchPerplexitySignals } = require('../signals/perplexity');
const { fetchNewsSignals }       = require('../signals/newsapi');
const { fetchYahooSignals }      = require('../signals/yahoofinance');
const { fetchRssSignals }        = require('../signals/rssfeeds');
const { fetchWikidataSignals }   = require('../signals/wikidata');
const { fetchTrendsSignal }      = require('../signals/googletrends');
const { fetchEurostatSignals, EU_COUNTRIES } = require('../signals/eurostat');
const { fetchEuresSignals }      = require('../signals/eures');

const router = express.Router();

// ── Job URL normalization ─────────────────────────────────────────────────
// Strips UTM params and platform noise so the same job always maps to one
// canonical URL regardless of how the user arrived at the page.
function normalizeJobUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    // LinkedIn: canonical job URL, handling both direct /jobs/view/ pages and
    // split-pane search URLs where the job ID is in the currentJobId param.
    if (u.hostname.includes('linkedin.com')) {
      const viewMatch = u.pathname.match(/\/jobs\/view\/(\d+)/);
      if (viewMatch) return `https://www.linkedin.com/jobs/view/${viewMatch[1]}`;
      const currentJobId = u.searchParams.get('currentJobId');
      if (currentJobId) return `https://www.linkedin.com/jobs/view/${currentJobId}`;
    }

    // Indeed: keep only the jk param
    if (u.hostname.includes('indeed.com')) {
      const jk = u.searchParams.get('jk');
      if (jk) return `https://www.indeed.com/viewjob?jk=${jk}`;
    }

    // Generic: strip all query params, lowercase, remove trailing slash
    const clean = `${u.protocol}//${u.hostname}${u.pathname}`
      .toLowerCase()
      .replace(/\/+$/, '');
    return clean;
  } catch {
    return rawUrl.toLowerCase().trim().replace(/\/+$/, '');
  }
}

// ── Platform expiry windows ───────────────────────────────────────────────
// How long a posting on each platform typically stays live before expiring.
// Used to distinguish a repost from the same posting being viewed repeatedly.
const PLATFORM_EXPIRY_DAYS = {
  linkedin:   30,
  indeed:     30,
  glassdoor:  30,
  greenhouse: 90,
  lever:      90,
  workday:    90,
  generic:    60,
};

function getPlatformExpiry(platform) {
  return PLATFORM_EXPIRY_DAYS[(platform || '').toLowerCase()] ?? 60;
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return null;
  return Math.floor((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
}

function bandFromScore(score) {
  if (score == null) return null;
  return score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
}

// Find the canonical (first-seen) row for this job across ALL users.
// Includes external_job_id so we can compare IDs before falling back to dates.
async function findCanonicalJob(pool, companyName, roleTitle, platform) {
  const r = await pool.query(
    `SELECT id, intent_score, confidence_level, ghost_risk_flag, signals,
            original_post_date, repost_count, external_job_id, platform_expiry_days
     FROM jobs
     WHERE company_name = $1 AND role_title = $2 AND platform = $3
       AND intent_score IS NOT NULL
     ORDER BY COALESCE(first_seen_date, analysed_at::date) ASC, analysed_at ASC
     LIMIT 1`,
    [companyName, roleTitle, platform]
  );
  return r.rows[0] || null;
}

// ── Repost classification ─────────────────────────────────────────────────
// Determines whether the incoming request is a cache hit, a repost, or new.
//
// Priority 1 — Job ID comparison (most reliable signal):
//   • Same ID (or both null/missing) → treat as same posting → cache hit
//   • One side has an ID, the other doesn't → fall through to date check
//   • Both have IDs but they differ → definite repost
//
// Priority 2 — Date-based (fallback when IDs are unavailable):
//   • new_posting_date > stored_posting_date + platform_expiry_window → repost
//   • Otherwise → same posting viewed again → cache hit
//
// Priority 3 — No IDs and no dates → cache hit (assume same posting)
//
function classifyJob(canonical, newJobId, newPostingDate, platform) {
  const expiryDays = getPlatformExpiry(platform);

  if (!canonical) {
    return { isDbCacheHit: false, isRepost: false, repostCount: 0,
             originalPostDate: newPostingDate };
  }

  const storedJobId  = canonical.external_job_id || null;
  const storedDate   = canonical.original_post_date ? new Date(canonical.original_post_date) : null;
  const existingRepostCount = canonical.repost_count || 0;

  // ── Priority 1: Job ID ──────────────────────────────────────────────────
  if (newJobId && storedJobId) {
    if (newJobId === storedJobId) {
      // Identical job ID → same posting, cache hit
      return { isDbCacheHit: true,  isRepost: false, repostCount: existingRepostCount,
               originalPostDate: storedDate };
    }
    // Different job IDs → confirmed repost
    return { isDbCacheHit: false, isRepost: true,
             repostCount: existingRepostCount + 1,
             originalPostDate: storedDate ?? newPostingDate };
  }

  // ── Priority 2: Posting date ────────────────────────────────────────────
  if (storedDate && newPostingDate) {
    const daysDiff = daysBetween(storedDate, newPostingDate);

    if (daysDiff !== null && daysDiff > expiryDays) {
      // New posting date falls after the platform expiry window → repost
      return { isDbCacheHit: false, isRepost: true,
               repostCount: existingRepostCount + 1,
               originalPostDate: storedDate };
    }
    // Within expiry window → same posting viewed again → cache hit
    return { isDbCacheHit: true, isRepost: false, repostCount: existingRepostCount,
             originalPostDate: storedDate };
  }

  // ── Priority 3: No usable discriminators → cache hit ───────────────────
  return { isDbCacheHit: true, isRepost: false, repostCount: existingRepostCount,
           originalPostDate: storedDate ?? newPostingDate };
}

// POST /api/jobs/analyse
router.post('/analyse', checkScanLimit, async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { url, companyName, roleTitle, jobDescription, postingDate, platform, jobId, country, language } = req.body;
    const company_name    = companyName || req.body.company_name || 'Unknown';
    const role_title      = roleTitle   || req.body.roleTitle    || 'Unknown';
    const plat            = platform    || 'generic';
    const external_job_id = jobId       || null;
    const jobCountry      = country     || null;
    const jobLanguage     = language    || null;
    const expiryDays      = getPlatformExpiry(plat);

    const pool = getPool();
    const forceRescan    = req.body.force_rescan === true;
    const normalizedUrl  = normalizeJobUrl(url);

    // ── job_scans URL-level cache ──────────────────────────────────────────
    if (!forceRescan && normalizedUrl) {
      try {
        const cached = await pool.query(
          `SELECT * FROM job_scans
           WHERE job_url_normalized = $1
             AND updated_at > NOW() - INTERVAL '30 days'
           LIMIT 1`,
          [normalizedUrl]
        );
        if (cached.rows.length > 0) {
          const row = cached.rows[0];
          console.log(`[job_scans] cache hit for "${normalizedUrl}"`);
          return res.json({
            score:       row.score,
            scoreLabel:  row.score_label,
            confidence:  row.confidence,
            band:        bandFromScore(row.score),
            signals:     row.signals,
            cached:      true,
            cachedAt:    row.updated_at,
            scans_used:  req.scanInfo?.scans_used,
            scans_remaining: req.scanInfo?.scans_remaining,
          });
        }
      } catch (err) {
        // Non-fatal — proceed with fresh scan if cache lookup fails
        console.warn('[job_scans] cache lookup error:', err.message);
      }
    }

    // ── DB cross-user cache + repost detection ────────────────────────────
    const canonical = await findCanonicalJob(pool, company_name, role_title, plat);
    const newPostingDate = parseDate(postingDate);

    const { isDbCacheHit, isRepost, repostCount, originalPostDate } =
      classifyJob(canonical, external_job_id, newPostingDate, plat);

    // Compute days_until_expiry from the relevant original_post_date
    const effectiveOriginalDate = originalPostDate ?? newPostingDate;
    const daysUntilExpiry = effectiveOriginalDate
      ? expiryDays - daysBetween(effectiveOriginalDate, new Date())
      : null;

    // ── Serve from DB cache ───────────────────────────────────────────────
    if (isDbCacheHit) {
      await pool.query(
        'UPDATE jobs SET cache_hits = cache_hits + 1, last_seen_date = CURRENT_DATE WHERE id = $1',
        [canonical.id]
      );

      const cachedResponse = {
        score:           canonical.intent_score,
        confidence:      canonical.confidence_level,
        band:            bandFromScore(canonical.intent_score),
        ghostRiskFlag:   canonical.ghost_risk_flag,
        signals:         canonical.signals,
        repostCount,
        cacheHit:        true,
        daysUntilExpiry,
        platformExpiryDays: expiryDays,
        scans_used:      req.scanInfo?.scans_used,
        scans_remaining: req.scanInfo?.scans_remaining,
      };

      // Insert user-specific row only if this user doesn't already have it,
      // preventing duplicates when the same user re-opens the same job.
      await pool.query(
        `INSERT INTO jobs
           (user_id, url, company_name, role_title, platform, external_job_id,
            intent_score, confidence_level, ghost_risk_flag, signals,
            original_post_date, repost_count, first_seen_date, last_seen_date,
            platform_expiry_days, language, country)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_DATE,CURRENT_DATE,$13,$14,$15)
         ON CONFLICT DO NOTHING`,
        [req.userId, url || '', company_name, role_title, plat, external_job_id,
          canonical.intent_score, canonical.confidence_level, canonical.ghost_risk_flag,
          JSON.stringify(canonical.signals), canonical.original_post_date,
          repostCount, expiryDays, jobLanguage, jobCountry]
      );

      return res.json(cachedResponse);
    }

    // ── Fresh analysis (new job or confirmed repost) ──────────────────────
    const daysOpen       = effectiveOriginalDate ? daysBetween(effectiveOriginalDate, new Date()) : null;
    const lastRepostDate = isRepost ? new Date() : null;

    const perplexity = await fetchPerplexitySignals(company_name, role_title, jobDescription || null);

    const resolvedCountry = jobCountry || perplexity.perplexityCountry || null;
    const resolvedIsEu    = resolvedCountry && EU_COUNTRIES.has(resolvedCountry.toUpperCase());

    const [newsResult, yahooResult, wikidataResult, trendsResult, companyResult] = await Promise.allSettled([
      fetchNewsSignals(company_name),
      fetchYahooSignals(company_name),
      fetchWikidataSignals(company_name),
      fetchTrendsSignal(company_name, role_title),
      pool.query('SELECT * FROM company_signals WHERE company_name = $1', [company_name])
    ]);

    const news     = newsResult.status     === 'fulfilled' ? newsResult.value             : {};
    const yahoo    = yahooResult.status    === 'fulfilled' ? yahooResult.value            : {};
    const wikidata = wikidataResult.status === 'fulfilled' ? wikidataResult.value         : {};
    const trends   = trendsResult.status   === 'fulfilled' ? trendsResult.value           : {};
    const cs       = companyResult.status  === 'fulfilled' ? (companyResult.value.rows[0] || {}) : {};

    const skipRss = perplexity.hasUsefulData
      && perplexity.layoffDetected
      && perplexity.fundingRecencyDays != null;

    const [rss, eurostatResult, euresResult] = await Promise.all([
      skipRss
        ? Promise.resolve({})
        : fetchRssSignals(company_name, yahoo.ticker || null, jobLanguage).catch(() => ({})),
      resolvedIsEu
        ? fetchEurostatSignals(resolvedCountry, wikidata.industry || perplexity.perplexityIndustry || null)
            .catch(() => ({ trend: null, eurostatSource: null }))
        : Promise.resolve({ trend: null, eurostatSource: null }),
      resolvedIsEu
        ? fetchEuresSignals(company_name).catch(() => ({ postingCount: null, euresSource: null }))
        : Promise.resolve({ postingCount: null, euresSource: null }),
    ]);

    const eurostat = eurostatResult;
    const eures    = euresResult;
    const isPublic = !!(yahoo.ticker);

    function monthYear(dateVal) {
      if (!dateVal) return 'previously';
      return new Date(dateVal).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    const repostSource = repostCount > 0 ? {
      url:         null,
      name:        'HireSignal database',
      description: `Reposted ${repostCount}× — first seen ${monthYear(effectiveOriginalDate)}`,
    } : null;

    const staleSource = daysOpen != null ? {
      url:         url || null,
      name:        'job listing date',
      description: `Posted ${daysOpen} days ago`,
    } : null;

    let hasSeniorRoleConflict = false;
    let seniorSource = null;
    const isSeniorRole = /^(senior|sr\b|lead|principal|staff|director|vp |head of)/i.test(role_title.trim());
    if (!isSeniorRole) {
      try {
        const seniorCheck = await pool.query(
          `SELECT role_title, url FROM jobs
           WHERE company_name = $1 AND platform = $2
             AND LOWER(role_title) = $3
             AND analysed_at > NOW() - INTERVAL '60 days'
           ORDER BY analysed_at DESC LIMIT 1`,
          [company_name, plat, 'senior ' + role_title.toLowerCase().trim()]
        );
        if (seniorCheck.rows[0]) {
          hasSeniorRoleConflict = true;
          seniorSource = {
            url:         seniorCheck.rows[0].url || null,
            name:        'HireSignal database',
            description: `${seniorCheck.rows[0].role_title} also open at same company`,
          };
        }
      } catch (_) {}
    }

    const jobData = {
      repostCount,
      daysSinceFirstPost: daysOpen ?? 999,
      daysOpen:           daysOpen ?? 0,
      isPublic,
      hasSeniorRoleConflict,

      layoffDetected: perplexity.layoffDetected || news.layoffDetected || rss.layoffDetected || cs.layoff_detected || false,
      layoffSourceCount: (perplexity.layoffDetected ? 1 : 0) + (news.layoffDetected ? 1 : 0) + (rss.layoffSourceCount || 0),

      fundingRecencyDays: perplexity.fundingRecencyDays ?? news.fundingRecencyDays ?? rss.fundingRecencyDays ?? cs.funding_recency_days ?? null,
      fundingSourceCount: (perplexity.fundingRecencyDays != null ? 1 : 0) + (news.fundingRecencyDays != null ? 1 : 0) + (rss.fundingSourceCount || 0),

      headcountTrend:      perplexity.headcountTrend ?? yahoo.headcountTrend ?? cs.headcount_trend ?? null,
      wikidataEmployees:   wikidata.employeeCount ?? perplexity.employeeCount ?? null,
      wikidataFoundingYear: wikidata.foundingYear ?? null,
      wikidataSource:      wikidata.wikidataSource ?? null,
      identicalOpenRoles:  0,
      industryMomentum:    eurostat.trend ?? trends.trend ?? null,
      daysOpenForAge:      daysOpen ?? null,
      hasNegativeNews:     perplexity.hasNegativeNews    || false,
      negativeNewsSource:  perplexity.negativeNewsSource || null,
      // Perplexity hiring signals
      isActivelyHiring:    perplexity.isActivelyHiring    || false,
      activelyHiringSource: perplexity.activelyHiringSource || null,
      hiringFreezeDetected: perplexity.hiringFreezeDetected || false,
      hiringFreezeSource:  perplexity.hiringFreezeSource  || null,
      openRolesCount:      perplexity.openRolesCount      ?? null,
      // Perplexity repost signals (distinct from DB repostCount)
      rolePreviouslyPosted:  perplexity.rolePreviouslyPosted  || false,
      repostCountPerplexity: perplexity.repostCount            ?? null,
      repostSourcePerplexity: perplexity.repostSource          || null,
      // Perplexity industry momentum
      industryMomentumTrend:  perplexity.industryMomentumTrend  ?? null,
      industryMomentumSource: perplexity.industryMomentumSource ?? null,
      // Perplexity company info extras
      isPublicCompany:    perplexity.isPublicCompany    || false,
      recentAcquisitions: perplexity.recentAcquisitions ?? null,
      country:             resolvedCountry,
      euRegulatoryLayoff:  rss.euRegulatoryLayoff || false,
      euresPostingCount:   eures.postingCount     ?? null,

      layoffSource:       perplexity.layoffSource  || news.layoffSource  || rss.layoffSource  || null,
      fundingSource:      perplexity.fundingSource || news.fundingSource || rss.fundingSource || null,
      headcountSource:    perplexity.headcountSource || null,
      yahooSource:        yahoo.yahooSource         || null,
      trendsSource:       eurostat.eurostatSource   || trends.trendsSource   || null,
      euRegulatorySource: rss.euRegulatorySource    || null,
      euresSource:        eures.euresSource         || null,
      repostSource,
      staleSource,
      seniorSource,
    };

    const result = calculateScore(jobData);
    if (result.confidence === 'insufficient') {
      const platformIssue = company_name === 'Unknown' || role_title === 'Unknown';
      return res.json({
        score: null, confidence: 'insufficient', band: null, ghostRiskFlag: false,
        signals: result.signals, platformIssue,
        message: platformIssue ? 'Platform not fully supported yet' : 'Not enough data to score this listing'
      });
    }

    const response = {
      score:              result.score,
      confidence:         result.confidence,
      band:               result.band,
      ghostRiskFlag:      result.ghostRiskFlag,
      signals:            result.signals,
      signalCount:        result.signalCount,
      totalSignals:       result.totalSignals,
      isPublic,
      repostCount,
      isRepost,
      daysOpen:           daysOpen ?? null,
      originalPostDate:   effectiveOriginalDate ? effectiveOriginalDate.toISOString().slice(0, 10) : null,
      lastRepostDate:     lastRepostDate ? lastRepostDate.toISOString().slice(0, 10) : null,
      platformExpiryDays: expiryDays,
      daysUntilExpiry,
      scans_used:         req.scanInfo?.scans_used,
      scans_remaining:    req.scanInfo?.scans_remaining,
    };

    await pool.query(
      `INSERT INTO jobs
         (user_id, url, company_name, role_title, platform, external_job_id,
          original_post_date, last_repost_date, repost_count, days_open,
          intent_score, confidence_level, ghost_risk_flag, signals,
          first_seen_date, last_seen_date, cache_hits,
          platform_expiry_days, language, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_DATE,CURRENT_DATE,0,$15,$16,$17)
       ON CONFLICT (user_id, company_name, role_title, platform) DO UPDATE SET
         intent_score      = EXCLUDED.intent_score,
         confidence_level  = EXCLUDED.confidence_level,
         ghost_risk_flag   = EXCLUDED.ghost_risk_flag,
         signals           = EXCLUDED.signals,
         repost_count      = EXCLUDED.repost_count,
         days_open         = EXCLUDED.days_open,
         last_seen_date    = CURRENT_DATE,
         analysed_at       = NOW()`,
      [req.userId, url || '', company_name, role_title, plat, external_job_id,
        effectiveOriginalDate, lastRepostDate, repostCount, daysOpen,
        result.score, result.confidence, result.ghostRiskFlag,
        JSON.stringify(result.signals),
        expiryDays, jobLanguage, jobCountry]
    );

    // ── Persist to job_scans URL cache (awaited — must be in DB before response) ──
    if (normalizedUrl && result.confidence !== 'insufficient') {
      const bandLabel = result.band === 'high' ? 'High Intent'
        : result.band === 'medium'             ? 'Moderate Intent'
        : 'Low Intent';
      await pool.query(
        `INSERT INTO job_scans
           (job_url, job_url_normalized, company_name, job_title,
            score, score_label, confidence, signals, perplexity_raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (job_url) DO UPDATE SET
           score          = EXCLUDED.score,
           score_label    = EXCLUDED.score_label,
           confidence     = EXCLUDED.confidence,
           signals        = EXCLUDED.signals,
           perplexity_raw = EXCLUDED.perplexity_raw,
           updated_at     = NOW()`,
        [url || normalizedUrl, normalizedUrl, company_name, role_title,
          result.score, bandLabel, result.confidence,
          JSON.stringify(result.signals), JSON.stringify(perplexity)]
      ).catch(err => console.warn('[job_scans] write error:', err.message));
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// GET /api/jobs/cached?url=<encoded> — instant cache lookup, no scan, no token spend.
// Returns { hit: true, ...result } or { hit: false }.
router.get('/cached', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  const rawUrl = req.query.url;
  if (!rawUrl) return res.json({ hit: false });
  const normalizedUrl = normalizeJobUrl(rawUrl);
  if (!normalizedUrl) return res.json({ hit: false });
  try {
    const pool = getPool();
    const r = await pool.query(
      `SELECT * FROM job_scans
       WHERE job_url_normalized = $1
         AND updated_at > NOW() - INTERVAL '30 days'
       LIMIT 1`,
      [normalizedUrl]
    );
    if (!r.rows.length) return res.json({ hit: false });
    const row = r.rows[0];
    return res.json({
      hit:        true,
      score:      row.score,
      scoreLabel: row.score_label,
      confidence: row.confidence,
      band:       bandFromScore(row.score),
      signals:    row.signals,
      cached:     true,
      cachedAt:   row.updated_at,
    });
  } catch (err) {
    console.warn('[cached] lookup error:', err.message);
    return res.json({ hit: false });
  }
});

// GET /api/jobs — includes computed days_until_expiry
router.get('/', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, url, company_name, role_title, platform, original_post_date, last_repost_date,
              repost_count, days_open, intent_score, confidence_level, status, ghost_risk_flag,
              signals, analysed_at, first_seen_date, last_seen_date, cache_hits,
              platform_expiry_days,
              CASE
                WHEN original_post_date IS NOT NULL AND platform_expiry_days IS NOT NULL
                THEN (original_post_date + (platform_expiry_days || ' days')::interval)::date - CURRENT_DATE
                ELSE NULL
              END AS days_until_expiry
       FROM jobs WHERE user_id = $1 ORDER BY analysed_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM jobs WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// PUT /api/jobs/:id/status
router.put('/:id/status', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { status } = req.body;
  if (!['saved', 'applied', 'ignored'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const pool = getPool();
    const result = await pool.query(
      'UPDATE jobs SET status = $2 WHERE id = $1 AND user_id = $3 RETURNING id',
      [req.params.id, status, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/jobs/:id
router.delete('/:id', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// POST /api/jobs/test - dev only
router.post('/test', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { url, company, role, mockScore } = req.body;
    const score   = mockScore ?? Math.floor(Math.random() * 50) + 50;
    const band    = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
    const signals = {
      positive: score >= 70 ? [{ key: 'mock', label: 'Test Signal', points: '+15', detail: 'Mock data' }] : [],
      negative: score < 40  ? [{ key: 'mock', label: 'Test Signal', points: '-10', detail: 'Mock data' }] : [],
      noData: []
    };
    const pool = getPool();
    await pool.query(
      `INSERT INTO jobs
         (user_id, url, company_name, role_title, intent_score, confidence_level,
          ghost_risk_flag, signals, first_seen_date, last_seen_date, cache_hits, platform_expiry_days)
       VALUES ($1, $2, $3, $4, $5, 'standard', $6, $7, CURRENT_DATE, CURRENT_DATE, 0, 60)`,
      [req.userId, url || 'https://example.com/job', company || 'Test Co', role || 'Test Role',
        score, score < 40, JSON.stringify(signals)]
    );
    res.json({ score, band, confidence: 'standard', signals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Test insert failed' });
  }
});

module.exports = router;
