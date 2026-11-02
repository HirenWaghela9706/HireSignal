import React from 'react';
import { createRoot } from 'react-dom/client';
import styles from './popup.module.css';

// Ask the active tab's content script for the latest detection. If the
// content script isn't loaded (sendMessage error), inject it and retry once.
async function askContentScriptToDetect(tabId) {
  function sendOnce() {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'DETECT_JOB' }, (response) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(response?.result || null);
      });
    });
  }
  let result = await sendOnce();
  if (result) return result;

  // No receiver — inject the content script then retry.
  const manifest = chrome.runtime.getManifest();
  const jsFiles  = manifest.content_scripts?.[0]?.js || [];
  if (!jsFiles.length) return null;

  await new Promise((resolve) => {
    chrome.scripting.executeScript(
      { target: { tabId }, files: jsFiles },
      () => { void chrome.runtime.lastError; resolve(); }
    );
  });
  // Give the script a beat to run its initial detection.
  await new Promise(r => setTimeout(r, 400));
  return await sendOnce();
}

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:3000';
const API_URL       = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Strip non-serializable values before sending over the Chrome message bus.
// Replaces: Error → { message }, undefined → null, and handles circular refs.
function safeMessage(obj) {
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    if (value instanceof Error) return { message: value.message, stack: value.stack };
    if (value === undefined)    return null;
    return value;
  }));
}

// ── Main popup component ────────────────────────────────────────────────────
function Popup() {
  const [token,      setToken]      = React.useState(null);
  // null = still loading from storage; false = loaded, no token
  const [tokenReady, setTokenReady] = React.useState(false);

  // 'detecting' | 'not_job' | 'ready' | 'scanning' | 'done' | 'error'
  const [phase,      setPhase]      = React.useState('detecting');
  const [detected,   setDetected]   = React.useState(null);  // { company, role, url, platform }
  const [phaseError, setPhaseError] = React.useState('');
  const [result,     setResult]     = React.useState(null);
  const tabIdRef                    = React.useRef(null);

  // Load stored token, then validate it against the API to catch expiry
  React.useEffect(() => {
    chrome.storage.local.get(['token'], async (r) => {
      const stored = r.token || null;
      if (!stored) {
        setToken(null);
        setTokenReady(true);
        return;
      }
      // Quick server-side validation — catches expired / revoked tokens
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (res.ok) {
          setToken(stored);
          chrome.runtime.sendMessage(safeMessage({ type: 'FETCH_PREFERENCES' }));
        } else {
          // Token rejected — clear it so the Connect screen shows
          chrome.storage.local.remove(['token']);
          setToken(null);
        }
      } catch {
        // API unreachable — keep token and let the analyse step surface the error
        setToken(stored);
        chrome.runtime.sendMessage(safeMessage({ type: 'FETCH_PREFERENCES' }));
      }
      setTokenReady(true);
    });
  }, []);

  // Listen for token stored by the background (after dashboard connect flow)
  React.useEffect(() => {
    const listener = (changes) => {
      if (changes.token?.newValue) {
        setToken(changes.token.newValue);
        setTokenReady(true);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Auto-detect when token is available and phase is 'detecting'
  React.useEffect(() => {
    if (!token || phase !== 'detecting') return;

    let cancelled = false;

    (async () => {
      let tabs;
      try {
        tabs = await new Promise((res, rej) =>
          chrome.tabs.query({ active: true, currentWindow: true }, (t) =>
            chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(t)
          )
        );
      } catch {
        if (!cancelled) { setPhase('error'); setPhaseError('Could not access active tab'); }
        return;
      }

      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        if (!cancelled) { setPhase('not_job'); setPhaseError('No active tab'); }
        return;
      }
      tabIdRef.current = tabId;

      let det;
      try {
        det = await askContentScriptToDetect(tabId);
      } catch {
        if (!cancelled) { setPhase('not_job'); setPhaseError('Cannot inspect this page'); }
        return;
      }
      if (cancelled) return;

      if (!det || det.kind !== 'job') {
        setPhase('not_job');
        setPhaseError(det?.reason || 'No job listing detected on this page');
        return;
      }

      setDetected({
        company:  det.company  || 'Unknown company',
        role:     det.title    || 'Unknown role',
        url:      det.url,
        platform: det.board    || 'generic',
      });

      // Auto-check the job_scans cache before showing the Analyse button.
      // If this job was already scanned, show the result immediately.
      try {
        const cacheData = await new Promise((res, rej) =>
          chrome.runtime.sendMessage(safeMessage({ type: 'CHECK_CACHE', url: det.url }), (response) => {
            if (chrome.runtime.lastError) return rej(chrome.runtime.lastError);
            res(response);
          })
        );
        if (!cancelled && cacheData?.hit) {
          setResult({
            score:              cacheData.score,
            band:               cacheData.band,
            company:            det.company || 'Unknown company',
            role:               det.title   || 'Unknown role',
            signals:            cacheData.signals,
            confidence:         cacheData.confidence,
            ghostRiskFlag:      false,
            cached:             true,
            cachedAt:           cacheData.cachedAt,
            cacheHit:           false,
            repostCount:        0,
            daysUntilExpiry:    null,
            daysOpen:           null,
            platformExpiryDays: null,
            signalCount:        null,
            totalSignals:       null,
          });
          setPhase('done');
          return;
        }
      } catch { /* cache miss or error — show Analyse button */ }

      if (!cancelled) setPhase('ready');
    })();

    return () => { cancelled = true; };
  }, [token, phase]);

  const handleAnalyse = async (forceRescan = false) => {
    setPhase('scanning');
    setResult(null);

    const payload = {
      url:          detected.url,
      companyName:  detected.company,
      roleTitle:    detected.role,
      platform:     detected.platform,
      force_rescan: forceRescan === true,   // always boolean, never undefined
    };

    let scoreData;
    try {
      scoreData = await new Promise((res, rej) =>
        chrome.runtime.sendMessage(safeMessage({ type: 'ANALYSE_JOB', payload }), (response) => {
          if (chrome.runtime.lastError) return rej(chrome.runtime.lastError);
          if (response?.error)          return rej(new Error(response.error));
          res(response?.data);
        })
      );
    } catch (err) {
      setPhase('error');
      setPhaseError(err.message || 'Analysis failed');
      return;
    }

    if (!scoreData) {
      setPhase('error');
      setPhaseError('No score returned from API');
      return;
    }

    setResult({
      score:              scoreData.score,
      band:               scoreData.band,
      company:            detected.company,
      role:               detected.role,
      signals:            scoreData.signals,
      confidence:         scoreData.confidence,
      ghostRiskFlag:      scoreData.ghostRiskFlag,
      cacheHit:           scoreData.cacheHit        || false,
      cached:             scoreData.cached           || false,
      cachedAt:           scoreData.cachedAt         || null,
      repostCount:        scoreData.repostCount      || 0,
      daysUntilExpiry:    scoreData.daysUntilExpiry  ?? null,
      daysOpen:           scoreData.daysOpen         ?? null,
      platformExpiryDays: scoreData.platformExpiryDays ?? null,
      signalCount:        scoreData.signalCount      ?? null,
      totalSignals:       scoreData.totalSignals     ?? null,
    });
    setPhase('done');
  };

  const handleRescan = () => {
    setResult(null);
    setDetected(null);
    setPhaseError('');
    setPhase('detecting');
  };

  const handleDisconnect = () => {
    chrome.storage.local.remove(['token']);
    setToken(null);
    setResult(null);
    setPhase('detecting');
  };

  const handleConnect = () => {
    const extId = chrome.runtime.id;
    chrome.tabs.create({
      url: `${DASHBOARD_URL}/auth/connect-extension?extId=${extId}`,
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>HireSignal</h1>
        {token && (
          <button className={styles.signOutBtn} onClick={handleDisconnect}>Disconnect</button>
        )}
      </div>

      {!tokenReady ? (
        // ── Loading ───────────────────────────────────────────────────────────
        <p className={`${styles.hint} ${styles.shimmer}`}>Loading…</p>
      ) : !token ? (
        // ── Connect ───────────────────────────────────────────────────────────
        <div>
          <p className={styles.hint}>Connect your HireSignal account to start analysing jobs.</p>
          <button className={styles.primaryBtn} onClick={handleConnect}>
            Connect to HireSignal
          </button>
        </div>
      ) : (
        // ── Main panel ────────────────────────────────────────────────────────
        <div>
          {phase === 'detecting' && (
            <p className={`${styles.hint} ${styles.shimmer}`}>Detecting job page…</p>
          )}

          {phase === 'not_job' && (
            <div className={styles.notJobMsg}>
              <div className={styles.notJobIcon}>✗</div>
              <div>
                <div className={styles.notJobTitle}>Not a job listing</div>
                {phaseError && <div className={styles.notJobDetail}>{phaseError}</div>}
              </div>
            </div>
          )}

          {(phase === 'ready' || phase === 'scanning' || phase === 'done' || phase === 'error') && detected && (
            <div className={styles.jobCard}>
              <div className={styles.jobCardCompany}>{detected.company}</div>
              <div className={styles.jobCardRole}>{detected.role}</div>
            </div>
          )}

          {phase === 'scanning' && (
            <div className={styles.scanningMsg}>
              <div className={`${styles.spinner} ${styles.shimmer}`}>⟳</div>
              <span>Analysing hiring signals…</span>
            </div>
          )}

          {phase === 'error' && (
            <div className={styles.errorMsg}>
              <span className={styles.errorIcon}>⚠</span> {phaseError || 'Analysis failed'}
            </div>
          )}

          {phase === 'done' && result && (
            <ScoreResult result={result} />
          )}

          {/* Primary CTA */}
          {phase === 'ready' && (
            <button className={styles.primaryBtn} onClick={handleAnalyse}>
              Analyse Hiring Intent
            </button>
          )}

          {phase === 'done' && (
            <button
              className={styles.secondaryBtn}
              onClick={() => result?.cached ? handleAnalyse(true) : handleRescan()}
            >
              {result?.cached ? 'Force rescan' : 'Rescan this page'}
            </button>
          )}

          {phase === 'not_job' && (
            <button className={styles.secondaryBtn} onClick={handleRescan}>
              Try again
            </button>
          )}

          {phase === 'error' && (
            <button className={styles.secondaryBtn} onClick={handleRescan}>
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Score result card ──────────────────────────────────────────────────────
function ScoreResult({ result }) {
  const [expanded, setExpanded] = React.useState(false);

  const { score, band, signals, confidence, ghostRiskFlag, cacheHit,
          cached, cachedAt,
          repostCount, daysUntilExpiry, daysOpen,
          signalCount, totalSignals } = result;

  const cachedDaysAgo = React.useMemo(() => {
    if (!cachedAt) return null;
    const ms = Date.now() - new Date(cachedAt).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  }, [cachedAt]);

  // Color is gated by confidence — never show green alongside low/medium confidence
  const scoreColor = confidence === 'high'
    ? (band === 'high' ? '#22C55E' : band === 'medium' ? '#F59E0B' : '#EF4444')
    : confidence === 'medium'
      ? '#F59E0B'
      : '#94A3B8'; // low / insufficient → grey

  const bandLabel = band === 'high' ? 'High Intent'
    : band === 'medium'             ? 'Moderate Intent'
    : 'Low Intent';

  const intentLabel = ghostRiskFlag
    ? 'High Ghost Job Risk'
    : confidence === 'insufficient'
      ? 'Insufficient Data'
      : confidence === 'low'
        ? `Possibly ${bandLabel} — limited signals`
        : confidence === 'medium'
          ? (band === 'high' ? 'Likely High Intent' : bandLabel)
          : (band === 'high' ? 'High Hiring Intent' : band === 'medium' ? 'Moderate Hiring Intent' : 'Low Hiring Intent');

  const firedSignals = [
    ...(signals?.positive || []),
    ...(signals?.negative || []),
  ];
  const noDataSignals = signals?.noData || [];

  // Collapsed: show top 3 fired signals. Expanded: show all fired + no-data.
  const visibleFired = expanded ? firedSignals : firedSignals.slice(0, 3);

  function SignalRow({ s, isPos, isNeg, dimmed }) {
    const accentColor = dimmed ? '#334155' : isPos ? '#22C55E' : isNeg ? '#EF4444' : '#475569';
    const textColor   = dimmed ? '#475569' : isPos ? '#22C55E' : isNeg ? '#EF4444' : '#94A3B8';
    return (
      <div className={styles.signalItem} style={{ borderLeftColor: accentColor }}>
        <span className={styles.signalPoints} style={{ color: textColor }}>
          {dimmed ? '—' : (s.points || '')}
        </span>
        <span className={styles.signalLabel} style={{ color: dimmed ? '#475569' : undefined }}>
          {s.label}{dimmed ? `: ${s.detail}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.resultCard}>
      <div className={styles.resultRow}>
        <div className={styles.scoreBig} style={{ color: scoreColor }}>
          {score ?? '—'}
        </div>
        <div className={styles.resultMeta}>
          <div className={styles.intentLabel} style={{ color: scoreColor }}>{intentLabel}</div>
          {signalCount != null && totalSignals != null && (
            <div className={styles.signalCount}>
              Based on {signalCount} of {totalSignals} signals
            </div>
          )}
          {cached && cachedDaysAgo != null && (
            <div className={styles.cachedLine}>
              Last analysed: {cachedDaysAgo === 0 ? 'today' : `${cachedDaysAgo}d ago`}
            </div>
          )}
          {cacheHit && !cached && (
            <div className={styles.confidenceBadge} style={{ color: '#6366F1' }}>Cached result</div>
          )}
        </div>
      </div>

      <div className={styles.resultBar}>
        <div
          className={styles.resultBarFill}
          style={{ width: `${score ?? 0}%`, background: scoreColor }}
        />
      </div>

      {/* Posting age & expiry line */}
      {(daysOpen != null || daysUntilExpiry != null) && (
        <div className={styles.expiryLine}>
          {daysOpen != null && `Posted ${daysOpen}d ago`}
          {daysOpen != null && daysUntilExpiry != null && ' — '}
          {daysUntilExpiry != null && (
            daysUntilExpiry < 0
              ? <span style={{ color: '#EF4444' }}>listing may have expired</span>
              : daysUntilExpiry <= 7
                ? <span style={{ color: '#F59E0B' }}>may expire in {daysUntilExpiry}d</span>
                : <span>~{daysUntilExpiry}d left</span>
          )}
        </div>
      )}

      {repostCount > 0 && (
        <div className={styles.repostWarning}>
          ⚠ Reposted {repostCount}× — possible ghost job
        </div>
      )}

      {/* Fired signals (always visible, collapses to top 3) */}
      {visibleFired.length > 0 && (
        <div className={styles.signalList}>
          {visibleFired.map((s, i) => {
            const isPos = (signals?.positive || []).some(p => p.key === s.key);
            const isNeg = (signals?.negative || []).some(n => n.key === s.key);
            return <SignalRow key={i} s={s} isPos={isPos} isNeg={isNeg} dimmed={false} />;
          })}
        </div>
      )}

      {/* No-data signals — only shown when expanded */}
      {expanded && noDataSignals.length > 0 && (
        <div className={styles.signalList} style={{ marginTop: 6 }}>
          {noDataSignals.map((s, i) => (
            <SignalRow key={i} s={s} isPos={false} isNeg={false} dimmed={true} />
          ))}
        </div>
      )}

      {/* Toggle */}
      {(firedSignals.length > 3 || noDataSignals.length > 0) && (
        <button
          className={styles.breakdownToggle}
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? 'Hide breakdown' : 'Show signal breakdown'}
        </button>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Popup />);
