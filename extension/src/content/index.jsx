// HireSignal content script.
//
// Responsibilities:
//   1. Run detectJob() on initial load and on every URL change (SPA-aware).
//   2. Cache the most recent detection result.
//   3. Respond to popup/background messages: PING, DETECT_JOB, URL_CHANGED.
//
// All score/grade UI lives in the popup; this script only does detection.

import { detectJob } from '../detection/detect.js';

if (!window.__hiresignal_initialized) {
  window.__hiresignal_initialized = true;

  let lastUrl     = '';
  let lastResult  = null;

  function run(reason) {
    lastUrl    = window.location.href;
    lastResult = detectJob({ href: lastUrl, doc: document });
    if (reason) {
      // eslint-disable-next-line no-console
      console.log('[HireSignal cs]', reason, '→', lastResult.kind, lastResult.source || lastResult.reason || '');
    }
    return lastResult;
  }

  // Initial run — DOM may still be loading, but JSON-LD scripts are usually
  // present at parse-time and the URL is always available.
  run('initial');

  // Re-run if title changes (some boards hydrate the title asynchronously);
  // a no-op when the URL also changed because run() is idempotent for the
  // same URL.
  const titleEl = document.querySelector('title');
  if (titleEl) {
    new MutationObserver(() => {
      if (window.location.href !== lastUrl) run('title-mutation+url-change');
      else if (lastResult && lastResult.kind === 'not-job') run('title-mutation hydrated');
    }).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  // ── SPA navigation: pushState / replaceState / popstate ────────────────
  function notifyUrlChange() {
    // Defer one tick so the SPA can paint the new view before we re-detect.
    setTimeout(() => {
      if (window.location.href !== lastUrl) run('spa-navigation');
    }, 50);
  }

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function patched(...args) {
      const ret = original.apply(this, args);
      try { window.dispatchEvent(new Event('hiresignal:urlchange')); } catch {}
      return ret;
    };
  }
  window.addEventListener('hiresignal:urlchange', notifyUrlChange);
  window.addEventListener('popstate',             notifyUrlChange);

  // ── Message handlers ───────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.type === 'PING') {
      sendResponse({ pong: true });
      return false;
    }

    if (message.type === 'URL_CHANGED') {
      // Background's chrome.webNavigation.onHistoryStateUpdated woke us up.
      if (window.location.href !== lastUrl) run('webNavigation-history-update');
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'DETECT_JOB') {
      // Always re-run if the URL has drifted since the last cached result.
      if (!lastResult || window.location.href !== lastUrl) run('detect-job-message');
      sendResponse({ result: lastResult });
      return false;
    }

    return false;
  });
}
