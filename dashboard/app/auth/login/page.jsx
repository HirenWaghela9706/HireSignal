'use client';

import { signIn } from 'next-auth/react';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const urlError = searchParams.get('error');
  const OAUTH_ERRORS = {
    GoogleSignInFailed: 'Google sign-in failed. Please try again or use email/password.',
    AccessDenied: 'Access denied. Your Google account may not be authorised yet — try email/password or contact support.',
    OAuthAccountNotLinked: 'This email is already registered. Sign in with email/password first, then link Google in Settings.',
  };
  const [error, setError] = useState(OAUTH_ERRORS[urlError] || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) {
      setError('Invalid email or password');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-bg-primary flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-display font-bold mb-6">Sign in</h1>
        <button
          onClick={() => signIn('google', { callbackUrl })}
          className="w-full py-3 px-4 border border-bg-tertiary rounded-lg mb-6 hover:bg-bg-secondary transition flex items-center justify-center gap-3"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-bg-tertiary" />
          <span className="text-text-secondary text-sm">or continue with email</span>
          <div className="flex-1 h-px bg-bg-tertiary" />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            Sign in
          </button>
        </form>
        <p className="mt-6 text-center text-text-secondary text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
