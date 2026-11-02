// Per-board DOM enrichment. Last resort, only run after a URL match.

function textFromEl(el) {
  if (!el) return null;
  // Workday and a few others put the company name in <img alt="...">
  if (el.tagName === 'IMG') {
    const alt = (el.getAttribute('alt') || '').trim();
    return alt || null;
  }
  const t = (el.textContent || '').trim();
  return t || null;
}

function firstMatch(doc, selectors) {
  if (!selectors || !selectors.length) return null;
  for (const sel of selectors) {
    let el;
    try { el = doc.querySelector(sel); } catch { continue; }
    const text = textFromEl(el);
    if (text && text.length >= 2 && text.length <= 200) return text;
  }
  return null;
}

export function extractFromDom(boardEntry, doc) {
  doc = doc || document;
  if (!boardEntry) return { title: null, company: null };
  return {
    title:   firstMatch(doc, boardEntry.titleSelectors),
    company: firstMatch(doc, boardEntry.companySelectors),
  };
}

// Generic title/company fallback used only when no board matched but we have
// a JSON-LD or OG signal that says "this is a job."
export function extractGenericTitleCompany(doc) {
  doc = doc || document;
  const h1 = doc.querySelector('h1');
  const title = textFromEl(h1);
  const companySelectors = [
    '[itemprop="hiringOrganization"]',
    '[class*="company"]',
    '[class*="employer"]',
    '[class*="organization"]',
    '[data-testid*="company"]',
    'header a',
  ];
  return { title, company: firstMatch(doc, companySelectors) };
}
