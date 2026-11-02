chrome.runtime.onInstalled.addListener(() => {
  console.log('[HireSignal] extension installed/updated');
});

// Receives token from the dashboard connect page (externally_connectable)
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message.type === 'STORE_TOKEN' && message.token) {
    chrome.storage.local.set({ token: message.token }, () => {
      console.log('[HireSignal bg] token stored via dashboard connect');
      sendResponse({ ok: true });
    });
    return true; // keep channel open for async response
  }
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Strip non-serializable values before calling sendResponse / sendMessage.
function safeMessage(obj) {
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    if (value instanceof Error) return { message: value.message, stack: value.stack };
    if (value === undefined)    return null;
    return value;
  }));
}

// ANALYSE_JOB relay. Content scripts on Indeed, LinkedIn etc. cannot call
// localhost directly (strict CSP); the background worker proxies the request.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ANALYSE_JOB') {
    const { payload } = message;

    chrome.storage.local.get(['token'], async ({ token }) => {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/jobs/analyse`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url:         payload.url,
            companyName: payload.companyName,
            roleTitle:   payload.roleTitle,
            postingDate: payload.postingDate,
            platform:    payload.platform,
            jobId:       payload.jobId,
            country:     payload.country  || null,
            language:    payload.language || null,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          sendResponse(safeMessage({ error: body.error || 'API error', status: res.status }));
          return;
        }

        const data = await res.json();
        sendResponse(safeMessage({ data }));
      } catch (err) {
        sendResponse(safeMessage({ error: err.message }));
      }
    });

    return true; // keep channel open for async response
  }

  if (message.type === 'CHECK_CACHE') {
    chrome.storage.local.get(['token'], async ({ token }) => {
      if (!token) { sendResponse(safeMessage({ hit: false })); return; }
      try {
        const res = await fetch(
          `${API_URL}/api/jobs/cached?url=${encodeURIComponent(message.url)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = res.ok ? await res.json() : { hit: false };
        sendResponse(safeMessage(data));
      } catch {
        sendResponse(safeMessage({ hit: false }));
      }
    });
    return true;
  }

  if (message.type === 'FETCH_PREFERENCES') {
    chrome.storage.local.get(['token'], async ({ token }) => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        chrome.storage.local.set({ autoAnalyse: data.auto_analyse ?? false });
        console.log('[HireSignal bg] preferences synced — autoAnalyse:', data.auto_analyse);
      } catch (err) {
        console.warn('[HireSignal bg] preference sync failed:', err.message);
      }
    });
    return false;
  }
});

// Proactive content script injection on supported domains.
const INJECT_DOMAINS = [
  'indeed.com',
  'glassdoor.com',
  'glassdoor.co.uk',
  'glassdoor.co.in',
  'linkedin.com',
  'xing.com',
  'stepstone.de',
  'stepstone.com',
  'monster.com',
  'reed.co.uk',
  'totaljobs.com',
  'welcometothejungle.com',
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
];

function shouldInject(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const host = new URL(url).hostname;
    return INJECT_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

function injectContentScript(tabId, url) {
  const manifest = chrome.runtime.getManifest();
  const csEntry  = manifest.content_scripts?.[0];
  const jsFiles  = csEntry?.js || [];

  if (jsFiles.length === 0) {
    console.warn('[HireSignal bg] no content script files in manifest');
    return;
  }

  chrome.scripting.executeScript(
    { target: { tabId }, files: jsFiles },
    () => {
      if (chrome.runtime.lastError) {
        console.warn(`[HireSignal bg] injection failed on ${url}:`, chrome.runtime.lastError.message);
      } else {
        console.log(`[HireSignal bg] injected content script into tab ${tabId}`);
      }
    }
  );
}

// Ask the content script for its latest detection result.
function requestDetection(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'DETECT_JOB' }, (response) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(response?.result || null);
    });
  });
}

// Trigger auto-analysis for a tab if the user has auto_analyse enabled.
async function maybeAutoAnalyse(tabId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token', 'autoAnalyse'], async ({ token, autoAnalyse }) => {
      if (!autoAnalyse || !token) { resolve(); return; }

      // Let the content script initialise and any SPA hydration settle.
      await new Promise(r => setTimeout(r, 1500));

      const detection = await requestDetection(tabId);
      if (!detection || detection.kind !== 'job') { resolve(); return; }

      try {
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
        const res = await fetch(`${API_URL}/api/jobs/analyse`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url:         detection.url,
            companyName: detection.company,
            roleTitle:   detection.title,
            platform:    detection.board,
          }),
        });
        if (!res.ok) { resolve(); return; }
        const data = await res.json();
        console.log('[HireSignal bg] auto-analyse complete, score:', data.score);
      } catch (err) {
        console.warn('[HireSignal bg] auto-analyse error:', err.message);
      }
      resolve();
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const url = tab.url || '';
  if (!shouldInject(url)) return;

  chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
    if (chrome.runtime.lastError || !response?.pong) {
      console.log(`[HireSignal bg] injecting content script into tab ${tabId}`);
      injectContentScript(tabId, url);
      setTimeout(() => maybeAutoAnalyse(tabId), 500);
    } else {
      console.log(`[HireSignal bg] content script already active on tab ${tabId}`);
      maybeAutoAnalyse(tabId);
    }
  });
});

// SPA navigation: notify the content script so detection re-runs without
// waiting for the popup to reopen.
if (chrome.webNavigation?.onHistoryStateUpdated) {
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId !== 0) return;
    chrome.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED' }, () => {
      // Swallow "no receiver" lastError on tabs without the content script.
      void chrome.runtime.lastError;
    });
  });
}
