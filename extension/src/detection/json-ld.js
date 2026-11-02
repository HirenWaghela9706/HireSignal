// JSON-LD JobPosting extractor.
//
// Boards keep JSON-LD stable for SEO, so it's the cleanest extraction source
// when present. This walker handles: arrays at the top level, @graph nesting,
// and the occasional double-encoded JSON string.

function* walk(node) {
  if (!node || typeof node !== 'object') return;
  yield node;
  if (Array.isArray(node)) {
    for (const item of node) yield* walk(item);
    return;
  }
  if (Array.isArray(node['@graph'])) {
    for (const item of node['@graph']) yield* walk(item);
  }
}

function typeMatches(node, target) {
  const t = node && node['@type'];
  if (!t) return false;
  if (Array.isArray(t)) return t.includes(target);
  return t === target;
}

function flatten(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const first = value.find(Boolean);
    return first ? flatten(first) : null;
  }
  if (typeof value === 'object') {
    return flatten(value.name) || flatten(value['@value']) || null;
  }
  return null;
}

function flattenLocation(loc) {
  if (!loc) return null;
  if (typeof loc === 'string') return loc.trim() || null;
  if (Array.isArray(loc)) {
    return loc.map(flattenLocation).filter(Boolean).join('; ') || null;
  }
  const addr = loc.address || loc;
  const parts = [
    flatten(addr?.addressLocality),
    flatten(addr?.addressRegion),
    flatten(addr?.addressCountry),
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : flatten(loc.name);
}

// Returns the first JobPosting found in any <script type="application/ld+json">
// element in the given document. Returns null if none are found.
export function extractJsonLdJobPosting(doc) {
  doc = doc || document;
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    const text = (s.textContent || '').trim();
    if (!text) continue;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }
    for (const node of walk(parsed)) {
      if (!typeMatches(node, 'JobPosting')) continue;
      return {
        title:          flatten(node.title),
        company:        flatten(node.hiringOrganization),
        postedAt:       flatten(node.datePosted),
        validThrough:   flatten(node.validThrough),
        employmentType: flatten(node.employmentType),
        jobLocation:    flattenLocation(node.jobLocation),
        description:    flatten(node.description),
        raw:            node,
      };
    }
  }
  return null;
}
