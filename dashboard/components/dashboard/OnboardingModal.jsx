'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const CHROME_STORE_URL = '#'; // TODO: replace with real Chrome Web Store URL

function ChromeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M50,5 A45,45 0 0,1 88.97,72.5 L69.05,61 A22,22 0 0,0 50,28 Z" fill="#EA4335"/>
      <path d="M88.97,72.5 A45,45 0 0,1 11.03,72.5 L30.95,61 A22,22 0 0,0 69.05,61 Z" fill="#34A853"/>
      <path d="M11.03,72.5 A45,45 0 0,1 50,5 L50,28 A22,22 0 0,0 30.95,61 Z" fill="#FBBC05"/>
      <circle cx="50" cy="50" r="22" fill="white"/>
      <circle cx="50" cy="50" r="17" fill="#4285F4"/>
    </svg>
  );
}

// Step indicators
function StepDot({ active, done }) {
  return (
    <span
      className={`w-2 h-2 rounded-full transition-colors ${
        done ? 'bg-accent' : active ? 'bg-accent' : 'bg-bg-tertiary'
      }`}
    />
  );
}

export function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(1);
  const [completing, setCompleting] = useState(false);

  async function handleComplete() {
    setCompleting(true);
    try {
      await api.auth.completeOnboarding();
    } catch {
      // best-effort — don't block the user
    }
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-bg-tertiary rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-bg-tertiary">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-accent uppercase tracking-widest">
              Getting started
            </span>
            <div className="flex items-center gap-1.5">
              <StepDot active={step === 1} done={step > 1} />
              <StepDot active={step === 2} done={step > 2} />
            </div>
          </div>
          <h2 className="text-xl font-display font-bold text-text-primary mt-3">
            {step === 1 ? 'Add HireSignal to Chrome' : "You're all set!"}
          </h2>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          {step === 1 ? (
            <div className="space-y-6">
              <p className="text-text-secondary leading-relaxed">
                The Chrome extension overlays a hiring intent score on every job listing you visit —
                on LinkedIn, Indeed, and more. No copy-paste required.
              </p>

              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-xl font-medium transition text-base shadow-lg shadow-blue-900/20"
              >
                <ChromeIcon />
                Add to Chrome — It&apos;s Free
              </a>

              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span className="flex-1 border-t border-bg-tertiary" />
                <span>then</span>
                <span className="flex-1 border-t border-bg-tertiary" />
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-3 border border-bg-tertiary rounded-xl text-text-primary hover:bg-bg-tertiary transition font-medium"
              >
                I&apos;ve installed it →
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl">🎉</span>
                <div>
                  <p className="text-text-primary font-medium mb-1">Extension installed</p>
                  <p className="text-text-secondary text-sm">HireSignal is active in your browser.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-3xl">🔍</span>
                <div>
                  <p className="text-text-primary font-medium mb-1">Start browsing jobs</p>
                  <p className="text-text-secondary text-sm">
                    Head to LinkedIn or Indeed, open any job listing, and click the HireSignal button
                    to get an instant intent score.
                  </p>
                </div>
              </div>

              <button
                onClick={handleComplete}
                disabled={completing}
                className="w-full py-3.5 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {completing ? 'Starting…' : 'Go to my dashboard'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
