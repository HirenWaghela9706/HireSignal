'use client';

// Patterns that indicate a page-title artifact rather than a real job title.
const BAD_ROLE_PATTERNS = [
  /welcome back/i,
  /recommended jobs/i,
  /job search/i,
  /search results/i,
  /sign in/i,
  /log in/i,
  /my feed/i,
  /notifications/i,
  /glassdoor/i,
  /linkedin/i,
  /indeed\.com/i,
  /for you$/i,
  /jobs near/i,
];

function isValidEntry(job) {
  const company = (job.company_name || '').trim();
  const role    = (job.role_title   || '').trim();
  if (company.length < 3 || role.length < 4) return false;
  if (role.length > 100) return false;
  if (BAD_ROLE_PATTERNS.some(p => p.test(role))) return false;
  return true;
}

function ExpiryBadge({ days }) {
  if (days == null) return <span className="text-text-secondary">—</span>;
  if (days < 0)  return <span className="text-low   text-xs font-medium">Likely expired</span>;
  if (days <= 7) return <span className="text-medium text-xs font-medium">Expires in {days}d</span>;
  return <span className="text-text-secondary text-xs">~{days}d left</span>;
}

export function GhostJobAlerts({ jobs = [] }) {
  // A repost_count >= 1 means the same company+role has appeared with a
  // different job ID or after the platform expiry window — genuine ghost job signal.
  const reposted = jobs
    .filter(isValidEntry)
    .filter((j) => (j.repost_count || 0) >= 1)
    .sort((a, b) => (b.repost_count || 0) - (a.repost_count || 0));

  if (reposted.length === 0) {
    return (
      <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6">
        <h3 className="font-display font-semibold mb-1">Ghost Job Alerts</h3>
        <p className="text-text-secondary text-sm">No reposted jobs detected in your history.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6">
      <h3 className="font-display font-semibold mb-4">
        Ghost Job Alerts
        <span className="ml-2 text-xs font-normal text-medium bg-medium/10 px-2 py-0.5 rounded">
          {reposted.length} reposted
        </span>
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary text-xs border-b border-bg-tertiary">
              <th className="text-left pb-2 font-medium">Company</th>
              <th className="text-left pb-2 font-medium">Role</th>
              <th className="text-center pb-2 font-medium">Times Reposted</th>
              <th className="text-left pb-2 font-medium hidden sm:table-cell">First Posted</th>
              <th className="text-left pb-2 font-medium hidden sm:table-cell">Last Seen</th>
              <th className="text-left pb-2 font-medium">Expiry</th>
              <th className="text-center pb-2 font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-tertiary">
            {reposted.slice(0, 10).map((job) => {
              const score = job.intent_score;
              const scoreColor = score >= 70 ? 'text-high'
                               : score >= 40 ? 'text-medium'
                               :               'text-low';
              const firstPosted = job.original_post_date || job.first_seen_date;
              const daysUntilExpiry = job.days_until_expiry != null
                ? parseInt(job.days_until_expiry, 10)
                : null;

              return (
                <tr key={job.id} className="hover:bg-bg-tertiary/30">
                  <td className="py-2 pr-3 text-text-primary font-medium truncate max-w-[120px]">
                    {job.company_name}
                  </td>
                  <td className="py-2 pr-3 text-text-secondary truncate max-w-[140px]">
                    {job.role_title}
                  </td>
                  <td className="py-2 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-medium/10 text-medium">
                      ×{job.repost_count}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-text-secondary text-xs hidden sm:table-cell">
                    {firstPosted ? new Date(firstPosted).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2 pr-3 text-text-secondary text-xs hidden sm:table-cell">
                    {job.last_seen_date ? new Date(job.last_seen_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <ExpiryBadge days={daysUntilExpiry} />
                  </td>
                  <td className="py-2 text-center">
                    <span className={`font-mono font-bold text-xs ${scoreColor}`}>
                      {score ?? '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-secondary mt-3">
        Repost detection uses job IDs when available, then platform expiry windows
        (LinkedIn/Indeed/Glassdoor: 30d · Greenhouse/Lever/Workday: 90d · Other: 60d).
      </p>
    </div>
  );
}
