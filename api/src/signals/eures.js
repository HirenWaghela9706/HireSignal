// EURES — European Employment Services job portal.
// Queries the public EURES job vacancy search API to check posting volume
// for a company across EU countries.
//
// API: https://eures.europa.eu/api/jv-search/v2/jv-search (POST, JSON)
// No API key required for public search.
//
// Signal logic:
//   postingCount > 10  → strong hiring intent (+8)
//   postingCount 3–10  → moderate hiring intent (+4)
//   postingCount == 0  → no EU postings (neutral — not all companies post on EURES)
//
// Cache TTL: 12 hours.

const https = require('https');
const { getRedis } = require('../utils/redis');

const CACHE_TTL  = 12 * 60 * 60;
const TIMEOUT_MS = 10000;

function cacheKey(companyName) {
  const safe = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `signals:eures:${safe}`;
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const urlObj  = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method:   'POST',
      headers:  {
        'User-Agent':    'HireSignal/1.0 (https://hiresignal.app)',
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      agent: new https.Agent({ keepAlive: false }),
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });

    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    req.write(payload);
    req.end();
  });
}

async function fetchEuresSignals(companyName) {
  if (!companyName || companyName === 'Unknown') {
    return { postingCount: null, euresSource: null };
  }

  // Cache check
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(companyName));
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  let postingCount = null;
  let euresSource  = null;

  try {
    const data = await httpsPost(
      'https://eures.europa.eu/api/jv-search/v2/jv-search',
      {
        keywordSearch: companyName,
        pageSize:      1,          // we only need the total count
        pageNumber:    0,
        sortBy:        'BEST_MATCH',
      }
    );

    // Response shape: { totalResults: N, jvList: [...] }
    const total = data?.totalResults ?? data?.total ?? null;
    if (typeof total === 'number') {
      postingCount = total;
      console.log(`[eures] "${companyName}": ${total} active EU postings`);

      if (total > 0) {
        euresSource = {
          url:  `https://eures.europa.eu/en/jobs?keywords=${encodeURIComponent(companyName)}`,
          name: 'EURES EU Job Portal',
        };
      }
    }
  } catch (err) {
    console.warn(`[eures] search failed for "${companyName}":`, err.message);
  }

  const result = { postingCount, euresSource };

  try {
    const redis = getRedis();
    await redis.setex(cacheKey(companyName), CACHE_TTL, JSON.stringify(result));
  } catch (_) {}

  return result;
}

module.exports = { fetchEuresSignals };
