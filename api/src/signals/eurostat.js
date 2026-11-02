// Eurostat REST API — EU employment trend by industry sector and country.
// Used to populate the EU Industry Momentum signal for EU-based companies.
//
// API docs: https://ec.europa.eu/eurostat/web/json-and-unicode-web-services
// Free, no API key required. GDPR-compliant (no personal data processed).
//
// Dataset: sts_inpr_m — Industrial production index (monthly, seasonally adjusted)
//   Available filters: geo (country code), nace_r2 (sector), s_adj, unit
//   URL pattern: /data/sts_inpr_m?format=JSON&geo=DE&nace_r2=C&s_adj=SCA&unit=I15
//
// Fallback dataset: ei_bsin_r2_m — Business survey data by NACE sector (monthly)
//   More broadly available for service sectors not covered by sts_inpr_m.
//
// Cache TTL: 24 hours (Eurostat publishes monthly — data changes rarely intraday).

const https = require('https');
const { getRedis } = require('../utils/redis');

const CACHE_TTL  = 24 * 60 * 60;
const TIMEOUT_MS = 10000;
const BASE       = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

// EU member state ISO-2 codes (+ EEA neighbours commonly used in Eurostat)
const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  // EEA
  'NO','IS','LI',
  // candidate/associated frequently in datasets
  'CH',
]);

// Map common industry keywords (from Wikidata labels) to NACE Rev. 2 section codes.
// Eurostat sts_inpr_m covers sections B-E; ei_bsin_r2_m covers C, F, G, I, J, K, L, M.
const NACE_MAP = [
  { pattern: /manufactur|automotive|aerospace|chemical|pharma|steel|metal/i, nace: 'C' },
  { pattern: /construct/i,                                                    nace: 'F' },
  { pattern: /retail|wholesale|trade/i,                                       nace: 'G' },
  { pattern: /transport|logistics|shipping|freight/i,                         nace: 'H' },
  { pattern: /software|tech|internet|cloud|ai |artificial intelligence|telecom|ict/i, nace: 'J' },
  { pattern: /financ|bank|insurance|invest/i,                                 nace: 'K' },
  { pattern: /real estate|property|housing/i,                                 nace: 'L' },
  { pattern: /consult|legal|accounting|professional/i,                        nace: 'M' },
  { pattern: /health|hospital|pharma|medic/i,                                 nace: 'Q' },
  { pattern: /energy|oil|gas|electric|utilities/i,                            nace: 'D' },
  { pattern: /mining|quarry/i,                                                nace: 'B' },
  { pattern: /food|beverage|restaurant|hospitality|hotel/i,                   nace: 'I' },
];

function inferNace(industry) {
  if (!industry) return null;
  for (const { pattern, nace } of NACE_MAP) {
    if (pattern.test(industry)) return nace;
  }
  return null;
}

function cacheKey(country, nace) {
  return `signals:eurostat:${country.toLowerCase()}:${(nace || 'XX').toLowerCase()}`;
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        agent:   new https.Agent({ keepAlive: false }),
        headers: {
          'User-Agent': 'HireSignal/1.0 (https://hiresignal.app)',
          'Accept':     'application/json',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error('JSON parse error')); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('timeout')));
  });
}

// Extract an ordered array of numeric values from Eurostat's sparse JSON format.
// Eurostat returns { value: { "0": 101.2, "3": 98.4, ... }, size: [N] }
// where the key is the flat index into a multi-dimensional label array.
function extractTimeSeries(data) {
  const raw = data?.value;
  if (!raw || typeof raw !== 'object') return [];
  const size = data?.size;
  const totalPoints = size ? size.reduce((a, b) => a * b, 1) : Object.keys(raw).length;
  const series = [];
  for (let i = 0; i < totalPoints; i++) {
    const v = raw[String(i)];
    if (v !== undefined && v !== null) series.push({ index: i, value: v });
  }
  return series;
}

// Compare average of last N points vs previous N points to determine trend.
function classifyTrend(series, window = 3) {
  if (series.length < window * 2) return null;
  const recent = series.slice(-window).map(p => p.value);
  const prior  = series.slice(-(window * 2), -window).map(p => p.value);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const priorAvg  = prior.reduce((a, b) => a + b, 0) / prior.length;
  const delta = recentAvg - priorAvg;
  const threshold = priorAvg * 0.015; // 1.5% change is meaningful
  if (delta > threshold)  return 'positive';
  if (delta < -threshold) return 'negative';
  return null; // flat
}

async function fetchEurostatSignals(country, industry) {
  if (!country || !EU_COUNTRIES.has(country.toUpperCase())) {
    return { trend: null, eurostatSource: null };
  }

  const geo  = country.toUpperCase();
  const nace = inferNace(industry);

  if (!nace) {
    console.log(`[eurostat] no NACE mapping for industry "${industry}" — skipping`);
    return { trend: null, eurostatSource: null };
  }

  // Cache check
  const key = cacheKey(geo, nace);
  try {
    const redis = getRedis();
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  // Try primary dataset (industrial production — covers manufacturing, energy, mining)
  const datasets = [
    `${BASE}/sts_inpr_m?format=JSON&geo=${geo}&nace_r2=${nace}&s_adj=SCA&unit=I15&sinceTimePeriod=2023-01`,
    // Fallback: business survey indicators (broader sector coverage)
    `${BASE}/ei_bsin_r2_m?format=JSON&geo=${geo}&nace_r2=${nace}&indic=BS-ICI&s_adj=SA&sinceTimePeriod=2023-01`,
  ];

  let trend = null;
  let usedDataset = null;

  for (const url of datasets) {
    try {
      const data = await httpsGetJson(url);
      const series = extractTimeSeries(data);
      if (series.length >= 6) {
        trend = classifyTrend(series);
        usedDataset = url;
        console.log(`[eurostat] ${geo}/${nace}: ${series.length} points → trend=${trend}`);
        break;
      }
    } catch (err) {
      console.warn(`[eurostat] dataset failed (${err.message}):`, url.split('?')[0].split('/').pop());
    }
  }

  const eurostatSource = trend !== null ? {
    url:  `https://ec.europa.eu/eurostat/databrowser/view/${usedDataset?.includes('sts_inpr') ? 'sts_inpr_m' : 'ei_bsin_r2_m'}/default/table?lang=en`,
    name: 'Eurostat',
  } : null;

  const result = { trend, eurostatSource };

  try {
    const redis = getRedis();
    await redis.setex(key, CACHE_TTL, JSON.stringify(result));
  } catch (_) {}

  return result;
}

module.exports = { fetchEurostatSignals, EU_COUNTRIES };
