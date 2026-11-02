// Perplexity API — primary company intelligence source.
//
// Uses Perplexity's sonar model (live web search) to get structured signal data
// for any company globally, covering:
//   1. Layoffs / job cuts in the last 90 days
//   2. Funding rounds in the last 12 months
//   3. Headcount trend (growing / stable / declining)
//   4. Major negative news in the last 90 days
//   5. Industry sector + primary country of operation
//
// This is the PRIMARY signal source — run before NewsAPI and RSS feeds.
// Cache TTL: 12 hours per company (1 hour when no useful data returned).
//
// Trust Rule compatibility: every signal includes a source.url (from Perplexity
// citations) or source.description so the scoring Trust Rule is always satisfied.

const { getRedis } = require('../utils/redis');
const { getPool }  = require('../db');

const CACHE_TTL  = 12 * 60 * 60; // 12 hours for data-rich responses
const CACHE_TTL_EMPTY = 1 * 60 * 60; // 1 hour for no-data responses
const TIMEOUT_MS = 25000; // Perplexity web search can be slow
const API_URL    = 'https://api.perplexity.ai/chat/completions';

function cacheKey(companyName) {
  const safe = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `signals:perplexity:v2:${safe}`;
}

function buildPrompt(companyName, jobTitle, jobDescription) {
  const today = new Date().toISOString().slice(0, 10);
  return `Today is ${today}. Search the web for recent factual information about "${companyName}" and the specific role "${jobTitle}".

Return ONLY a valid JSON object — no markdown, no explanation:

{
  "layoffs": {
    "detected": false,
    "details": null,
    "date": null,
    "source_url": null
  },
  "funding": {
    "detected": false,
    "amount": null,
    "round_type": null,
    "date": null,
    "days_ago": null,
    "source_url": null
  },
  "headcount": {
    "trend": "stable",
    "details": null,
    "employee_count": null
  },
  "negative_news": {
    "detected": false,
    "details": null,
    "source_url": null
  },
  "hiring_signals": {
    "is_actively_hiring": null,
    "open_roles_count": null,
    "hiring_freeze_detected": false,
    "recent_hiring_news": null,
    "source_url": null
  },
  "repost_signals": {
    "role_previously_posted": null,
    "estimated_times_reposted": null,
    "original_post_date": null,
    "details": null
  },
  "industry_momentum": {
    "sector_health": null,
    "trend": null,
    "details": null
  },
  "company_info": {
    "industry": null,
    "country": null,
    "founded_year": null,
    "is_public": null,
    "recent_acquisitions": null
  }
}

Strict rules:
- layoffs.detected = true ONLY if confirmed layoffs at "${companyName}" within the last 90 days with a source
- funding.detected = true ONLY if a confirmed investment round closed at "${companyName}" within the last 12 months
- hiring_signals.is_actively_hiring = true if "${companyName}" has multiple open roles posted publicly right now
- hiring_signals.hiring_freeze_detected = true if there is any news of a hiring freeze or headcount reduction at "${companyName}" in the last 6 months
- repost_signals.role_previously_posted = true if a role with the same or very similar title "${jobTitle}" at "${companyName}" has appeared on job boards before the current posting
- industry_momentum.trend must be one of: "growing", "stable", "declining", "volatile"
- headcount.trend must be one of: "growing", "stable", "declining"
- negative_news.detected = true ONLY for serious events (fraud, bankruptcy, major regulatory fine, criminal investigation) in the last 90 days. Do NOT flag routine criticism or minor controversies.
- company_info.country must be the ISO 3166-1 alpha-2 country code where the company is headquartered (e.g. "US", "DE", "GB", "FR", "IN"). Use null if unknown.
- company_info.industry should be the primary sector (e.g. "Software", "Fintech", "Healthcare", "E-commerce", "Manufacturing").
- If you cannot find reliable information for a field, use null or false. Never guess.`;
}

// Extract the first valid JSON object from a string that may have markdown fences
// or leading/trailing text from the model.
function extractJson(text) {
  if (!text) return null;
  // Strip ```json ... ``` or ``` ... ``` fences
  let clean = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  // Find the outermost { ... }
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    // Try the whole cleaned string as a last resort
    try { return JSON.parse(clean); } catch { return null; }
  }
}

// Map parsed Perplexity JSON to HireSignal signal format.
// The returned object is merged into jobData in routes/jobs.js.
function mapToSignals(parsed, citations) {
  // Perplexity's citations array provides the actual web sources used.
  // We use the first citation as the authoritative source URL when the model
  // didn't embed a specific URL in the structured fields.
  const citationUrls = Array.isArray(citations) ? citations.filter(u => typeof u === 'string' && u.startsWith('http')) : [];
  const topCitation  = citationUrls[0] || null;

  const result = {
    // ── Layoff signals ────────────────────────────────────────────────────
    layoffDetected:    false,
    layoffSource:      null,
    layoffSourceCount: 0,
    // ── Funding signals ───────────────────────────────────────────────────
    fundingRecencyDays:  null,
    fundingSource:       null,
    fundingSourceCount:  0,
    // ── Headcount ─────────────────────────────────────────────────────────
    headcountTrend:  null,
    headcountSource: null,
    employeeCount:   null,
    // ── Negative news ─────────────────────────────────────────────────────
    hasNegativeNews:    false,
    negativeNewsSource: null,
    // ── Company info ──────────────────────────────────────────────────────
    perplexityCountry:  null,
    perplexityIndustry: null,
    isPublicCompany:    false,
    recentAcquisitions: null,
    // ── Hiring signals ────────────────────────────────────────────────────
    isActivelyHiring:       false,
    activelyHiringSource:   null,
    hiringFreezeDetected:   false,
    hiringFreezeSource:     null,
    openRolesCount:         null,
    // ── Repost signals ────────────────────────────────────────────────────
    rolePreviouslyPosted: false,
    repostCount:          null,
    repostSource:         null,
    // ── Industry momentum ─────────────────────────────────────────────────
    industryMomentumTrend:  null,
    industryMomentumSource: null,
    // ── Meta ──────────────────────────────────────────────────────────────
    hasUsefulData:   false,
    citationUrls,
  };

  // ── Layoffs ──────────────────────────────────────────────────────────────
  if (parsed.layoffs?.detected === true) {
    result.layoffDetected    = true;
    result.layoffSourceCount = 1;
    result.hasUsefulData     = true;
    const detail = parsed.layoffs.details
      ? `${parsed.layoffs.details}${parsed.layoffs.date ? ` (${parsed.layoffs.date})` : ''}`
      : 'Recent layoffs confirmed';
    result.layoffSource = {
      url:         parsed.layoffs.source_url || topCitation,
      name:        'Perplexity AI Search',
      description: detail,
    };
  }

  // ── Funding ───────────────────────────────────────────────────────────────
  if (parsed.funding?.detected === true) {
    result.hasUsefulData      = true;
    result.fundingSourceCount = 1;
    result.fundingRecencyDays = typeof parsed.funding.days_ago === 'number' && parsed.funding.days_ago >= 0
      ? parsed.funding.days_ago
      : null;
    const parts = [
      parsed.funding.round_type,
      parsed.funding.amount,
      parsed.funding.date ? `(${parsed.funding.date})` : null,
    ].filter(Boolean);
    result.fundingSource = {
      url:         parsed.funding.source_url || topCitation,
      name:        'Perplexity AI Search',
      description: parts.length > 0 ? parts.join(' ') : 'Recent funding round confirmed',
    };
  }

  // ── Headcount trend ───────────────────────────────────────────────────────
  const trend = (parsed.headcount?.trend || '').toLowerCase().trim();
  if (trend === 'growing' || trend === 'stable' || trend === 'declining') {
    result.headcountTrend = trend;
    result.hasUsefulData  = true;
    result.headcountSource = {
      url:         topCitation,
      name:        'Perplexity AI Search',
      description: parsed.headcount.details || `Company headcount is ${trend}`,
    };
    if (typeof parsed.headcount.employee_count === 'number' && parsed.headcount.employee_count > 0) {
      result.employeeCount = parsed.headcount.employee_count;
    }
  }

  // ── Negative news ─────────────────────────────────────────────────────────
  if (parsed.negative_news?.detected === true) {
    result.hasNegativeNews    = true;
    result.hasUsefulData      = true;
    result.negativeNewsSource = {
      url:         parsed.negative_news.source_url || topCitation,
      name:        'Perplexity AI Search',
      description: parsed.negative_news.details || 'Major negative news detected',
    };
  }

  // ── Company info ──────────────────────────────────────────────────────────
  const country = (parsed.company_info?.country || '').toUpperCase().trim();
  if (country.length === 2) {
    result.perplexityCountry = country;
    result.hasUsefulData = true;
  }
  if (parsed.company_info?.industry) {
    result.perplexityIndustry = String(parsed.company_info.industry).trim();
  }
  if (parsed.company_info?.is_public === true) {
    result.isPublicCompany = true;
    result.hasUsefulData   = true;
  }
  if (parsed.company_info?.recent_acquisitions != null) {
    result.recentAcquisitions = String(parsed.company_info.recent_acquisitions).trim();
    result.hasUsefulData      = true;
  }

  // ── Hiring signals ────────────────────────────────────────────────────────
  const hs = parsed.hiring_signals;
  if (hs) {
    if (hs.is_actively_hiring === true) {
      result.isActivelyHiring = true;
      result.hasUsefulData    = true;
      result.activelyHiringSource = {
        url:         hs.source_url || topCitation,
        name:        'Perplexity AI Search',
        description: hs.recent_hiring_news || 'Company is actively hiring',
      };
    }
    if (hs.hiring_freeze_detected === true) {
      result.hiringFreezeDetected = true;
      result.hasUsefulData        = true;
      result.hiringFreezeSource = {
        url:         hs.source_url || topCitation,
        name:        'Perplexity AI Search',
        description: hs.recent_hiring_news || 'Hiring freeze detected',
      };
    }
    if (typeof hs.open_roles_count === 'number' && hs.open_roles_count > 5) {
      result.openRolesCount = hs.open_roles_count;
      result.hasUsefulData  = true;
    }
  }

  // ── Repost signals ────────────────────────────────────────────────────────
  const rs = parsed.repost_signals;
  if (rs && rs.role_previously_posted === true) {
    result.rolePreviouslyPosted = true;
    result.hasUsefulData        = true;
    const times = rs.estimated_times_reposted;
    result.repostCount = typeof times === 'number' ? times : null;
    const detail = rs.details
      || (rs.original_post_date ? `Originally posted ${rs.original_post_date}` : 'Role has been reposted');
    result.repostSource = {
      url:         topCitation,
      name:        'Perplexity AI Search',
      description: detail,
    };
  }

  // ── Industry momentum ─────────────────────────────────────────────────────
  const im = parsed.industry_momentum;
  if (im) {
    const imTrend = (im.trend || '').toLowerCase().trim();
    if (['growing', 'stable', 'declining', 'volatile'].includes(imTrend)) {
      result.industryMomentumTrend = imTrend;
      result.hasUsefulData         = true;
      result.industryMomentumSource = {
        url:         topCitation,
        name:        'Perplexity AI Search',
        description: im.details || `Industry trend: ${imTrend}`,
      };
    }
  }

  return result;
}

async function fetchPerplexitySignals(companyName, jobTitle, jobDescription) {
  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('[perplexity] PERPLEXITY_API_KEY not set — skipping');
    return { hasUsefulData: false };
  }
  if (!companyName || companyName === 'Unknown') {
    return { hasUsefulData: false };
  }

  // ── Cache check ───────────────────────────────────────────────────────────
  try {
    const redis  = getRedis();
    const cached = await redis.get(cacheKey(companyName));
    if (cached) {
      console.log(`[perplexity] cache hit for "${companyName}"`);
      return JSON.parse(cached);
    }
  } catch (_) {}

  console.log(`[perplexity] querying for "${companyName}"...`);
  // Log usage before the call so it's recorded even if the call fails
  try {
    await getPool().query(
      'INSERT INTO perplexity_usage (company_name) VALUES ($1)',
      [companyName]
    );
  } catch (_) {} // non-fatal

  let result = { hasUsefulData: false };

  try {
    const controller = new AbortController();
    const tid        = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(API_URL, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        model:    'sonar',
        messages: [
          {
            role:    'system',
            content: 'You are a hiring intelligence analyst. Return ONLY valid JSON with no markdown, no explanation.',
          },
          {
            role:    'user',
            content: buildPrompt(companyName, jobTitle || '', jobDescription || ''),
          },
        ],
        return_citations:      true,
        search_recency_filter: 'year',
        temperature:           0.1,
        max_tokens:            1500,
      }),
    });
    clearTimeout(tid);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn(`[perplexity] HTTP ${res.status} for "${companyName}":`, errBody.slice(0, 300));
      return { hasUsefulData: false };
    }

    const body      = await res.json();
    const content   = body?.choices?.[0]?.message?.content || '';
    const citations = body?.citations || [];

    console.log(`[perplexity] "${companyName}" — ${citations.length} citations, content: ${content.slice(0, 250)}`);

    const parsed = extractJson(content);
    if (!parsed) {
      console.warn(`[perplexity] JSON parse failed for "${companyName}" — raw:`, content.slice(0, 400));
      return { hasUsefulData: false };
    }

    result = mapToSignals(parsed, citations);
    console.log(
      `[perplexity] "${companyName}" — layoff=${result.layoffDetected}`,
      `| funding=${result.fundingRecencyDays ?? 'none'}d`,
      `| headcount=${result.headcountTrend ?? 'unknown'}`,
      `| negative=${result.hasNegativeNews}`,
      `| country=${result.perplexityCountry ?? '?'}`,
      `| useful=${result.hasUsefulData}`,
    );

  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[perplexity] timeout for "${companyName}" (${TIMEOUT_MS}ms)`);
    } else {
      console.warn(`[perplexity] error for "${companyName}":`, err.message);
    }
    return { hasUsefulData: false };
  }

  // ── Cache result ──────────────────────────────────────────────────────────
  try {
    const redis = getRedis();
    const ttl   = result.hasUsefulData ? CACHE_TTL : CACHE_TTL_EMPTY;
    await redis.setex(cacheKey(companyName), ttl, JSON.stringify(result));
  } catch (_) {}

  return result;
}

module.exports = { fetchPerplexitySignals };
