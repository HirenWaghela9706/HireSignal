'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

const COLORS = { high: '#22C55E', medium: '#F59E0B', low: '#EF4444' };

export function ScoreDistributionChart({ high = 0, medium = 0, low = 0 }) {
  const data = [
    { name: 'High Intent (70+)', value: high, color: COLORS.high },
    { name: 'Moderate (40-69)', value: medium, color: COLORS.medium },
    { name: 'Low Intent (0-39)', value: low, color: COLORS.low },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6 h-64 flex items-center justify-center text-text-secondary">
        No score data yet
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6">
      <h3 className="font-display font-semibold mb-4">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
