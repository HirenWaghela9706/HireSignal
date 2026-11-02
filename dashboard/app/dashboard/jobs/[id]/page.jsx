'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import { ConfidencePill } from '@/components/ui/ConfidencePill';
import { StatusSelect } from '@/components/ui/StatusSelect';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: job, refetch } = useQuery({
    queryKey: ['job', params.id],
    queryFn: () => api.jobs.get(params.id),
    enabled: !!params.id,
  });

  if (!job) {
    return (
      <div className="p-6">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  const handleStatusUpdate = async (id, status) => {
    await api.jobs.updateStatus(id, status);
    refetch();
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="text-accent hover:underline">
        ← Back to dashboard
      </Link>

      <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold">{job.role_title}</h1>
            <p className="text-text-secondary">{job.company_name}</p>
            {job.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-accent text-sm hover:underline mt-2 inline-block">
                View job posting →
              </a>
            )}
          </div>
          <div className="flex items-center gap-4">
            <ScoreBadge score={job.intent_score} />
            <ConfidencePill level={job.confidence_level} />
            <StatusSelect jobId={job.id} currentStatus={job.status} onUpdate={handleStatusUpdate} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Posting history</h3>
            <ul className="space-y-1 text-sm">
              <li>Original post: {job.original_post_date || '—'}</li>
              <li>Last repost: {job.last_repost_date || '—'}</li>
              <li>Repost count: {job.repost_count ?? '—'}</li>
              <li>Days open: {job.days_open ?? '—'}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Analysed</h3>
            <p>{job.analysed_at ? new Date(job.analysed_at).toLocaleString() : '—'}</p>
          </div>
        </div>

        {job.signals && (
          <div className="space-y-4">
            {job.signals.positive?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-2">Positive signals</h3>
                <ul className="space-y-2">
                  {job.signals.positive.map((s, i) => (
                    <li key={i} className="flex gap-2 items-start">
                      <span className="text-high font-mono">{s.points}</span>
                      <span>{s.label} — {s.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {job.signals.negative?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-2">Negative signals</h3>
                <ul className="space-y-2">
                  {job.signals.negative.map((s, i) => (
                    <li key={i} className="flex gap-2 items-start">
                      <span className="text-low font-mono">{s.points}</span>
                      <span>{s.label} — {s.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {job.signals.noData?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-2">No data</h3>
                <ul className="space-y-2 text-nodata">
                  {job.signals.noData.map((s, i) => (
                    <li key={i}>{s.label} — {s.detail}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
