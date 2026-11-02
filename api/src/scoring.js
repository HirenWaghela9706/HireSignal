// Returns signal definitions parameterised by company type.
// PUBLIC companies (ticker found): higher repost/layoff weights, no funding signal.
// PRIVATE companies: original weights + funding signal.
// Both types include: seniorRoleConflict, layoffCorroborated, companyLegitimacy.
//
// TRUST RULE: every fired signal must carry verifiable evidence before it can
// affect the score. Evidence can be either (a) an external source URL (news
// article, Yahoo Finance quote page, Wikidata, Google Trends) or (b) a
// human-readable description of what HireSignal found in its own database
// (repost history, senior role conflict, stale listing date).
// Signals with neither are downgraded to noData.
function getSignals(isPublic) {
  return {
    repostFrequency: {
      weight: isPublic ? -30 : -25,
      condition: (data) => data.repostCount > 3 && data.daysSinceFirstPost <= 90,
      label: 'Repost Frequency',
      getDetail: (data) => `Role reposted ${data.repostCount} times in 90 days`,
      getSource: (data) => data.repostSource || null,
    },
    layoffDetected: {
      weight: isPublic ? -25 : -20,
      condition: (data) => data.layoffDetected === true,
      label: 'Layoff History',
      getDetail: () => 'Recent layoff announcement detected',
      getSource: (data) => data.layoffSource || null,
    },
    jobStaleness: {
      weight: -15,
      condition: (data) => data.daysOpen > 60,
      scale: (data) => Math.min(1, (data.daysOpen - 60) / 60),
      label: 'Stale Listing',
      getDetail: (data) => `Role has been open for ${data.daysOpen} days`,
      getSource: (data) => data.staleSource || null,
    },
    // Funding signal only for private companies.
    ...(!isPublic ? {
      recentFunding: {
        weight: 15,
        condition: (data) => data.fundingRecencyDays && data.fundingRecencyDays <= 365,
        label: 'Recent Funding Event',
        getDetail: (data) => data.fundingRecencyDays
          ? `Series A+ funding detected ${Math.round(data.fundingRecencyDays / 30)} months ago`
          : 'Recent funding event detected',
        getSource: (data) => data.fundingSource || null,
      }
    } : {}),
    // Fires for any non-null trend so headcount always contributes to confidence.
    headcountTrend: {
      weight: 10,
      condition: (data) => data.headcountTrend !== null,
      direction: (data) => data.headcountTrend === 'growing'  ?  1
                         : data.headcountTrend === 'declining' ? -1
                         : 0,
      label: 'Headcount Trend',
      getDetail: (data) => data.headcountTrend === 'growing'  ? 'Company headcount is growing'
                         : data.headcountTrend === 'declining' ? 'Company headcount is declining'
                         : 'Company headcount is stable',
      // Perplexity headcountSource takes priority; Yahoo Finance is fallback.
      getSource: (data) => data.headcountSource || data.yahooSource || null,
    },
    duplicateRoles: {
      weight: -5,
      condition: (data) => data.identicalOpenRoles > 5,
      label: 'Duplicate Roles',
      getDetail: (data) => `${data.identicalOpenRoles} identical roles open`,
      getSource: (data) => data.repostSource || null,
    },
    industryMomentum: {
      weight: 5,
      condition: (data) => data.industryMomentum !== null,
      direction: (data) => data.industryMomentum === 'positive' ? 1 : -1,
      label: 'Industry Momentum',
      getDetail: (data) => data.industryMomentum === 'positive'
        ? 'Rising search interest for this role at this company'
        : 'Declining search interest for this role at this company',
      getSource: (data) => data.trendsSource || null,
    },
    // Posting Age: mild early-warning signal once a job has been open 30+ days.
    // Complements jobStaleness (which fires harder at 60+ days).
    postingAge: {
      weight: -5,
      condition: (data) => data.daysOpenForAge !== null && data.daysOpenForAge > 30,
      label: 'Posting Age',
      getDetail: (data) => `Listed ${data.daysOpenForAge} days ago`,
      getSource: (data) => data.staleSource || null,
    },
    seniorRoleConflict: {
      weight: -15,
      condition: (data) => data.hasSeniorRoleConflict === true,
      label: 'Possible Role Uncertainty',
      getDetail: () => 'A senior version of this role was recently posted by the same company',
      getSource: (data) => data.seniorSource || null,
    },
    // Multi-source corroboration bonus: fires in addition to layoffDetected when
    // 2+ independent news sources have reported layoffs at this company.
    layoffCorroborated: {
      weight: -8,
      condition: (data) => data.layoffDetected && (data.layoffSourceCount || 0) >= 2,
      label: 'Layoff Confirmed (Multiple Sources)',
      getDetail: (data) => `Layoff reported by ${data.layoffSourceCount} independent sources`,
      getSource: (data) => data.layoffSource || null,
    },
    // EU regulatory layoff: legally required public filing — high confidence.
    // Separate from the standard layoffDetected so it always shows as its own
    // signal with the specific EU regulation language.
    euRegulatoryLayoff: {
      weight: -25,
      condition: (data) => data.euRegulatoryLayoff === true,
      label: 'EU Collective Redundancy Notice',
      getDetail: () => 'Legally mandated collective redundancy notice filed under EU Directive 98/59/EC',
      getSource: (data) => data.euRegulatorySource || data.layoffSource || null,
    },
    // EURES posting volume: active EU job postings indicate real hiring intent.
    // Only fires for EU-detected companies with meaningful posting counts.
    euresPostings: {
      weight: 6,
      condition: (data) => data.euresPostingCount !== null && data.euresPostingCount > 3,
      direction: () => 1,
      label: 'Active EU Job Postings',
      getDetail: (data) => `${data.euresPostingCount} active job postings on EURES EU portal`,
      getSource: (data) => data.euresSource || null,
    },
    // Company legitimacy: Wikidata confirms the company exists and is established.
    companyLegitimacy: {
      weight: 8,
      condition: (data) => data.wikidataSource !== null,
      direction: () => 1,
      label: 'Company Verified',
      getDetail: (data) => data.wikidataEmployees
        ? `Known company with ~${data.wikidataEmployees.toLocaleString()} employees on record`
        : 'Company information verified via public records',
      getSource: (data) => data.wikidataSource || null,
    },
    // Major negative news (Perplexity primary source): serious events like fraud,
    // bankruptcy, criminal investigation, or major regulatory action.
    // Distinct from layoffDetected — fires independently for non-layoff bad news.
    majorNegativeNews: {
      weight: -12,
      condition: (data) => data.hasNegativeNews === true,
      label: 'Major Negative News',
      getDetail: () => 'Significant negative event detected (fraud, bankruptcy, or regulatory action)',
      getSource: (data) => data.negativeNewsSource || null,
    },
    // ── Perplexity hiring signals ──────────────────────────────────────────
    activelyHiring: {
      weight: 12,
      condition: (data) => data.isActivelyHiring === true,
      label: 'Actively Hiring',
      getDetail: () => 'Company has multiple open roles posted publicly',
      getSource: (data) => data.activelyHiringSource || null,
    },
    hiringFreeze: {
      weight: -20,
      condition: (data) => data.hiringFreezeDetected === true,
      label: 'Hiring Freeze Detected',
      getDetail: () => 'Hiring freeze or headcount reduction reported in the last 6 months',
      getSource: (data) => data.hiringFreezeSource || null,
    },
    multipleOpenRoles: {
      weight: 8,
      condition: (data) => data.openRolesCount !== null && data.openRolesCount > 5,
      label: 'Multiple Open Roles',
      getDetail: (data) => `${data.openRolesCount} open roles currently posted`,
      getSource: (data) => data.activelyHiringSource || null,
    },
    // ── Perplexity repost signal ───────────────────────────────────────────
    // Distinct from the DB-based repostFrequency signal.
    perplexityRepost: {
      weight: -10, // overridden by getWeight below
      condition: (data) => data.rolePreviouslyPosted === true,
      getWeight: (data) => {
        const n = data.repostCountPerplexity;
        if (typeof n === 'number' && n >= 3) return -25;
        if (typeof n === 'number' && n === 2) return -15;
        return -10;
      },
      label: (data) => {
        const n = data.repostCountPerplexity;
        if (typeof n === 'number' && n >= 3) return 'Frequently Reposted Role';
        if (typeof n === 'number' && n === 2) return 'Role Reposted';
        return 'Possible Repost';
      },
      getDetail: (data) => {
        const n = data.repostCountPerplexity;
        if (typeof n === 'number' && n >= 1) return `Role has been reposted ~${n} time(s)`;
        return 'Role may have been previously posted';
      },
      getSource: (data) => data.repostSourcePerplexity || null,
    },
    // ── Perplexity industry momentum ──────────────────────────────────────
    // Distinct from the Google Trends-based industryMomentum signal.
    perplexityIndustryMomentum: {
      weight: 8, // overridden by getWeight / direction below
      condition: (data) => data.industryMomentumTrend !== null && data.industryMomentumTrend !== 'stable',
      getWeight: (data) => {
        if (data.industryMomentumTrend === 'growing')   return 8;
        if (data.industryMomentumTrend === 'declining') return -10;
        if (data.industryMomentumTrend === 'volatile')  return -5;
        return 0;
      },
      label: (data) => {
        if (data.industryMomentumTrend === 'growing')   return 'Growing Industry';
        if (data.industryMomentumTrend === 'declining') return 'Declining Industry';
        if (data.industryMomentumTrend === 'volatile')  return 'Volatile Industry';
        return 'Industry Momentum';
      },
      getDetail: (data) => data.industryMomentumTrend
        ? `Industry trend: ${data.industryMomentumTrend}`
        : 'Industry momentum data available',
      getSource: (data) => data.industryMomentumSource || null,
    },
    // ── Perplexity company info signals ───────────────────────────────────
    publiclyListed: {
      weight: 5,
      condition: (data) => data.isPublicCompany === true,
      label: 'Publicly Listed Company',
      getDetail: () => 'Company is publicly traded — financials and performance are transparent',
      getSource: (data) => data.wikidataSource || data.industryMomentumSource || null,
    },
    recentAcquisitionActivity: {
      weight: 8,
      condition: (data) => data.recentAcquisitions !== null,
      label: 'Recent Acquisition Activity',
      getDetail: (data) => typeof data.recentAcquisitions === 'string'
        ? data.recentAcquisitions
        : 'Company has made recent acquisitions',
      getSource: (data) => data.industryMomentumSource || data.activelyHiringSource || null,
    },
  };
}

const BASELINE = 50;

function getBand(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function calculateScore(jobData) {
  const isPublic = jobData.isPublic === true;
  const signals  = getSignals(isPublic);

  let score = BASELINE;
  const applied = { positive: [], negative: [], noData: [] };

  const data = {
    repostCount:           jobData.repostCount           ?? 0,
    daysSinceFirstPost:    jobData.daysSinceFirstPost    ?? 999,
    daysOpen:              jobData.daysOpen              ?? 0,
    daysOpenForAge:        jobData.daysOpenForAge        ?? null,
    layoffDetected:        jobData.layoffDetected        ?? false,
    layoffSourceCount:     jobData.layoffSourceCount     ?? 0,
    fundingRecencyDays:    jobData.fundingRecencyDays    ?? null,
    fundingSourceCount:    jobData.fundingSourceCount    ?? 0,
    headcountTrend:        jobData.headcountTrend        ?? null,
    identicalOpenRoles:    jobData.identicalOpenRoles    ?? 0,
    industryMomentum:      jobData.industryMomentum      ?? null,
    hasSeniorRoleConflict: jobData.hasSeniorRoleConflict ?? false,
    wikidataEmployees:     jobData.wikidataEmployees     ?? null,
    wikidataSource:        jobData.wikidataSource        ?? null,
    // Perplexity primary source
    hasNegativeNews:       jobData.hasNegativeNews       ?? false,
    negativeNewsSource:    jobData.negativeNewsSource    ?? null,
    // Perplexity hiring signals
    isActivelyHiring:      jobData.isActivelyHiring      ?? false,
    activelyHiringSource:  jobData.activelyHiringSource  ?? null,
    hiringFreezeDetected:  jobData.hiringFreezeDetected  ?? false,
    hiringFreezeSource:    jobData.hiringFreezeSource    ?? null,
    openRolesCount:        jobData.openRolesCount        ?? null,
    // Perplexity repost signals
    rolePreviouslyPosted:    jobData.rolePreviouslyPosted    ?? false,
    repostCountPerplexity:   jobData.repostCountPerplexity   ?? null,
    repostSourcePerplexity:  jobData.repostSourcePerplexity  ?? null,
    // Perplexity industry momentum
    industryMomentumTrend:   jobData.industryMomentumTrend  ?? null,
    industryMomentumSource:  jobData.industryMomentumSource ?? null,
    // Perplexity company info extras
    isPublicCompany:         jobData.isPublicCompany         ?? false,
    recentAcquisitions:      jobData.recentAcquisitions      ?? null,
    // EU-specific fields
    country:              jobData.country              ?? null,
    euRegulatoryLayoff:   jobData.euRegulatoryLayoff   ?? false,
    euresPostingCount:    jobData.euresPostingCount    ?? null,
    layoffSource:         jobData.layoffSource         ?? null,
    fundingSource:        jobData.fundingSource        ?? null,
    yahooSource:          jobData.yahooSource          ?? null,
    trendsSource:         jobData.trendsSource         ?? null,
    euRegulatorySource:   jobData.euRegulatorySource   ?? null,
    euresSource:          jobData.euresSource          ?? null,
    repostSource:         jobData.repostSource         ?? null,
    staleSource:          jobData.staleSource          ?? null,
    seniorSource:         jobData.seniorSource         ?? null,
  };

  const totalSignals = Object.keys(signals).length;
  let signalCount = 0;

  for (const [key, config] of Object.entries(signals)) {
    if (!config.condition(data)) {
      const noDataLabel = typeof config.label === 'function' ? config.label(data) : config.label;
      applied.noData.push({ key, label: noDataLabel, detail: 'Insufficient data' });
      continue;
    }

    // TRUST RULE: every fired signal must have verifiable evidence — either an
    // external source URL (news article, Yahoo Finance) or a human-readable
    // description of what was found in the HireSignal database.
    // Signals with zero evidence of either kind are downgraded to noData.
    const source = config.getSource ? config.getSource(data) : null;
    if (!source?.url && !source?.description) {
      const noSrcLabel = typeof config.label === 'function' ? config.label(data) : config.label;
      applied.noData.push({ key, label: noSrcLabel, detail: 'No verified source available' });
      continue;
    }

    signalCount++;
    let points = config.getWeight ? config.getWeight(data) : config.weight;
    if (config.scale)     points *= config.scale(data);
    if (config.direction) points *= config.direction(data);
    const isPositive = points > 0;
    score = Math.max(0, Math.min(100, score + points));
    const pointsStr = points > 0 ? `+${Math.round(points)}` : `${Math.round(points)}`;
    const label = typeof config.label === 'function' ? config.label(data) : config.label;
    applied[isPositive ? 'positive' : 'negative'].push({
      key,
      label,
      points: pointsStr,
      detail: config.getDetail ? config.getDetail(data) : '',
      source,
    });
  }

  // Confidence-gating: cap score based on how many signals had real data.
  // Prevents high scores when almost nothing could be verified.
  let confidence;
  let cappedScore = Math.round(score);
  if (signalCount >= 5) {
    confidence  = 'high';
  } else if (signalCount >= 3) {
    confidence  = 'medium';
    cappedScore = Math.min(cappedScore, 70);
  } else if (signalCount >= 1) {
    confidence  = 'low';
    cappedScore = Math.min(cappedScore, 58);
  } else {
    confidence  = 'insufficient';
    cappedScore = Math.min(cappedScore, 45);
  }

  const ghostRiskFlag = (data.layoffDetected || data.repostCount > 3) && cappedScore < 40;

  return {
    score: cappedScore,
    confidence,
    band: getBand(cappedScore),
    ghostRiskFlag,
    signals: applied,
    signalCount,
    totalSignals,
    isPublic,
  };
}

module.exports = { calculateScore, getBand, getSignals };
