// OpenGraph fallback. Lightweight — only used when JSON-LD is absent.

function metaContent(doc, attr, value) {
  const el = doc.querySelector(`meta[${attr}="${value}"]`);
  const v = el && el.getAttribute('content');
  return v ? v.trim() : null;
}

export function extractOg(doc) {
  doc = doc || document;
  return {
    title:       metaContent(doc, 'property', 'og:title')       || metaContent(doc, 'name', 'twitter:title'),
    description: metaContent(doc, 'property', 'og:description') || metaContent(doc, 'name', 'description'),
    siteName:    metaContent(doc, 'property', 'og:site_name')   || metaContent(doc, 'property', 'og:site-name'),
    type:        metaContent(doc, 'property', 'og:type'),
    url:         metaContent(doc, 'property', 'og:url'),
  };
}

// Heuristic: does this OG block look like a job posting?
// Used only when URL + JSON-LD both miss. Conservative on purpose.
const JOB_HINTS = /\b(job|career|hiring|role|position|vacancy|stelle|poste|empleo|emploi)\b/i;

export function ogLooksLikeJob(og) {
  if (!og) return false;
  const title = og.title || '';
  const desc  = og.description || '';
  return JOB_HINTS.test(title) || JOB_HINTS.test(desc);
}
