'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-text-primary' }) {
  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-5">
      <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-text-secondary mt-1">{sub}</p>}
    </div>
  );
}

// ── Score badge ────────────────────────────────────────────────────────────
function ScorePill({ score }) {
  if (score == null) return <span className="text-text-secondary">—</span>;
  const color = score >= 70 ? 'bg-green-900 text-green-300'
              : score >= 40 ? 'bg-amber-900 text-amber-300'
              :               'bg-red-900 text-red-300';
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>{score}</span>;
}

// ── Section header ─────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-text-primary mb-4 border-b border-bg-tertiary pb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const qc = useQueryClient();

  // ── Auth guard ─────────────────────────────────────────────────────────
  if (status === 'loading') {
    return <div className="min-h-screen bg-bg-primary flex items-center justify-center text-text-secondary">Loading…</div>;
  }
  if (!session || session.user?.role !== 'admin') {
    if (typeof window !== 'undefined') router.replace('/dashboard');
    return null;
  }

  return <AdminDashboard qc={qc} />;
}

function AdminDashboard({ qc }) {
  const [userSearch, setUserSearch]     = useState('');
  const [jobPlatform, setJobPlatform]   = useState('');
  const [jobMinScore, setJobMinScore]   = useState('');
  const [jobMaxScore, setJobMaxScore]   = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: stats }    = useQuery({ queryKey: ['admin-stats'],    queryFn: api.admin.stats });
  const { data: users }    = useQuery({ queryKey: ['admin-users'],    queryFn: api.admin.users });
  const { data: signals }  = useQuery({ queryKey: ['admin-signals'],  queryFn: api.admin.signals });
  const { data: plxUsage } = useQuery({ queryKey: ['admin-plx'],      queryFn: api.admin.perplexityUsage });
  const { data: reposts }  = useQuery({ queryKey: ['admin-reposts'],  queryFn: api.admin.reposts });
  const { data: jobs }    = useQuery({
    queryKey: ['admin-jobs', jobPlatform, jobMinScore, jobMaxScore],
    queryFn:  () => api.admin.jobs({ platform: jobPlatform || undefined, minScore: jobMinScore || undefined, maxScore: jobMaxScore || undefined }),
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const deleteUser = useMutation({
    mutationFn: (id) => api.admin.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  const updateRole = useMutation({
    mutationFn: ({ id, role }) => api.admin.updateUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  // ── Derived ────────────────────────────────────────────────────────────
  const filteredUsers = (users || []).filter(u =>
    !userSearch || u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const signalChartData = (signals || []).slice(0, 15).map(s => ({
    name:  s.label || s.key,
    count: s.count,
    type:  s.type,
  }));

  const platforms = [...new Set((jobs || []).map(j => j.platform).filter(Boolean))];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* ── Admin banner ────────────────────────────────────────────────── */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 flex items-center gap-3">
        <span className="text-amber-400 text-lg">⚡</span>
        <span className="font-bold text-amber-300 tracking-wide">Admin Panel — Master Access</span>
        <span className="ml-auto text-xs text-amber-500">HireSignal Control Centre</span>
      </div>

      <div className="p-6 max-w-screen-xl mx-auto">

        {/* ── Stats cards ───────────────────────────────────────────────── */}
        <Section title="Overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Users"      value={stats?.totalUsers}  />
            <StatCard label="Jobs Today"       value={stats?.todayJobs}   color="text-indigo-400" />
            <StatCard label="Total Jobs"       value={stats?.totalJobs}   />
            <StatCard label="Average Score"    value={stats?.avgScore}    color="text-green-400" sub="out of 100" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="High Intent (≥70)"     value={stats?.scoreHigh}   color="text-green-400" />
            <StatCard label="Medium Intent (40–69)"  value={stats?.scoreMedium} color="text-amber-400" />
            <StatCard label="Low Intent (<40)"       value={stats?.scoreLow}    color="text-red-400" />
          </div>

          {/* Top companies + platforms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-secondary mb-3">Top 10 Companies Analysed</h3>
              <div className="space-y-1">
                {(stats?.topCompanies || []).map((c, i) => (
                  <div key={c.name} className="flex justify-between text-sm">
                    <span className="text-text-secondary">{i + 1}. {c.name}</span>
                    <span className="text-text-primary font-medium">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-secondary mb-3">Top Platforms</h3>
              <div className="space-y-1">
                {(stats?.topPlatforms || []).map((p) => (
                  <div key={p.platform} className="flex justify-between text-sm">
                    <span className="text-text-secondary capitalize">{p.platform}</span>
                    <span className="text-text-primary font-medium">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Users table ───────────────────────────────────────────────── */}
        <Section title={`Users (${filteredUsers.length})`}>
          <input
            type="text"
            placeholder="Search by email or name…"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="mb-4 w-full max-w-sm px-3 py-2 rounded-lg bg-bg-secondary border border-bg-tertiary text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-indigo-500"
          />
          <div className="overflow-x-auto rounded-xl border border-bg-tertiary">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-text-secondary">
                <tr>
                  {['Email','Name','Role','Jobs','Last Active','Joined','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-tertiary">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-bg-secondary/50">
                    <td className="px-4 py-3 text-text-primary">{u.email}</td>
                    <td className="px-4 py-3 text-text-secondary">{u.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        u.role === 'admin' ? 'bg-amber-900 text-amber-300' : 'bg-bg-tertiary text-text-secondary'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{u.total_jobs}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {u.last_active ? new Date(u.last_active).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateRole.mutate({ id: u.id, role: u.role === 'admin' ? 'user' : 'admin' })}
                          className="text-xs px-2 py-1 rounded bg-amber-900/40 text-amber-300 hover:bg-amber-900/70"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${u.email}? This cannot be undone.`))
                              deleteUser.mutate(u.id);
                          }}
                          className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300 hover:bg-red-900/70"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Jobs table ────────────────────────────────────────────────── */}
        <Section title={`All Jobs (${(jobs || []).length})`}>
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={jobPlatform}
              onChange={e => setJobPlatform(e.target.value)}
              className="px-3 py-2 rounded-lg bg-bg-secondary border border-bg-tertiary text-sm text-text-primary focus:outline-none"
            >
              <option value="">All platforms</option>
              {platforms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              type="number" placeholder="Min score" value={jobMinScore}
              onChange={e => setJobMinScore(e.target.value)}
              className="w-28 px-3 py-2 rounded-lg bg-bg-secondary border border-bg-tertiary text-sm text-text-primary focus:outline-none"
            />
            <input
              type="number" placeholder="Max score" value={jobMaxScore}
              onChange={e => setJobMaxScore(e.target.value)}
              className="w-28 px-3 py-2 rounded-lg bg-bg-secondary border border-bg-tertiary text-sm text-text-primary focus:outline-none"
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-bg-tertiary">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-text-secondary">
                <tr>
                  {['Company','Role','Score','Platform','User','Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-tertiary">
                {(jobs || []).slice(0, 200).map(j => (
                  <tr key={j.id} className="hover:bg-bg-secondary/50">
                    <td className="px-4 py-3 text-text-primary font-medium">{j.company_name || '—'}</td>
                    <td className="px-4 py-3 text-text-secondary max-w-xs truncate">{j.role_title || '—'}</td>
                    <td className="px-4 py-3"><ScorePill score={j.intent_score} /></td>
                    <td className="px-4 py-3 text-text-secondary capitalize">{j.platform || '—'}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{j.user_email}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(j.analysed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Signal performance chart ──────────────────────────────────── */}
        <Section title="Signal Performance (top 15 firing signals)">
          {signalChartData.length > 0 ? (
            <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={signalChartData} layout="vertical" margin={{ left: 160, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 11 }} width={155} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#f8fafc' }}
                    itemStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {signalChartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.type === 'positive' ? '#22c55e' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-text-secondary mt-2">Green = positive signal · Red = negative signal</p>
            </div>
          ) : (
            <p className="text-text-secondary text-sm">No signal data yet.</p>
          )}
        </Section>

        {/* ── Ghost Job Repost Tracker ──────────────────────────────────── */}
        <Section title="Ghost Job Repost Tracker">
          {(reposts || []).length === 0 ? (
            <p className="text-text-secondary text-sm">No reposted jobs detected yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-bg-tertiary">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary text-text-secondary">
                  <tr>
                    {['Company','Role','Platform','Reposts','Cache Hits','First Seen','Last Seen','Score'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-tertiary">
                  {(reposts || []).map((r, i) => (
                    <tr key={i} className="hover:bg-bg-secondary/50">
                      <td className="px-4 py-3 text-text-primary font-medium">{r.company_name}</td>
                      <td className="px-4 py-3 text-text-secondary max-w-xs truncate">{r.role_title}</td>
                      <td className="px-4 py-3 text-text-secondary capitalize">{r.platform || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-900 text-amber-300">
                          ×{r.repost_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-indigo-400 font-medium">{r.cache_hits || 0}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.first_seen_date ? new Date(r.first_seen_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.last_seen_date  ? new Date(r.last_seen_date).toLocaleDateString()  : '—'}
                      </td>
                      <td className="px-4 py-3"><ScorePill score={r.intent_score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── Perplexity usage ──────────────────────────────────────────── */}
        <Section title="Perplexity API Usage">
          {plxUsage ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Today"       value={plxUsage.today}     sub={`~$${(plxUsage.today * plxUsage.costPerCall).toFixed(3)}`} />
                <StatCard label="This Week"   value={plxUsage.thisWeek}  sub={`~$${(plxUsage.thisWeek * plxUsage.costPerCall).toFixed(2)}`} />
                <StatCard label="This Month"  value={plxUsage.thisMonth} sub={`~$${(plxUsage.thisMonth * plxUsage.costPerCall).toFixed(2)}`} />
                <StatCard label="Est. Monthly Cost" value={`$${plxUsage.estimatedMonthlyCost}`} color="text-amber-400" sub="based on last 30 days" />
              </div>

              {/* Daily bar chart */}
              {plxUsage.dailyBreakdown?.length > 0 && (
                <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
                  <p className="text-sm font-medium text-text-secondary mb-3">Daily calls — last 14 days</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={[...plxUsage.dailyBreakdown].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickFormatter={v => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                        labelStyle={{ color: '#f8fafc' }}
                        formatter={(val, name) => [val, name === 'count' ? 'API calls' : name]}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-xs text-text-secondary mt-3">
                Cost estimate: ${plxUsage.costPerCall}/call (Perplexity sonar model — ~1400 tokens/call avg).
                Total all-time calls: {plxUsage.total}.
              </p>
            </>
          ) : (
            <p className="text-text-secondary text-sm">Loading usage data…</p>
          )}
        </Section>

      </div>
    </div>
  );
}
