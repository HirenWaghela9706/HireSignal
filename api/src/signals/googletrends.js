// Google Trends — industry momentum signal.
// Uses the unofficial google-trends-api npm package (no API key required).
// Queries the company name + role title over the last 90 days and classifies
// the trend as 'positive', 'negative', or null (flat / no data).
//
// Cache TTL: 12 hours (trends data changes slowly).

const googleTrends = require('google-trends-api');
const { getRedis } = require('../utils/redis');

const CACHE_TTL = 12 * 60 * 60; // 12 hours

function cacheKey(companyName, roleTitle) {
  const safe = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `signals:gtrends:${safe(companyName)}:${safe(roleTitle)}`;
}

function trendsUrl(query) {
  return `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}&date=today+3-m`;
}

// Compare mean of last third vs first third of the timeline.
// Returns 'positive', 'negative', or null (flat / insufficient data).
function classifyTrend(timelineData) {
  if (!Array.isArray(timelineData) || timelineData.length < 6) return null;
  const values = timelineData.map(d => (Array.isArray(d.value) ? d.value[0] : 0));
  const third = Math.floor(values.length / 3);
  const firstAvg  = values.slice(0, third).reduce((a, b) => a + b, 0) / third;
  const lastAvg   = values.slice(-third).reduce((a, b) => a + b, 0) / third;
  const delta = lastAvg - firstAvg;
  if (delta > 8) return 'positive';
  if (delta < -8) return 'negative';
  return null; // flat — contributes no signal
}

async function fetchTrendsSignal(companyName, roleTitle) {
  // Cache check
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(companyName, roleTitle));
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const query = companyName && roleTitle
    ? `${companyName} ${roleTitle} jobs`
    : (companyName || roleTitle || 'jobs');

  const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const endTime   = new Date();

  let trend = null;
  let trendsSource = null;

  try {
    const raw = await googleTrends.interestOverTime({
      keyword:   query,
      startTime,
      endTime,
      hl:        'en-US',
      geo:       '',           // worldwide
      timezone:  0,
    });

    const parsed = JSON.parse(raw);
    const timeline = parsed?.default?.timelineData || [];
    console.log(`[googletrends] "${query}": ${timeline.length} data points`);

    trend = classifyTrend(timeline);

    if (trend !== null) {
      trendsSource = {
        url:  trendsUrl(query),
        name: 'Google Trends',
      };
    }
  } catch (err) {
    console.warn('[googletrends] fetch failed:', err.message);
  }

  const result = { trend, trendsSource };

  try {
    const redis = getRedis();
    await redis.setex(cacheKey(companyName, roleTitle), CACHE_TTL, JSON.stringify(result));
  } catch (_) {}

  return result;
}

module.exports = { fetchTrendsSignal };
