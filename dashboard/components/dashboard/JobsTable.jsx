'use client';

import { useState, Fragment } from 'react';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import { StatusSelect } from '@/components/ui/StatusSelect';
import { api } from '@/lib/api';

const CHROME_STORE_URL = '#'; // TODO: replace with real Chrome Web Store URL

function EmptyState() {
  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl px-8 py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mb-5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803M10.5 7.5v6m3-3h-6" />
        </svg>
      </div>
      <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
        No jobs analysed yet
      </h3>
      <p className="text-text-secondary text-sm max-w-sm mx-auto mb-7 leading-relaxed">
        Install the HireSignal Chrome extension, then browse any job on LinkedIn or Indeed and click <strong className="text-text-primary font-medium">Analyse</strong>.
      </p>
      <a
        href={CHROME_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg font-medium transition text-sm shadow-lg shadow-blue-900/20"
      >
        <svg width="18" height="18" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M50,5 A45,45 0 0,1 88.97,72.5 L69.05,61 A22,22 0 0,0 50,28 Z" fill="#EA4335"/>
          <path d="M88.97,72.5 A45,45 0 0,1 11.03,72.5 L30.95,61 A22,22 0 0,0 69.05,61 Z" fill="#34A853"/>
          <path d="M11.03,72.5 A45,45 0 0,1 50,5 L50,28 A22,22 0 0,0 30.95,61 Z" fill="#FBBC05"/>
          <circle cx="50" cy="50" r="22" fill="white"/>
          <circle cx="50" cy="50" r="17" fill="#4285F4"/>
        </svg>
        Add to Chrome
      </a>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const DEFAULT_PAGE_SIZE = 20;

export function JobsTable({ jobs, onUpdate }) {
  const [expandedId,   setExpandedId]   = useState(null);
  const [sortBy,       setSortBy]       = useState('analysed_at');
  const [sortDir,      setSortDir]      = useState('desc');
  const [filterBand,   setFilterBand]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(DEFAULT_PAGE_SIZE);

  if (!jobs || jobs.length === 0) return <EmptyState />;

  const sorted = [...jobs].sort((a, b) => {
    let va = a[sortBy === 'score' ? 'intent_score' : sortBy];
    let vb = b[sortBy === 'score' ? 'intent_score' : sortBy];
    if (sortBy === 'analysed_at') {
      va = new Date(va).getTime();
      vb = new Date(vb).getTime();
    }
    if (sortBy === 'company_name') {
      va = (va || '').toLowerCase();
      vb = (vb || '').toLowerCase();
    }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const filtered = sorted.filter((j) => {
    if (filterBand) {
      const band = j.intent_score >= 70 ? 'high' : j.intent_score >= 40 ? 'medium' : 'low';
      if (band !== filterBand) return false;
    }
    if (filterStatus && j.status !== filterStatus) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * pageSize;
  const paginated  = filtered.slice(pageStart, pageStart + pageSize);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  const handleStatusUpdate = async (id, status) => {
    await api.jobs.updateStatus(id, status);
    onUpdate?.();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this job?')) return;
    await api.jobs.delete(id);
    onUpdate?.();
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1 opacity-80">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-4">
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterBand}
          onChange={handleFilterChange(setFilterBand)}
          className="bg-bg-primary border border-bg-tertiary rounded-lg px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="">All score bands</option>
          <option value="high">High (70+)</option>
          <option value="medium">Medium (40–69)</option>
          <option value="low">Low (0–39)</option>
        </select>
        <select
          value={filterStatus}
          onChange={handleFilterChange(setFilterStatus)}
          className="bg-bg-primary border border-bg-tertiary rounded-lg px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="">All statuses</option>
          <option value="saved">Saved</option>
          <option value="applied">Applied</option>
          <option value="ignored">Ignored</option>
        </select>
        <div className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="bg-bg-primary border border-bg-tertiary rounded-lg px-2 py-1.5 text-sm text-text-primary"
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-tertiary text-left text-text-secondary">
              <th className="py-3 px-2 font-medium w-10">#</th>
              <th
                className="py-3 px-2 font-medium cursor-pointer select-none"
                onClick={() => handleSort('company_name')}
              >
                Company <SortIcon col="company_name" />
              </th>
              <th className="py-3 px-2 font-medium">Role</th>
              <th
                className="py-3 px-2 font-medium cursor-pointer select-none"
                onClick={() => handleSort('intent_score')}
              >
                Score <SortIcon col="intent_score" />
              </th>
              <th className="py-3 px-2 font-medium">Red Flags</th>
              <th
                className="py-3 px-2 font-medium cursor-pointer select-none"
                onClick={() => handleSort('analysed_at')}
              >
                Date <SortIcon col="analysed_at" />
              </th>
              <th className="py-3 px-2 font-medium">Status</th>
              <th className="py-3 px-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((job, idx) => (
              <Fragment key={job.id}>
                <tr
                  className="border-b border-bg-tertiary hover:bg-bg-tertiary/30 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                >
                  <td className="py-3 px-2 text-text-secondary font-mono text-xs">
                    {pageStart + idx + 1}
                  </td>
                  <td className="py-3 px-2 text-text-primary font-medium max-w-[140px] truncate">
                    {job.company_name}
                  </td>
                  <td className="py-3 px-2 text-text-secondary max-w-[180px] truncate">
                    {job.role_title}
                  </td>
                  <td className="py-3 px-2">
                    <ScoreBadge score={job.intent_score} />
                  </td>
                  <td className="py-3 px-2">
                    {job.ghost_risk_flag
                      ? <span className="text-low text-xs font-medium">Ghost risk</span>
                      : job.repost_count > 1
                        ? <span className="text-medium text-xs">×{job.repost_count} repost</span>
                        : <span className="text-text-secondary">—</span>
                    }
                  </td>
                  <td className="py-3 px-2 text-text-secondary">
                    {job.analysed_at ? new Date(job.analysed_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect
                      jobId={job.id}
                      currentStatus={job.status}
                      onUpdate={handleStatusUpdate}
                    />
                  </td>
                  <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="text-low hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>

                {expandedId === job.id && (
                  <tr>
                    <td colSpan={8} className="py-4 px-4 bg-bg-primary/50">
                      <div className="text-sm space-y-2">
                        {job.signals?.positive?.length > 0 && (
                          <div>
                            <span className="text-text-secondary">Positive: </span>
                            {job.signals.positive.map((s, i) => (
                              <span key={i} className="text-high mr-2">{s.label}</span>
                            ))}
                          </div>
                        )}
                        {job.signals?.negative?.length > 0 && (
                          <div>
                            <span className="text-text-secondary">Negative: </span>
                            {job.signals.negative.map((s, i) => (
                              <span key={i} className="text-low mr-2">{s.label}</span>
                            ))}
                          </div>
                        )}
                        {job.url && (
                          <div>
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent text-xs hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              View original listing →
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-text-secondary text-sm">
                  No jobs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-bg-tertiary">
          <p className="text-text-secondary text-sm">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} —
            showing {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 text-sm border border-bg-tertiary rounded-lg text-text-secondary hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-text-secondary px-2">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 text-sm border border-bg-tertiary rounded-lg text-text-secondary hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
