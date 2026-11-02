// Job-board registry. URL match is the primary detection signal; selectors are
// last-resort DOM enrichment when JSON-LD and OpenGraph both miss.
//
// Adding a new board = adding one entry. Detection order is the array order
// (first match wins).

export const BOARDS = [
  {
    board: 'linkedin',
    // /jobs/view/<id>/  AND  /jobs/search/?currentJobId=<id>
    urlPattern: /(?:^|\/\/)(?:[\w-]+\.)*linkedin\.com\/jobs\/(?:view\/\d+|search\/?\?.*currentJobId=\d+)/i,
    canonicaliseUrl(href) {
      const m = href.match(/\/jobs\/view\/(\d+)/);
      if (m) return `https://www.linkedin.com/jobs/view/${m[1]}/`;
      const qm = href.match(/[?&]currentJobId=(\d+)/);
      if (qm) return `https://www.linkedin.com/jobs/view/${qm[1]}/`;
      return href;
    },
    titleSelectors: [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title h1',
      '[class*="job-details-jobs-unified-top-card__job-title"]',
      '[class*="jobs-unified-top-card__job-title"]',
      '[class*="job-title"] h1',
      'h1',
    ],
    companySelectors: [
      '.job-details-jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name a',
      '[class*="job-details-jobs-unified-top-card__company-name"]',
      '[class*="jobs-unified-top-card__company-name"]',
      '.jobs-unified-top-card__subtitle-primary-grouping a',
    ],
  },
  {
    board: 'greenhouse',
    // boards.greenhouse.io/<co>/jobs/<id> and the embedded variants under
    // job-boards.greenhouse.io and boards.eu.greenhouse.io
    urlPattern: /(?:^|\/\/)(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/[^/]+\/jobs\/\d+/i,
    titleSelectors: [
      '.app-title',
      '[class*="app-title"]',
      '.posting-headline h2',
      'h1',
    ],
    companySelectors: [
      '.company-name',
      '[class*="company-name"]',
      'header a',
      '#header a',
    ],
  },
  {
    board: 'lever',
    // jobs.lever.co/<co>/<uuid>
    urlPattern: /(?:^|\/\/)jobs\.lever\.co\/[^/]+\/[a-f0-9-]{8,}/i,
    titleSelectors: [
      '.posting-headline h2',
      '[class*="posting-headline"] h2',
      '[class*="posting-headline"]',
      'h2',
    ],
    companySelectors: [
      '.main-header-logo + a',
      '.posting-header a',
      'header a',
    ],
  },
  {
    board: 'ashby',
    // jobs.ashbyhq.com/<co>/<uuid>
    urlPattern: /(?:^|\/\/)jobs\.ashbyhq\.com\/[^/]+\/[a-f0-9-]{8,}/i,
    titleSelectors: [
      '[class*="_jobPostingHeader"] h1',
      'h1',
    ],
    companySelectors: [
      '[class*="_organizationName"]',
      'header a',
    ],
  },
  {
    board: 'workday',
    // <tenant>.<region>.myworkdayjobs.com/.../job/<location>/<role-slug>
    urlPattern: /(?:^|\/\/)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.myworkdayjobs\.com\/.+\/job\//i,
    titleSelectors: [
      '[data-automation-id="jobPostingHeader"]',
      '[data-automation-id="Job_Posting_Header_PrimaryInfo"]',
      'h1',
    ],
    companySelectors: [
      '[data-automation-id="org-name"]',
      'header img',
    ],
  },
  {
    board: 'indeed',
    urlPattern: /(?:^|\/\/)(?:[\w-]+\.)*indeed\.com\/viewjob/i,
    titleSelectors: [
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      '[class*="jobsearch-JobInfoHeader-title"]',
      'h1',
    ],
    companySelectors: [
      '[data-testid="inlineHeader-companyName"]',
      '[data-testid="jobsearch-InlineCompanyRating-companyHeader"]',
      '[class*="companyName"]',
      'a[data-tn-element="companyName"]',
    ],
  },
  {
    board: 'smartrecruiters',
    // jobs.smartrecruiters.com/<co>/<id>
    urlPattern: /(?:^|\/\/)jobs\.smartrecruiters\.com\/[^/]+\/\d+/i,
    titleSelectors: [
      '[itemprop="title"]',
      'h1.job-title',
      'h1',
    ],
    companySelectors: [
      '[itemprop="hiringOrganization"] [itemprop="name"]',
      '.company-name',
      'header a',
    ],
  },
];

// Match a URL against the registry. Returns the registry entry or null.
export function matchBoard(href) {
  if (!href || typeof href !== 'string') return null;
  for (const entry of BOARDS) {
    if (entry.urlPattern.test(href)) return entry;
  }
  return null;
}
