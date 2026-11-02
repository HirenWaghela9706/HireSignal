'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

export function Navbar() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  return (
    <nav className="h-14 border-b border-[#C9A84C]/15 flex items-center justify-between px-6 bg-bg-primary">
      <Link href="/dashboard" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="HireSignal"
          width="32"
          height="32"
          style={{ display: 'block', mixBlendMode: 'normal' }}
        />
        <span className="font-display font-bold text-[#C9A84C] tracking-tight">HireSignal</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-text-secondary hover:text-text-primary text-sm transition-colors">Dashboard</Link>
        <Link href="/about" className="text-text-secondary hover:text-[#C9A84C] text-sm transition-colors">About</Link>
        <Link href="/dashboard/settings" className="text-text-secondary hover:text-text-primary text-sm transition-colors">Settings</Link>
        {isAdmin && (
          <Link href="/admin" className="text-[#C9A84C] hover:text-[#b8943f] font-medium text-sm transition-colors">
            Admin
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
