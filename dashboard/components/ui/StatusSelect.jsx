'use client';

import { useState } from 'react';

export function StatusSelect({ jobId, currentStatus, onUpdate }) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleChange = async (newStatus) => {
    setLoading(true);
    try {
      await onUpdate(jobId, newStatus);
      setStatus(newStatus);
    } finally {
      setLoading(false);
    }
  };

  return (
    <select
      value={status}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      className="bg-bg-secondary border border-bg-tertiary rounded px-2 py-1 text-sm"
    >
      <option value="saved">Saved</option>
      <option value="applied">Applied</option>
      <option value="ignored">Ignored</option>
    </select>
  );
}
