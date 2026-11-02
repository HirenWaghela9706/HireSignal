'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { JobsTable } from '@/components/dashboard/JobsTable';
import { ScoreDistributionChart } from '@/components/dashboard/ScoreDistributionChart';
import { WeeklyActivityChart } from '@/components/dashboard/WeeklyActivityChart';
import { TopOpportunities } from '@/components/dashboard/TopOpportunities';
import { GhostJobAlerts } from '@/components/dashboard/GhostJobAlerts';
import { TestJobInput } from '@/components/dashboard/TestJobInput';
import { OnboardingModal } from '@/components/dashboard/OnboardingModal';

export default function DashboardPage() {
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const { data: jobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.jobs.list,
  });

  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: api.dashboard.summary,
  });

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
  });

  const showOnboarding = !onboardingDismissed && user && user.onboarding_complete === false;

  const { total = 0, highIntent = 0, ghostRisk = 0, applied = 0, scoreDistribution = {}, weeklyActivity = [] } = summary || {};

  return (
    <div className="space-y-6">
      {showOnboarding && (
        <OnboardingModal onComplete={() => setOnboardingDismissed(true)} />
      )}

      <h1 className="text-2xl font-display font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
          <p className="text-text-secondary text-sm">Total analysed</p>
          <p className="text-2xl font-mono font-bold">{total}</p>
        </div>
        <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
          <p className="text-text-secondary text-sm">High intent</p>
          <p className="text-2xl font-mono font-bold text-high">{highIntent}</p>
        </div>
        <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
          <p className="text-text-secondary text-sm">Ghost risk</p>
          <p className="text-2xl font-mono font-bold text-low">{ghostRisk}</p>
        </div>
        <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
          <p className="text-text-secondary text-sm">Applied</p>
          <p className="text-2xl font-mono font-bold">{applied}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <TopOpportunities jobs={jobs} />
        <GhostJobAlerts jobs={jobs} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ScoreDistributionChart
          high={scoreDistribution.high}
          medium={scoreDistribution.medium}
          low={scoreDistribution.low}
        />
        <WeeklyActivityChart weeklyActivity={weeklyActivity} />
      </div>

      <div>
        <h2 className="text-lg font-display font-semibold mb-4">Job Analysis Table</h2>
        <JobsTable jobs={jobs} onUpdate={refetchJobs} />
      </div>

      <TestJobInput onSuccess={refetchJobs} />
    </div>
  );
}
