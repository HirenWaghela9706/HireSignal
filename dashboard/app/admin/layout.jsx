'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';

export default function AdminLayout({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading…</p>
      </div>
    );
  }

  if (!session) {
    router.replace('/auth/login?callbackUrl=/admin');
    return null;
  }

  if (session.user?.role !== 'admin') {
    router.replace('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
