'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Executive'];

// Simple inline toast
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  const bg = type === 'success' ? 'bg-high/10 border-high/30 text-high'
           : type === 'error'   ? 'bg-low/10 border-low/30 text-low'
           : 'bg-bg-tertiary border-bg-tertiary text-text-secondary';
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg ${bg}`}>
      {message}
    </div>
  );
}

// Toggle switch component
function Toggle({ checked, onChange, id }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-accent' : 'bg-bg-tertiary'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// Settings section wrapper
function Section({ title, children }) {
  return (
    <div className="bg-bg-secondary border border-bg-tertiary rounded-xl p-6 space-y-4">
      <h2 className="font-display font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLASS = 'w-full py-2.5 px-3 bg-bg-primary border border-bg-tertiary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent transition-colors';

export default function SettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: api.auth.me,
  });

  const [name,                  setName]                  = useState('');
  const [seniorityLevel,        setSeniorityLevel]        = useState('');
  const [targetRole,            setTargetRole]            = useState('');
  const [skills,                setSkills]                = useState('');
  const [personalisationEnabled, setPersonalisationEnabled] = useState(true);
  const [autoAnalyse,           setAutoAnalyse]           = useState(false);

  const [toast, setToast] = useState(null);   // { message, type }
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setSeniorityLevel(profile.seniority_level ?? '');
      setTargetRole(profile.target_role ?? '');
      setSkills((profile.primary_skills || []).join(', '));
      setPersonalisationEnabled(profile.personalisation_enabled ?? true);
      setAutoAnalyse(profile.auto_analyse ?? false);
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: api.auth.profile,
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      setToast({ message: 'Profile saved successfully', type: 'success' });
    },
    onError: (err) => {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const skillsArr = skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    updateMutation.mutate({
      name:                    name || undefined,
      seniority_level:         seniorityLevel || undefined,
      target_role:             targetRole || undefined,
      primary_skills:          skillsArr,
      personalisation_enabled: personalisationEnabled,
      auto_analyse:            autoAnalyse,
    });
  };

  const handleResetPassword = async () => {
    setResetLoading(true);
    try {
      await api.auth.resetPassword();
      setResetSent(true);
    } catch (err) {
      setToast({ message: err.message || 'Failed to send reset email', type: 'error' });
    } finally {
      setResetLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setConnectLoading(true);
    await signIn('google', { callbackUrl: '/dashboard/settings' });
    // redirect happens, loading state resets on return
    setConnectLoading(false);
  };

  const handleUnlinkGoogle = async () => {
    setUnlinkLoading(true);
    try {
      await api.auth.unlinkGoogle();
      queryClient.invalidateQueries(['profile']);
      setToast({ message: 'Google account disconnected', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to disconnect Google', type: 'error' });
    } finally {
      setUnlinkLoading(false);
    }
  };

  const copyToken = () => {
    if (typeof window !== 'undefined' && session?.accessToken) {
      navigator.clipboard.writeText(session.accessToken);
      setToast({ message: 'Token copied — paste it in the extension popup', type: 'success' });
    }
  };

  const email = profile?.email ?? session?.user?.email ?? '—';

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-2xl font-display font-bold">Settings</h1>

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <Section title="Profile">
          <Field label="Email">
            <p className="text-text-primary text-sm py-2">{email}</p>
          </Field>

          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Seniority level">
            <select
              value={seniorityLevel}
              onChange={(e) => setSeniorityLevel(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {SENIORITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>

          <Field label="Target role">
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Primary skills (comma-separated, max 10)">
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="React, Node.js, TypeScript"
              className={INPUT_CLASS}
            />
          </Field>

          <div className="flex items-center justify-between py-1">
            <label htmlFor="personalisation" className="text-sm text-text-secondary cursor-pointer">
              Personalised scoring
            </label>
            <Toggle
              id="personalisation"
              checked={personalisationEnabled}
              onChange={setPersonalisationEnabled}
            />
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </Section>
      </form>

      {/* ── Reset Password ──────────────────────────────────────────────── */}
      <Section title="Reset Password">
        <p className="text-text-secondary text-sm">
          We&apos;ll send a password reset link to <strong className="text-text-primary">{email}</strong>.
        </p>
        {resetSent ? (
          <div className="flex items-center gap-2 text-high text-sm font-medium">
            <span>✓</span>
            <span>Password reset email sent to your inbox</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetLoading}
            className="px-5 py-2.5 border border-bg-tertiary rounded-lg text-sm text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
          >
            {resetLoading ? 'Sending…' : 'Send reset email'}
          </button>
        )}
      </Section>

      {/* ── Linked Accounts ─────────────────────────────────────────────── */}
      <Section title="Linked Accounts">
        {/* Google row */}
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <span className="text-sm text-text-primary flex-1">Google</span>
          {profile?.has_google ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-high">
                <span>✓</span> Connected
              </span>
              <button
                type="button"
                onClick={handleUnlinkGoogle}
                disabled={unlinkLoading}
                className="px-3 py-1.5 border border-bg-tertiary rounded-lg text-xs text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              >
                {unlinkLoading ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connectLoading}
              className="px-3 py-1.5 border border-bg-tertiary rounded-lg text-xs text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            >
              {connectLoading ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>

        {/* Password row */}
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-text-secondary">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-sm text-text-primary flex-1">Password login</span>
          {profile?.has_password ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-high">
                <span>✓</span> Set
              </span>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading || resetSent}
                className="px-3 py-1.5 border border-bg-tertiary rounded-lg text-xs text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              >
                {resetSent ? 'Email sent ✓' : resetLoading ? 'Sending…' : 'Reset password'}
              </button>
            </div>
          ) : (
            <span className="text-xs text-text-secondary">Not set</span>
          )}
        </div>
      </Section>

      {/* ── Extension Preferences ───────────────────────────────────────── */}
      <Section title="Extension Preferences">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <label htmlFor="autoAnalyse" className="text-sm font-medium text-text-primary cursor-pointer">
              Auto-analyse jobs automatically
            </label>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              When enabled, HireSignal will automatically analyse every job page you visit.
              When disabled, you control when to analyse using the extension popup.
            </p>
          </div>
          <Toggle id="autoAnalyse" checked={autoAnalyse} onChange={setAutoAnalyse} />
        </div>
        <button
          type="button"
          onClick={() => {
            updateMutation.mutate({
              name:                    name || undefined,
              seniority_level:         seniorityLevel || undefined,
              target_role:             targetRole || undefined,
              primary_skills:          skills.split(',').map(s => s.trim()).filter(Boolean),
              personalisation_enabled: personalisationEnabled,
              auto_analyse:            autoAnalyse,
            });
          }}
          disabled={updateMutation.isPending}
          className="px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save preferences'}
        </button>
      </Section>

      {/* ── Extension token ─────────────────────────────────────────────── */}
      <Section title="Extension">
        <p className="text-text-secondary text-sm">
          Copy your token and paste it in the HireSignal extension popup to connect your account.
        </p>
        <button
          type="button"
          onClick={copyToken}
          className="px-5 py-2.5 border border-bg-tertiary rounded-lg text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
        >
          Copy token for extension
        </button>
      </Section>

      {/* ── Danger zone ─────────────────────────────────────────────────── */}
      <div className="bg-bg-secondary border border-low/30 rounded-xl p-6">
        <h2 className="font-display font-semibold text-low mb-2">Danger zone</h2>
        <p className="text-text-secondary text-sm mb-4">
          Deleting your account will permanently remove all your data.
        </p>
        <button
          type="button"
          onClick={() => alert('Account deletion not implemented in V1')}
          className="px-5 py-2.5 bg-low/10 text-low rounded-lg text-sm hover:bg-low/20 transition-colors"
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
