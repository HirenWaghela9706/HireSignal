import React from 'react';
import styles from './overlay.module.css';

export function ScoreBadge({ score, band }) {
  const bandClass = band === 'high' ? styles.high : band === 'medium' ? styles.medium : band === 'low' ? styles.low : styles.nodata;
  return (
    <div className={`${styles.badge} ${bandClass}`}>
      {score ?? '—'}
    </div>
  );
}
