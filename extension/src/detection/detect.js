// Layered, URL-first job-page detection.
//
// Contract:
//   { kind: 'job',     source, board, url, title, company, postedAt, raw }
//   { kind: 'not-job', reason }
//
// Layer priority:
//   1. URL pattern (most reliable, declarative)
//   2. JSON-LD JobPosting
//   3. OpenGraph + job-ish heuristic (only if URL & JSON-LD missed)
//   4. Per-site DOM selectors (enrichment only, never raises kind)

import { matchBoard } from './boards.js';
import { extractJsonLdJobPosting } from './json-ld.js';
import { extractOg, ogLooksLikeJob } from './og.js';
import { extractFromDom, extractGenericTitleCompany } from './dom.js';

// Flip to false for production. Logs one structured "extraction trace" line
// per detection run so we can see which layer fired and which selectors
// matched on real pages.
const DEBUG = true;

function canonicalUrl(href, boardEntry) {
  if (boardEntry && typeof boardEntry.canonicaliseUrl === 'function') {
    try { return boardEntry.canonicaliseUrl(href); } catch { /* fall through */ }
  }
  return href;
}

export function detectJob({ href, doc } = {}) {
  doc  = doc  || document;
  href = href || (typeof window !== 'undefined' ? window.location.href : '');

  const board    = matchBoard(href);
  const url      = canonicalUrl(href, board);
  const jsonLd   = safeRun(() => extractJsonLdJobPosting(doc));
  const og       = safeRun(() => extractOg(doc));
  const ogJobby  = og && ogLooksLikeJob(og);

  if (DEBUG) emitTrace({ url, board, jsonLd, og, doc });

  // ── Layer 1: URL pattern is sufficient. ────────────────────────────────
  if (board) {
    const domEnrichment = safeRun(() => extractFromDom(board, doc)) || {};
    return {
      kind:     'job',
      source:   'url',
      board:    board.board,
      url,
      title:    jsonLd?.title   || og?.title       || domEnrichment.title   || null,
      company:  jsonLd?.company || og?.siteName    || domEnrichment.company || null,
      postedAt: jsonLd?.postedAt || null,
      raw:      pruneRaw({ jsonLd, og, dom: domEnrichment }),
    };
  }

  // ── Layer 2: JSON-LD JobPosting. ───────────────────────────────────────
  if (jsonLd && (jsonLd.title || jsonLd.company)) {
    const generic = safeRun(() => extractGenericTitleCompany(doc)) || {};
    return {
      kind:     'job',
      source:   'json-ld',
      board:    'generic',
      url,
      title:    jsonLd.title   || generic.title   || null,
      company:  jsonLd.company || og?.siteName    || generic.company || null,
      postedAt: jsonLd.postedAt || null,
      raw:      pruneRaw({ jsonLd, og }),
    };
  }

  // ── Layer 3: OG + job-ish heuristic. Conservative. ─────────────────────
  if (ogJobby) {
    const generic = safeRun(() => extractGenericTitleCompany(doc)) || {};
    return {
      kind:     'job',
      source:   'og',
      board:    'generic',
      url,
      title:    og.title    || generic.title   || null,
      company:  og.siteName || generic.company || null,
      postedAt: null,
      raw:      pruneRaw({ og }),
    };
  }

  // ── Not a job. Build a specific reason. ────────────────────────────────
  const reasons = [];
  reasons.push('URL does not match a known job board');
  reasons.push(jsonLd ? 'JSON-LD present but not a JobPosting' : 'no JSON-LD JobPosting on page');
  reasons.push(og && (og.title || og.description) ? 'OpenGraph metadata is not job-like' : 'no OpenGraph metadata');
  return { kind: 'not-job', reason: reasons.join('; ') };
}

function safeRun(fn) {
  try { return fn(); } catch { return null; }
}

// Trim the diagnostic blob — keep keys, drop nulls — so the message bus stays
// small (Chrome's runtime message size is generous but every byte still
// serialises through JSON.stringify).
function pruneRaw(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    if (typeof v === 'object' && Object.values(v).every(x => x == null)) continue;
    out[k] = v;
  }
  return out;
}

// ── Debug trace ────────────────────────────────────────────────────────────
// Emits one structured log line per detection run with everything needed to
// diagnose a failed extraction without re-running. Cost: a few querySelectorAll
// calls on top of those the layers already make. Off when DEBUG === false.
function emitTrace({ url, board, jsonLd, og, doc }) {
  const trace = {
    url,
    board: board?.board || null,
    jsonLd: traceJsonLd(doc, jsonLd),
    og:     traceOg(doc, og),
    dom:    traceDom(doc, board),
  };
  try {
    // eslint-disable-next-line no-console
    console.log('[HireSignal] extraction trace:', trace);
  } catch { /* ignore — console might be missing in headless tests */ }
}

function traceJsonLd(doc, jsonLd) {
  let scripts = [];
  try { scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')); } catch {}

  const types = [];
  let parseErrors = 0;

  function collectTypes(n) {
    if (!n || typeof n !== 'object') return;
    const t = n['@type'];
    if (t) Array.isArray(t) ? types.push(...t) : types.push(t);
    if (Array.isArray(n)) n.forEach(collectTypes);
    if (Array.isArray(n['@graph'])) n['@graph'].forEach(collectTypes);
  }

  for (const s of scripts) {
    const text = (s.textContent || '').trim();
    if (!text) continue;
    try { collectTypes(JSON.parse(text)); }
    catch { parseErrors++; }
  }

  let reason;
  if (jsonLd) reason = 'JobPosting found';
  else if (scripts.length === 0) reason = 'no <script type="application/ld+json"> on page';
  else if (parseErrors === scripts.length) reason = `all ${scripts.length} JSON-LD block(s) failed to parse`;
  else reason = `no JobPosting in ${scripts.length} JSON-LD block(s); types seen: ${types.join(', ') || '(none)'}`;

  return {
    ran:    true,
    found:  !!jsonLd,
    count:  scripts.length,
    types,
    parseErrors,
    reason,
  };
}

function traceOg(doc, og) {
  function has(prop) {
    try { return !!doc.querySelector(`meta[property="${prop}"]`); } catch { return false; }
  }
  const titlePresent = has('og:title');
  const descPresent  = has('og:description');
  const siteNamePresent = has('og:site_name') || has('og:site-name');

  let reason;
  if (!og) reason = 'extractor threw';
  else if (titlePresent || descPresent || siteNamePresent) {
    reason = `og:title=${titlePresent} og:description=${descPresent} og:site_name=${siteNamePresent}`;
  } else {
    reason = 'no og:* meta tags on page';
  }

  return {
    ran:   true,
    found: !!(og && (og.title || og.description || og.siteName)),
    title:        og?.title       || null,
    description:  og?.description || null,
    siteName:     og?.siteName    || null,
    reason,
  };
}

function traceDom(doc, board) {
  if (!board) {
    return { ran: false, found: false, matchedSelectors: [], missedSelectors: [], reason: 'no board matched, DOM layer skipped' };
  }
  const all = [
    ...(board.titleSelectors   || []).map(sel => ({ field: 'title',   selector: sel })),
    ...(board.companySelectors || []).map(sel => ({ field: 'company', selector: sel })),
  ];
  const matched = [];
  const missed  = [];
  for (const { field, selector } of all) {
    let el = null;
    try { el = doc.querySelector(selector); } catch { /* invalid selector */ }
    if (!el) { missed.push({ field, selector, reason: 'no element' }); continue; }
    const text = el.tagName === 'IMG'
      ? (el.getAttribute('alt') || '').trim()
      : (el.textContent || '').trim();
    if (!text) { missed.push({ field, selector, reason: 'element empty' }); continue; }
    matched.push({ field, selector, text: text.slice(0, 100) });
  }
  return {
    ran:   true,
    found: matched.length > 0,
    matchedSelectors: matched,
    missedSelectors:  missed,
  };
}
