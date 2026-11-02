const https = require('https');
const { getRedis } = require('../utils/redis');

const CACHE_TTL = 86400; // 24 hours

function cacheKey(companyName) {
  const safe = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `signals:news:${safe}`;
}

const freshAgent = () => new https.Agent({ keepAlive: false });

const HEADERS = { 'User-Agent': 'HireSignal/1.0', 'Accept': 'application/json' };

function httpsGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: freshAgent(), headers: HEADERS }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { reject(new Error(`JSON parse error (status ${res.statusCode})`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
  });
}

async function fetchNewsSignals(companyName) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return { layoffDetected: false, fundingRecencyDays: null, layoffSource: null, fundingSource: null };
  }

  // Redis cache check
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(companyName));
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  // NewsAPI free tier: 30-day lookback with exclusive boundary — use 28 days for safe margin
  const from = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const base   = `https://newsapi.org/v2/everything`;
  // Include Indian business news sources alongside global coverage
  const indianSources = 'the-times-of-india,google-news-in';
  const indianDomains = 'economictimes.indiatimes.com,livemint.com,business-standard.com,moneycontrol.com';
  const common = `from=${from}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${apiKey}`;
  const indianCommon = `from=${from}&sortBy=publishedAt&pageSize=5&sources=${indianSources}&domains=${indianDomains}&apiKey=${apiKey}`;

  // Quoted company name is required (+), then OR across signal keywords.
  const layoffQ  = encodeURIComponent(`"${companyName}" AND (layoff OR layoffs OR "job cuts" OR "workforce reduction")`);
  const fundingQ = encodeURIComponent(`"${companyName}" AND (funding OR "series A" OR "series B" OR "series C" OR "raised million" OR "raised billion")`);

  let layoffDetected    = false;
  let fundingRecencyDays = null;
  let layoffSource      = null;
  let fundingSource     = null;

  const [layoffResult, fundingResult, layoffIndiaResult, fundingIndiaResult] = await Promise.allSettled([
    httpsGet(`${base}?q=${layoffQ}&${common}`),
    httpsGet(`${base}?q=${fundingQ}&${common}`),
    httpsGet(`${base}?q=${layoffQ}&${indianCommon}`),
    httpsGet(`${base}?q=${fundingQ}&${indianCommon}`),
  ]);

  // Helper: pick the most recent article from two result sets
  function bestArticle(resultA, resultB) {
    const arts = [];
    for (const r of [resultA, resultB]) {
      if (r?.status === 'fulfilled' && r.value?.body?.status === 'ok') {
        const a = r.value.body.articles?.[0];
        if (a?.publishedAt) arts.push(a);
      }
    }
    arts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return arts[0] || null;
  }

  // Layoff — global + India merged
  if (layoffResult.status === 'fulfilled') {
    const { status: httpStatus, body } = layoffResult.value;
    if (httpStatus !== 200) {
      console.warn(`NewsAPI layoff HTTP ${httpStatus} for "${companyName}":`, body?.message || body?.code);
    } else if (body?.status === 'ok') {
      const indiaTotal = layoffIndiaResult.status === 'fulfilled'
        ? (layoffIndiaResult.value?.body?.totalResults || 0) : 0;
      const total = (body.totalResults || 0) + indiaTotal;
      layoffDetected = total > 0;
      console.log(`NewsAPI layoff "${companyName}": ${total} results (${body.totalResults} global, ${indiaTotal} india)`);
      const article = bestArticle(layoffResult, layoffIndiaResult);
      if (layoffDetected && article) {
        layoffSource = { url: article.url || null, name: article.source?.name || 'NewsAPI' };
      }
    }
  } else {
    console.warn('NewsAPI layoff fetch failed:', layoffResult.reason?.message);
  }

  // Funding — global + India merged
  if (fundingResult.status === 'fulfilled') {
    const { status: httpStatus, body } = fundingResult.value;
    if (httpStatus !== 200) {
      console.warn(`NewsAPI funding HTTP ${httpStatus} for "${companyName}":`, body?.message || body?.code);
    } else if (body?.status === 'ok') {
      console.log(`NewsAPI funding "${companyName}": ${body.totalResults} results`);
      const article = bestArticle(fundingResult, fundingIndiaResult);
      if (article?.publishedAt) {
        fundingRecencyDays = Math.floor(
          (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        fundingSource = { url: article.url || null, name: article.source?.name || 'NewsAPI' };
      }
    }
  } else {
    console.warn('NewsAPI funding fetch failed:', fundingResult.reason?.message);
  }

  const result = { layoffDetected, fundingRecencyDays, layoffSource, fundingSource };

  try {
    const redis = getRedis();
    await redis.setex(cacheKey(companyName), CACHE_TTL, JSON.stringify(result));
  } catch (_) {}

  return result;
}

module.exports = { fetchNewsSignals };
