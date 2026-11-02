// Wikidata — free, structured knowledge base.
// Used to fetch: employee count, founding year, industry sector, and a
// company legitimacy signal (if the entity is known to Wikidata, the company
// is real and established enough to have a Wikipedia presence).
//
// API docs: https://www.wikidata.org/wiki/Wikidata:Data_access
// No API key required. Max 1 entity lookup per company.
//
// Cache TTL: 24 hours (Wikidata data changes infrequently).

const https = require('https');
const { getRedis } = require('../utils/redis');

const CACHE_TTL  = 24 * 60 * 60; // 24 hours
const TIMEOUT_MS = 8000;
const BASE_URL   = 'https://www.wikidata.org/w/api.php';

// Wikidata property IDs
const PROP_EMPLOYEES    = 'P1128'; // number of employees
const PROP_INCEPTION    = 'P571';  // founding date
const PROP_INDUSTRY     = 'P452';  // industry
const PROP_INSTANCE_OF  = 'P31';   // instance of (to confirm it's an org)

// Q-IDs for organisation types (used to confirm search hit is a company)
const ORG_QTYPES = new Set([
  'Q4830453',  // business enterprise
  'Q783794',   // company
  'Q891723',   // public company
  'Q2085381',  // publisher / media company
  'Q6881511',  // enterprise (broad)
  'Q167037',   // corporation
  'Q43229',    // organization (very broad — last resort)
]);

function cacheKey(companyName) {
  const safe = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `signals:wikidata:${safe}`;
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

// Step 1: search for company entity by name, return best matching Q-ID.
async function searchEntity(companyName) {
  const url = `${BASE_URL}?action=wbsearchentities&search=${encodeURIComponent(companyName)}&language=en&format=json&type=item&limit=5`;
  const data = await httpsGetJson(url);
  const hits = data?.search || [];

  // Prefer hits whose label closely matches the company name
  const nameLower = companyName.toLowerCase();
  const exact = hits.find(h => (h.label || '').toLowerCase() === nameLower);
  const prefix = hits.find(h => (h.label || '').toLowerCase().startsWith(nameLower));
  return (exact || prefix || hits[0])?.id || null;
}

// Step 2: fetch entity claims for the given Q-ID.
async function fetchEntityClaims(qid) {
  const url = `${BASE_URL}?action=wbgetentities&ids=${qid}&props=claims|descriptions|labels&format=json&languages=en`;
  const data = await httpsGetJson(url);
  return data?.entities?.[qid] || null;
}

// Extract the most recent numeric value from a quantity claim.
function getQuantity(claims, propId) {
  const snapshots = claims?.[propId];
  if (!Array.isArray(snapshots) || snapshots.length === 0) return null;
  // Sort by rank: preferred > normal > deprecated
  const rankOrder = { preferred: 0, normal: 1, deprecated: 2 };
  const sorted = [...snapshots].sort(
    (a, b) => (rankOrder[a.rank] ?? 9) - (rankOrder[b.rank] ?? 9)
  );
  const val = sorted[0]?.mainsnak?.datavalue?.value?.amount;
  if (!val) return null;
  const n = parseInt(String(val).replace('+', ''), 10);
  return isNaN(n) ? null : n;
}

// Extract a time value (returns year as number).
function getYear(claims, propId) {
  const snapshots = claims?.[propId];
  if (!Array.isArray(snapshots) || snapshots.length === 0) return null;
  const timeStr = snapshots[0]?.mainsnak?.datavalue?.value?.time;
  if (!timeStr) return null;
  const m = timeStr.match(/\+(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

// Extract all Q-IDs from a claim (e.g. for industry or instance-of).
function getQIds(claims, propId) {
  const snapshots = claims?.[propId] || [];
  return snapshots
    .map(s => s?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

// Get the English label for a Q-ID (single quick lookup, cached via caller).
async function getLabel(qid) {
  const url = `${BASE_URL}?action=wbgetentities&ids=${qid}&props=labels&format=json&languages=en`;
  try {
    const data = await httpsGetJson(url);
    return data?.entities?.[qid]?.labels?.en?.value || null;
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
async function fetchWikidataSignals(companyName) {
  const empty = {
    employeeCount: null,
    foundingYear:  null,
    industry:      null,
    wikidataId:    null,
    wikidataSource: null,
  };

  // Cache check
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(companyName));
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  try {
    const qid = await searchEntity(companyName);
    if (!qid) {
      console.log(`[wikidata] no entity found for "${companyName}"`);
      return empty;
    }

    const entity = await fetchEntityClaims(qid);
    if (!entity) return empty;

    const claims = entity.claims || {};

    // Confirm it's an organisation type
    const instanceQids = getQIds(claims, PROP_INSTANCE_OF);
    const isOrg = instanceQids.some(q => ORG_QTYPES.has(q))
      || instanceQids.length === 0; // if no instance-of at all, give benefit of doubt

    if (!isOrg) {
      console.log(`[wikidata] "${companyName}" (${qid}) is not classified as an org — skipping`);
      return empty;
    }

    const employeeCount = getQuantity(claims, PROP_EMPLOYEES);
    const foundingYear  = getYear(claims, PROP_INCEPTION);

    // Industry — get the label of the first industry Q-ID
    let industry = null;
    const industryQids = getQIds(claims, PROP_INDUSTRY);
    if (industryQids.length > 0) {
      industry = await getLabel(industryQids[0]);
    }

    const wikidataSource = {
      url:  `https://www.wikidata.org/wiki/${qid}`,
      name: 'Wikidata',
    };

    const result = { employeeCount, foundingYear, industry, wikidataId: qid, wikidataSource };
    console.log(`[wikidata] "${companyName}" → ${qid} | employees=${employeeCount} | founded=${foundingYear} | industry=${industry}`);

    try {
      const redis = getRedis();
      await redis.setex(cacheKey(companyName), CACHE_TTL, JSON.stringify(result));
    } catch (_) {}

    return result;
  } catch (err) {
    console.warn(`[wikidata] lookup failed for "${companyName}":`, err.message);
    return empty;
  }
}

module.exports = { fetchWikidataSignals };
