// Indian business news RSS feeds — Economic Times and Moneycontrol.
// Parses RSS XML, searches headlines + descriptions for company name and
// signal keywords, and returns the same shape as newsapi.js so the caller
// can merge/fall-through transparently.
//
// Cache TTL: 6 hours (shorter than NewsAPI because RSS is free and fast).

const https = require('https');
const { getRedis } = require('../utils/redis');

const CACHE_TTL = 6 * 60 * 60; // 6 hours in seconds

const FEEDS = [
  {
    name: 'Economic Times',
    url:  'https://economictimes.indiatimes.com/rssfeedstopstories.cms',
  },
  {
    name: 'Moneycontrol',
    url:  'https://www.moneycontrol.com/rss/buzzingstocks.xml',
  },
];

const LAYOFF_KEYWORDS   = ['layoff', 'layoffs', 'job cut', 'job cuts', 'workforce reduction', 'retrenchment', 'pink slip'];
const FUNDING_KEYWORDS  = ['funding', 'series a', 'series b', 'series c', 'raised', 'investment', 'valuation', 'ipo', 'pre-ipo'];

function cacheKey(companyName) {
  const safe = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `signals:indiarss:${safe}`;
}

function httpsGetRaw(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        agent: new https.Agent({ keepAlive: false }),
        headers: { 'User-Agent': 'HireSignal/1.0', 'Accept': 'application/rss+xml,application/xml,text/xml' },
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, text: raw }));
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
  });
}

// Minimal RSS parser — extracts <item> blocks and returns an array of
// { title, description, pubDate, link } objects.
function parseRssItems(xml) {
  const items = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, 'i');
      return (r.exec(block)?.[1] || '').trim();
    };
    items.push({
      title:       get('title'),
      description: get('description'),
      pubDate:     get('pubDate'),
      link:        get('link'),
    });
  }
  return items;
}

function itemMatchesCompany(item, companyName) {
  const hay = `${item.title} ${item.description}`.toLowerCase();
  return hay.includes(companyName.toLowerCase());
}

function itemMatchesKeywords(item, keywords) {
  const hay = `${item.title} ${item.description}`.toLowerCase();
  return keywords.some(kw => hay.includes(kw));
}

function parsePubDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchIndiaRssSignals(companyName) {
  // Cache check
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(companyName));
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  let layoffDetected    = false;
  let fundingRecencyDays = null;
  let layoffSource      = null;
  let fundingSource     = null;

  // Fetch all feeds in parallel; failures are non-fatal
  const feedResults = await Promise.allSettled(
    FEEDS.map(f => httpsGetRaw(f.url).then(r => ({ ...r, feedName: f.name, feedUrl: f.url })))
  );

  const now = Date.now();

  for (const result of feedResults) {
    if (result.status !== 'fulfilled') {
      console.warn('[indiarss] fetch failed:', result.reason?.message);
      continue;
    }
    const { status, text, feedName } = result.value;
    if (status !== 200 || !text) {
      console.warn(`[indiarss] HTTP ${status} from ${feedName}`);
      continue;
    }

    const items = parseRssItems(text);
    console.log(`[indiarss] ${feedName}: ${items.length} items parsed`);

    for (const item of items) {
      if (!itemMatchesCompany(item, companyName)) continue;

      const pubDate = parsePubDate(item.pubDate);
      const daysAgo = pubDate ? Math.floor((now - pubDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

      if (!layoffDetected && itemMatchesKeywords(item, LAYOFF_KEYWORDS)) {
        layoffDetected = true;
        layoffSource = {
          url:  item.link || null,
          name: feedName,
        };
        console.log(`[indiarss] layoff signal from ${feedName}: "${item.title.slice(0, 60)}"`);
      }

      if (fundingRecencyDays === null && itemMatchesKeywords(item, FUNDING_KEYWORDS)) {
        fundingRecencyDays = daysAgo;
        fundingSource = {
          url:  item.link || null,
          name: feedName,
        };
        console.log(`[indiarss] funding signal from ${feedName}: "${item.title.slice(0, 60)}"`);
      }

      if (layoffDetected && fundingRecencyDays !== null) break;
    }
  }

  const result = { layoffDetected, fundingRecencyDays, layoffSource, fundingSource };

  try {
    const redis = getRedis();
    await redis.setex(cacheKey(companyName), CACHE_TTL, JSON.stringify(result));
  } catch (_) {}

  return result;
}

module.exports = { fetchIndiaRssSignals };
