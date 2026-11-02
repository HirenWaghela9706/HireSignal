// Unified RSS aggregator — queries multiple free news feeds in parallel for a
// given company name and classifies every matching article as one of:
//   layoff_signal | funding_signal | growth_signal | negative_signal
//
// Multi-source confirmation:
//   If 2+ distinct feeds report the same signal type, layoffSourceCount /
//   fundingSourceCount is > 1. The caller (scoring.js) uses this to apply an
//   additional confidence-weighted point bonus.
//
// Return shape (drop-in compatible with newsapi.js and the old indiarss.js):
//   {
//     layoffDetected:    boolean,
//     fundingRecencyDays: number|null,
//     layoffSource:      { url, name }|null,   ← most recent article
//     fundingSource:     { url, name }|null,
//     layoffSourceCount: number,               ← distinct feeds that confirmed
//     fundingSourceCount: number,
//     layoffArticles:    [{ title, url, source, pubDate }],  ← top 3
//     fundingArticles:   [{ title, url, source, pubDate }],
//     growthArticles:    [{ title, url, source, pubDate }],
//   }
//
// Cache TTL: 6 hours per company.

const https = require('https');
const { getRedis } = require('../utils/redis');

const CACHE_TTL  = 6 * 60 * 60; // 6 hours
const MAX_ARTS   = 3;            // max articles kept per signal type
const TIMEOUT_MS = 8000;

// ── Language → Google News locale params ─────────────────────────────────────
// Maps 2-letter IETF language code → { hl, gl, ceid } for the Google News RSS
// endpoint. Falls back to en-US/US when the language is not listed.
const LANG_LOCALE = {
  de: { hl: 'de', gl: 'DE', ceid: 'DE:de' },
  fr: { hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  es: { hl: 'es', gl: 'ES', ceid: 'ES:es' },
  it: { hl: 'it', gl: 'IT', ceid: 'IT:it' },
  nl: { hl: 'nl', gl: 'NL', ceid: 'NL:nl' },
  pl: { hl: 'pl', gl: 'PL', ceid: 'PL:pl' },
  pt: { hl: 'pt-419', gl: 'PT', ceid: 'PT:pt-150' },
  sv: { hl: 'sv', gl: 'SE', ceid: 'SE:sv' },
  da: { hl: 'da', gl: 'DK', ceid: 'DK:da' },
  fi: { hl: 'fi', gl: 'FI', ceid: 'FI:fi' },
  no: { hl: 'no', gl: 'NO', ceid: 'NO:no' },
};

// Translated layoff/funding/growth signal keywords per language.
// Appended to the Google News query so local-language results surface.
const LANG_KEYWORDS = {
  de: 'Entlassung OR Stellenabbau OR Finanzierung OR Einstellung',
  fr: 'licenciement OR financement OR recrutement OR embauche',
  es: 'despido OR financiación OR contratación',
  it: 'licenziamento OR finanziamento OR assunzione',
  nl: 'ontslag OR financiering OR aanwerving',
  pl: 'zwolnienia OR finansowanie OR zatrudnienie',
  pt: 'despedimento OR financiamento OR contratação',
  sv: 'uppsägning OR finansiering OR anställning',
};

// ── Feed definitions ─────────────────────────────────────────────────────────
// Feeds that accept a search query via URL template ({q} = encoded company name)
// are marked with urlTemplate: true.
// Static feeds are fetched once and filtered by company name.

// Regions: 'global' = always fetch, 'eu' = EU companies, 'in' = India companies.
// All feeds are always fetched — region tags are used for result boosting only.
const FEEDS = [
  // ── Global ──────────────────────────────────────────────────────────────────
  {
    name:        'Google News',
    // URL is built dynamically in buildGoogleNewsUrl() using detected language.
    urlTemplate: null,
    dynamic:     true,
    region:      'global',
    googleNews:  true,
  },
  {
    name:        'Reuters',
    urlTemplate: 'https://feeds.reuters.com/reuters/businessNews',
    dynamic:     false,
    region:      'global',
  },
  // ── India ────────────────────────────────────────────────────────────────────
  {
    name:        'Economic Times',
    urlTemplate: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms',
    dynamic:     false,
    region:      'in',
  },
  {
    name:        'Moneycontrol',
    urlTemplate: 'https://www.moneycontrol.com/rss/buzzingstocks.xml',
    dynamic:     false,
    region:      'in',
  },
  {
    name:        'Business Standard',
    urlTemplate: 'https://www.business-standard.com/rss/home_page_top_stories.rss',
    dynamic:     false,
    region:      'in',
  },
  // ── EU ───────────────────────────────────────────────────────────────────────
  {
    name:        'Euronews Business',
    urlTemplate: 'https://www.euronews.com/rss?level=theme&name=business',
    dynamic:     false,
    region:      'eu',
  },
  {
    name:        'EUobserver',
    urlTemplate: 'https://euobserver.com/rss.xml',
    dynamic:     false,
    region:      'eu',
  },
  {
    name:        'Handelsblatt',
    urlTemplate: 'https://www.handelsblatt.com/contentexport/feed/top-themen',
    dynamic:     false,
    region:      'eu',
  },
  {
    name:        'Les Echos',
    urlTemplate: 'https://www.lesechos.fr/rss/rss_une.xml',
    dynamic:     false,
    region:      'eu',
  },
  {
    name:        'Il Sole 24 Ore',
    urlTemplate: 'https://www.ilsole24ore.com/rss/mondo.xml',
    dynamic:     false,
    region:      'eu',
  },
];

// ── Keyword sets ─────────────────────────────────────────────────────────────
const LAYOFF_KW   = ['layoff', 'layoffs', 'job cut', 'job cuts', 'workforce reduction',
                     'retrench', 'pink slip', 'restructur', 'redundanc', 'downsiz'];
const FUNDING_KW  = ['funding', 'series a', 'series b', 'series c', 'series d',
                     'raised', 'investment round', 'valuation', 'ipo', 'pre-ipo',
                     'venture capital', 'seed round', 'raised million', 'raised billion'];
const GROWTH_KW   = ['hiring', 'expansion', 'new office', 'headcount', 'growing',
                     'acquiring', 'acquisition', 'partnership', 'contract wins'];
const NEGATIVE_KW = ['fraud', 'scandal', 'investigation', 'bankruptcy', 'default',
                     'collapse', 'shut down', 'closure'];

// EU regulatory layoff terms — these are legally mandated public notices of
// collective redundancies (Task 4). Detecting them is high-confidence because
// companies must file these notices under EU/national law before layoffs begin.
const EU_REGULATORY_LAYOFF_KW = [
  // English (EU Directive 98/59/EC language)
  'collective redundancy', 'collective redundancies', 'collective dismissal',
  // German (§ 17 KSchG notification to Bundesagentur für Arbeit)
  'massenentlassung', 'massenentlassungen', 'interessenausgleich', 'sozialplan',
  // French (plan de sauvegarde de l\u2019emploi — PSE)
  'licenciement collectif', 'licenciements collectifs', 'plan de sauvegarde',
  'plan social', 'comité social',
  // Spanish (Expediente de Regulación Temporal de Empleo)
  'erte', 'ere ', 'expediente de regulación', 'regulación de empleo',
  // Italian (Cassa Integrazione Guadagni — state wage support during layoffs)
  'cassa integrazione', 'cig ', 'mobilità', 'procedura di licenziamento collettivo',
  // Dutch
  'collectief ontslag', 'reorganisatie',
  // Polish
  'zwolnienia grupowe',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function cacheKey(companyName, language) {
  const safe = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const lang = (language || 'en').toLowerCase().slice(0, 5).replace(/[^a-z]/g, '');
  return `signals:rssfeeds:${safe}:${lang}`;
}

// Build the Google News RSS URL with language-aware locale + translated keywords.
function buildGoogleNewsUrl(companyName, language) {
  const lang   = (language || 'en').toLowerCase();
  const locale = LANG_LOCALE[lang] || { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  const base   = `layoffs OR funding OR hiring OR expansion`;
  const extra  = LANG_KEYWORDS[lang] ? ` OR ${LANG_KEYWORDS[lang]}` : '';
  const q      = encodeURIComponent(companyName) + `+${base}${extra}`;
  return `https://news.google.com/rss/search?q=${q}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`;
}

function httpsGetRaw(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        agent:   new https.Agent({ keepAlive: false }),
        headers: {
          'User-Agent': 'HireSignal/1.0',
          'Accept':     'application/rss+xml,application/xml,text/xml,*/*',
        },
      },
      (res) => {
        // Follow single redirect
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          return httpsGetRaw(res.headers.location).then(resolve).catch(reject);
        }
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, text: raw }));
      }
    );
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('timeout')));
  });
}

// Minimal RSS/Atom parser — returns [{title, description, link, pubDate}]
function parseItems(xml) {
  const items = [];
  // Match both <item> (RSS) and <entry> (Atom)
  const re = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      // Handle CDATA, plain text, and self-closing content
      const r = new RegExp(
        `<${tag}[^>]*>(?:<!\[CDATA\[)?([\\s\\S]*?)(?:\]\]>)?<\\/${tag}>`, 'i'
      );
      const match = r.exec(block);
      if (!match) return '';
      // Strip HTML tags, decode basic entities
      return match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g,  '&')
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g,  "'")
        .trim();
    };
    // <link> can appear as text or as href attribute in Atom
    const linkText = get('link') || '';
    const linkAttr = /<link[^>]+href=["']([^"']+)["']/i.exec(block)?.[1] || '';
    items.push({
      title:       get('title'),
      description: get('description') || get('summary') || get('content'),
      link:        linkText || linkAttr,
      pubDate:     get('pubDate') || get('updated') || get('published'),
    });
  }
  return items;
}

function matchesCompany(item, companyName) {
  const hay = `${item.title} ${item.description}`.toLowerCase();
  const needle = companyName.toLowerCase();
  return hay.includes(needle);
}

// Returns { type, euRegulatory } where euRegulatory=true means a legally-filed
// EU collective redundancy notice was detected (high-confidence layoff signal).
function classifyItem(item) {
  const hay = `${item.title} ${item.description}`.toLowerCase();
  const euRegulatory = EU_REGULATORY_LAYOFF_KW.some(kw => hay.includes(kw));
  if (euRegulatory)                                return { type: 'layoff', euRegulatory: true };
  if (LAYOFF_KW.some(kw   => hay.includes(kw)))   return { type: 'layoff', euRegulatory: false };
  if (FUNDING_KW.some(kw  => hay.includes(kw)))   return { type: 'funding', euRegulatory: false };
  if (NEGATIVE_KW.some(kw => hay.includes(kw)))   return { type: 'negative', euRegulatory: false };
  if (GROWTH_KW.some(kw   => hay.includes(kw)))   return { type: 'growth', euRegulatory: false };
  return null;
}

function parsePubDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function daysAgo(date) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Main export ───────────────────────────────────────────────────────────────
async function fetchRssSignals(companyName, ticker, language) {
  // Cache check — keyed by company + language so DE/FR/EN get separate caches
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(companyName, language));
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  // Build fetch tasks
  const tasks = FEEDS.map(feed => {
    let url;
    if (feed.googleNews) {
      url = buildGoogleNewsUrl(companyName, language);
    } else if (feed.dynamic) {
      url = feed.urlTemplate.replace('{q}', encodeURIComponent(companyName));
    } else {
      url = feed.urlTemplate;
    }
    return httpsGetRaw(url)
      .then(r => ({ ...r, feedName: feed.name }))
      .catch(err => ({ status: 0, text: '', feedName: feed.name, error: err.message }));
  });

  // Yahoo Finance RSS — only available when we have a ticker
  if (ticker) {
    const yUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`;
    tasks.push(
      httpsGetRaw(yUrl)
        .then(r => ({ ...r, feedName: 'Yahoo Finance News' }))
        .catch(err => ({ status: 0, text: '', feedName: 'Yahoo Finance News', error: err.message }))
    );
  }

  const feedResults = await Promise.allSettled(tasks);

  // Buckets: signal type → [{ title, url, source, pubDate, pubDateObj, euRegulatory }]
  const buckets = { layoff: [], funding: [], growth: [], negative: [] };

  for (const result of feedResults) {
    if (result.status !== 'fulfilled') continue;
    const { status, text, feedName, error } = result.value;
    if (error || status === 0) {
      console.warn(`[rssfeeds] ${feedName}: ${error || 'no response'}`);
      continue;
    }
    if (status !== 200 || !text) {
      console.warn(`[rssfeeds] ${feedName}: HTTP ${status}`);
      continue;
    }

    const items = parseItems(text);
    console.log(`[rssfeeds] ${feedName}: ${items.length} items`);

    for (const item of items) {
      if (!matchesCompany(item, companyName)) continue;
      const classification = classifyItem(item);
      if (!classification) continue;
      const { type, euRegulatory } = classification;
      if (!buckets[type]) continue;
      if (buckets[type].length >= MAX_ARTS) continue;
      const pubDateObj = parsePubDate(item.pubDate);
      buckets[type].push({
        title:        item.title,
        url:          item.link || null,
        source:       feedName,
        pubDate:      item.pubDate || null,
        pubDateObj,
        euRegulatory: euRegulatory || false,
      });
    }
  }

  // Sort each bucket newest-first
  for (const arr of Object.values(buckets)) {
    arr.sort((a, b) => {
      if (!a.pubDateObj) return 1;
      if (!b.pubDateObj) return -1;
      return b.pubDateObj - a.pubDateObj;
    });
  }

  // ── Derive output signals ──────────────────────────────────────────────────
  const layoffArts  = buckets.layoff;
  const fundingArts = buckets.funding;
  const growthArts  = buckets.growth;

  const layoffDetected    = layoffArts.length > 0;
  const layoffSourceCount = new Set(layoffArts.map(a => a.source)).size;
  // EU regulatory notice — high-confidence, legally required public filing
  const euRegulatoryLayoff = layoffArts.some(a => a.euRegulatory);
  const euRegulatorySource = layoffArts.find(a => a.euRegulatory);
  const layoffSource = layoffArts[0]
    ? { url: layoffArts[0].url, name: layoffArts[0].source }
    : null;

  let fundingRecencyDays = null;
  const fundingSourceCount = new Set(fundingArts.map(a => a.source)).size;
  const fundingSource = fundingArts[0]
    ? { url: fundingArts[0].url, name: fundingArts[0].source }
    : null;
  if (fundingArts[0]?.pubDateObj) {
    fundingRecencyDays = daysAgo(fundingArts[0].pubDateObj);
  }

  // Strip internal fields before caching
  const strip = arts => arts.map(({ title, url, source, pubDate, euRegulatory }) =>
    ({ title, url, source, pubDate, euRegulatory })
  );

  const result = {
    layoffDetected,
    fundingRecencyDays,
    layoffSource,
    fundingSource,
    layoffSourceCount,
    fundingSourceCount,
    // EU-specific high-confidence signal
    euRegulatoryLayoff,
    euRegulatorySource: euRegulatorySource
      ? { url: euRegulatorySource.url, name: euRegulatorySource.source }
      : null,
    layoffArticles:  strip(layoffArts),
    fundingArticles: strip(fundingArts),
    growthArticles:  strip(growthArts),
  };

  try {
    const redis = getRedis();
    await redis.setex(cacheKey(companyName, language), CACHE_TTL, JSON.stringify(result));
  } catch (_) {}

  return result;
}

module.exports = { fetchRssSignals };
