'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err) {
      setError('Registration failed');
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-bg-primary flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-xl font-display font-bold mb-2">Account created</h1>
          <p className="text-text-secondary">Redirecting to sign in...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-primary flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-display font-bold mb-6">Create account</h1>
        <button
          onClick={() => {}}
          className="w-full py-3 px-4 border border-bg-tertiary rounded-lg mb-4 hover:bg-bg-secondary transition opacity-50 cursor-not-allowed"
          disabled
        >
          Continue with Google (coming soon)
        </button>
        <button
          onClick={() => {}}
          className="w-full py-3 px-4 border border-bg-tertiary rounded-lg mb-6 hover:bg-bg-secondary transition opacity-50 cursor-not-allowed"
          disabled
        >
          Continue with Apple (coming soon)
        </button>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-bg-tertiary" />
          <span className="text-text-secondary text-sm">or continue with email</span>
          <div className="flex-1 h-px bg-bg-tertiary" />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full py-3 px-4 bg-bg-secondary border border-bg-tertiary rounded-lg text-text-primary placeholder-text-secondary"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full py-3 px-4 bg-bg-secondary border border-bg-tertiary rounded-lg text-text-primary placeholder-text-secondary"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full py-3 px-4 bg-bg-secondary border border-bg-tertiary rounded-lg text-text-primary placeholder-text-secondary"
            required
          />
          {error && <p className="text-low text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:opacity-90"
          >
            Create account
          </button>
        </form>
        <p className="mt-6 text-center text-text-secondary text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
