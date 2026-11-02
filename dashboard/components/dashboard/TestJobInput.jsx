'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export function TestJobInput({ onSuccess }) {
  const [url, setUrl] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [mockScore, setMockScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (process.env.NODE_ENV !== 'development') return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.jobs.test({
        url: url || undefined,
        company: company || undefined,
        role: role || undefined,
        mockScore: mockScore ? parseInt(mockScore, 10) : undefined,
      });
      setUrl('');
      setCompany('');
      setRole('');
      setMockScore('');
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6 border-dashed">
      <h3 className="font-display font-semibold mb-4 text-medium">Test Job Input (Dev only)</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="url"
          placeholder="Job URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full py-2 px-3 bg-bg-primary border border-bg-tertiary rounded-lg text-sm"
        />
        <input
          type="text"
          placeholder="Company name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-full py-2 px-3 bg-bg-primary border border-bg-tertiary rounded-lg text-sm"
        />
        <input
          type="text"
          placeholder="Role title"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full py-2 px-3 bg-bg-primary border border-bg-tertiary rounded-lg text-sm"
        />
        <input
          type="number"
          placeholder="Mock score (optional)"
          value={mockScore}
          onChange={(e) => setMockScore(e.target.value)}
          min="0"
          max="100"
          className="w-full py-2 px-3 bg-bg-primary border border-bg-tertiary rounded-lg text-sm"
        />
        {error && <p className="text-low text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
        >
          Add test job
        </button>
      </form>
    </div>
  );
}
