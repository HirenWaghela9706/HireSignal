'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export function WeeklyActivityChart({ weeklyActivity = [] }) {
  if (weeklyActivity.length === 0) {
    return (
      <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6 h-64 flex items-center justify-center text-text-secondary">
        No activity yet
      </div>
    );
  }

  const data = weeklyActivity.map(({ date, count }) => ({
    day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
    count,
  }));

  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6">
      <h3 className="font-display font-semibold mb-4">Weekly Activity</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="day" stroke="#94A3B8" />
          <YAxis stroke="#94A3B8" />
          <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
