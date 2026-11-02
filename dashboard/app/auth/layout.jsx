import Link from 'next/link';

export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-screen bg-bg-primary">
      <Link
        href="/"
        aria-label="Back to home"
        className="absolute top-6 left-6 z-10 flex items-center gap-2.5 hover:opacity-90 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HireSignal" width="36" height="36" style={{ display: 'block' }} />
        <span className="font-display font-bold text-lg tracking-tight text-[#C9A84C]">HireSignal</span>
      </Link>
      {children}
    </div>
  );
}
