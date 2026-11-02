const Redis = require('ioredis');

let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redis;
}

const CACHE_TTL = 86400; // 24 hours

// Normalise a job URL into a stable cache-key segment.
// Problem: platforms append tracking/session params (?from=serp&vjs=3&advn=...)
// that change per visit, producing different keys for the same job.
// Fix: keep only the path + the first recognised job-ID query param.
function normaliseJobUrl(rawUrl) {
  if (!rawUrl) return 'no_url';
  try {
    const u = new URL(rawUrl);
    // Known job-ID query params by platform
    const idParams = ['jk', 'jl', 'jobId', 'job_id', 'id', 'currentJobId', 'gh_jid', 'lever-origin'];
    const kept = [];
    for (const p of idParams) {
      if (u.searchParams.has(p)) { kept.push(`${p}=${u.searchParams.get(p)}`); break; }
    }
    // host + pathname + one ID param (if any)
    const base = u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
    return (base + (kept.length ? '?' + kept[0] : ''))
      .replace(/[^a-z0-9?=]/gi, '_')
      .toLowerCase()
      .slice(0, 120);
  } catch {
    return (rawUrl || '').replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 120);
  }
}

// Include the job URL in the cache key so every distinct job page gets its
// own score — prevents stale scores from one job bleeding into another at
// the same company.
function cacheKey(companyName, roleTitle, jobUrl) {
  const safe = (s) => (s || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const safeUrl = normaliseJobUrl(jobUrl);
  const key = `score:${safe(companyName)}:${safe(roleTitle)}:${safeUrl}`;
  console.log(`[redis] cacheKey → ${key}`);
  return key;
}

async function getCachedScore(companyName, roleTitle, jobUrl) {
  try {
    const r = getRedis();
    const key = cacheKey(companyName, roleTitle, jobUrl);
    const data = await r.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function setCachedScore(companyName, roleTitle, jobUrl, scoreData) {
  try {
    const r = getRedis();
    const key = cacheKey(companyName, roleTitle, jobUrl);
    await r.setex(key, CACHE_TTL, JSON.stringify(scoreData));
  } catch (err) {
    console.warn('Redis cache set failed:', err.message);
  }
}

module.exports = { getRedis, getCachedScore, setCachedScore };
