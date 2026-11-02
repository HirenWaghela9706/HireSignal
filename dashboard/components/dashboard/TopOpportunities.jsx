'use client';

import Link from 'next/link';
import { ScoreBadge } from '@/components/ui/ScoreBadge';

export function TopOpportunities({ jobs = [] }) {
  const top = jobs
    .filter((j) => j.intent_score >= 70)
    .sort((a, b) => (b.intent_score || 0) - (a.intent_score || 0))
    .slice(0, 3);

  if (top.length === 0) {
    return (
      <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6">
        <h3 className="font-display font-semibold mb-4">Top High-Intent Opportunities</h3>
        <p className="text-text-secondary text-sm">No high-intent jobs yet. Install the extension to start analysing.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6">
      <h3 className="font-display font-semibold mb-4">Top High-Intent Opportunities</h3>
      <div className="space-y-3">
        {top.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="block p-3 rounded-lg border border-bg-tertiary hover:border-accent transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{job.company_name}</p>
                <p className="text-sm text-text-secondary">{job.role_title}</p>
              </div>
              <ScoreBadge score={job.intent_score} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
