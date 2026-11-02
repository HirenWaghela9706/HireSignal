import React from 'react';
import styles from './overlay.module.css';

const LABEL_MAP = {
  repostFrequency: 'Reposted Role',
  layoffDetected: 'Layoffs Detected',
  jobStaleness: 'Stale Job',
  recentFunding: 'Recent Funding',
  headcountGrowth: 'Headcount Growth',
  duplicateRoles: 'Duplicate Roles'
};

export function SignalTags({ signals }) {
  if (!signals) return null;
  const tags = [];
  (signals.negative || []).forEach(s => {
    tags.push({ key: s.key, label: s.label || LABEL_MAP[s.key] || s.key, type: 'negative' });
  });
  (signals.positive || []).forEach(s => {
    tags.push({ key: s.key, label: s.label || LABEL_MAP[s.key] || s.key, type: 'positive' });
  });
  if (tags.length === 0) return null;
  return (
    <div className={styles.tags}>
      {tags.map(t => (
        <span key={t.key} className={styles.tag}>{t.label}</span>
      ))}
    </div>
  );
}
