const https = require('https');
const { getRedis } = require('../utils/redis');

const CACHE_TTL = 86400; // 24 hours

// Uses two crumb-free Yahoo Finance endpoints:
//   query1 /v1/finance/search  — ticker lookup
//   query2 /v8/finance/chart   — 1-year price data
// Both are called via https.get (not native fetch) to avoid connection-reuse
// rate limiting that Yahoo applies to keep-alive sessions.

// Minimal headers — full Chrome UA or Accept-Language triggers Yahoo's bot detection
const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' };

function cacheKey(companyName) {
  const safe = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `signals:yahoo:${safe}`;
}

// Each request gets its own agent (keepAlive: false) so Yahoo Finance sees
// independent connections — identical to how curl behaves — avoiding the
// TLS-session-level rate limiting that triggers 429 on pooled connections.
const freshAgent = () => new https.Agent({ keepAlive: false });

function yget(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS, agent: freshAgent() }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
  });
}

// 1-year stock price change → headcount trend proxy.
// Price appreciation strongly correlates with revenue growth & active hiring;
// price declines signal cost pressure and headcount freezes or cuts.
function priceTrendToHeadcount(currentPrice, prevClose) {
  if (!currentPrice || !prevClose || prevClose === 0) return null;
  const change = (currentPrice - prevClose) / prevClose;
  if (change > 0.10) return 'growing';
  if (change < -0.10) return 'declining';
  return 'flat';
}

async function findTicker(companyName) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(companyName)}&quotesCount=3&newsCount=0&enableFuzzyQuery=false`;
  const data = await yget(url);
  const quotes = data?.quotes || [];
  const best = quotes.find(q => q.quoteType === 'EQUITY' && !q.symbol.includes('.'))
    || quotes.find(q => q.quoteType === 'EQUITY')
    || quotes[0];
  return best?.symbol || null;
}

async function fetchChart(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=3mo&includePrePost=false`;
  const data = await yget(url);
  return data?.chart?.result?.[0] || null;
}

async function fetchYahooSignals(companyName) {
  // Redis cache check
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(companyName));
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const empty = { headcountTrend: null, fullTimeEmployees: null, ticker: null, yahooSource: null };

  try {
    const symbol = await findTicker(companyName);
    if (!symbol) return empty; // private company — no ticker

    const chart = await fetchChart(symbol);
    if (!chart) return empty;

    const meta = chart.meta || {};
    const headcountTrend = priceTrendToHeadcount(
      meta.regularMarketPrice,
      meta.chartPreviousClose  // price at start of 1-year range
    );

    // Include the resolved ticker so callers can distinguish public vs private,
    // and a source citation pointing to the Yahoo Finance quote page.
    const result = {
      headcountTrend,
      fullTimeEmployees: null,
      ticker: symbol,
      yahooSource: { url: `https://finance.yahoo.com/quote/${symbol}`, name: 'Yahoo Finance' },
    };

    try {
      const redis = getRedis();
      await redis.setex(cacheKey(companyName), CACHE_TTL, JSON.stringify(result));
    } catch (_) {}

    return result;
  } catch (err) {
    console.warn(`Yahoo Finance lookup failed for "${companyName}":`, err.message);
    return empty;
  }
}

module.exports = { fetchYahooSignals };
