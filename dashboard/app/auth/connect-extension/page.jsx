'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function ConnectFlow() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const extId = searchParams.get('extId');

  // 'loading' | 'success' | 'error' | 'no_extension'
  const [state, setState] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      const callbackUrl = `/auth/connect-extension?extId=${extId || ''}`;
      router.replace(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    if (!extId) {
      setErrorMsg('Extension ID missing. Open this page from the extension popup.');
      setState('error');
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Get a long-lived extension token from the API
    fetch(`${API_URL}/api/auth/extension-token`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then(({ token }) => {
        if (!token) throw new Error('No token returned');

        // Send token to the extension via externally_connectable
        if (typeof window === 'undefined' || !window.chrome?.runtime?.sendMessage) {
          setState('no_extension');
          return;
        }

        window.chrome.runtime.sendMessage(extId, { type: 'STORE_TOKEN', token }, (response) => {
          if (window.chrome.runtime.lastError || !response?.ok) {
            setErrorMsg('Could not reach the extension. Make sure it is installed and enabled.');
            setState('error');
          } else {
            setState('success');
            // Auto-close after a short delay
            setTimeout(() => window.close(), 2000);
          }
        });
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Failed to get extension token');
        setState('error');
      });
  }, [session, status, extId, router]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8 text-white">
      <div className="w-full max-w-sm text-center space-y-4">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HireSignal" width="48" height="48" className="mx-auto mb-2" />
        <span className="block font-bold text-[#C9A84C] text-lg tracking-tight">HireSignal</span>

        {state === 'loading' && (
          <>
            <p className="text-[#a0a0a0] text-sm animate-pulse">Connecting your account…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="text-green-400 text-3xl">✓</div>
            <h1 className="text-xl font-semibold">Connected!</h1>
            <p className="text-[#a0a0a0] text-sm">Your extension is now linked. This tab will close automatically.</p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-red-400 text-3xl">✗</div>
            <h1 className="text-xl font-semibold">Connection failed</h1>
            <p className="text-[#a0a0a0] text-sm">{errorMsg}</p>
            <button
              onClick={() => window.close()}
              className="px-5 py-2.5 border border-[#C9A84C]/30 rounded-lg text-sm text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
            >
              Close tab
            </button>
          </>
        )}

        {state === 'no_extension' && (
          <>
            <h1 className="text-xl font-semibold">Extension not found</h1>
            <p className="text-[#a0a0a0] text-sm">
              Make sure the HireSignal extension is installed and enabled in Chrome, then try again.
            </p>
            <button
              onClick={() => window.close()}
              className="px-5 py-2.5 border border-[#C9A84C]/30 rounded-lg text-sm text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
            >
              Close tab
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function ConnectExtensionPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <p className="text-[#a0a0a0] text-sm">Loading…</p>
      </main>
    }>
      <ConnectFlow />
    </Suspense>
  );
}
