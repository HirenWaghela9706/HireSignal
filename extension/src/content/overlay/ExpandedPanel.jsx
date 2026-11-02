import React from 'react';
import styles from './overlay.module.css';

// Renders the " · via Source ↗" (or plain text) citation at the end of a signal row.
// Three patterns:
//   1. External URL only      → "via Fortune ↗"              (news articles, Yahoo Finance)
//   2. Description + URL      → "Posted 47 days ago · via job listing date ↗"  (stale listing)
//   3. Description, no URL    → "Seen 3 times since Jan 2026 · via HireSignal database"
function SourceCitation({ source }) {
  if (!source) return null;
  const { url, name, description } = source;

  const viaNode = url
    ? <a className={styles.sourceLink} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>via {name} ↗</a>
    : <span className={styles.sourcePlain}>via {name}</span>;

  return (
    <>
      {' · '}
      {description && <>{description}{' · '}</>}
      {viaNode}
    </>
  );
}

// A single signal row. Shown only when the signal carries either a URL or a
// human-readable description — matching the trust rule enforced in scoring.js.
function VerifiedSignalRow({ s, pointsClass }) {
  if (!s.source?.url && !s.source?.description) return null;
  return (
    <div className={styles.signalRow}>
      <span className={`${styles.signalPoints} ${pointsClass}`}>{s.points}</span>
      <span className={styles.signalBody}>
        {s.label} — {s.detail}
        <SourceCitation source={s.source} />
      </span>
    </div>
  );
}

export function ExpandedPanel({ signals }) {
  if (!signals) return null;

  const positive = (signals.positive || []).filter(s => s.source?.url || s.source?.description);
  const negative = (signals.negative || []).filter(s => s.source?.url || s.source?.description);
  const noData   = signals.noData || [];

  return (
    <div className={styles.expanded}>
      {positive.length > 0 && (
        <div className={styles.signalGroup}>
          <div className={styles.signalGroupTitle}>Positive signals</div>
          {positive.map((s, i) => (
            <VerifiedSignalRow key={i} s={s} pointsClass={styles.positive} />
          ))}
        </div>
      )}
      {negative.length > 0 && (
        <div className={styles.signalGroup}>
          <div className={styles.signalGroupTitle}>Negative signals</div>
          {negative.map((s, i) => (
            <VerifiedSignalRow key={i} s={s} pointsClass={styles.negative} />
          ))}
        </div>
      )}
      {noData.length > 0 && (
        <div className={styles.signalGroup}>
          <div className={styles.signalGroupTitle}>No data</div>
          {noData.map((s, i) => (
            <div key={i} className={`${styles.signalRow} ${styles.neutral}`}>
              <span className={styles.signalBody}>{s.label} — {s.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
