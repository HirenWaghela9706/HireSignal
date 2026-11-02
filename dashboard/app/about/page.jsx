import Link from 'next/link';

const GOLD = '#C9A84C';

const VALUES = [
  {
    title: 'Radical Transparency',
    body: 'We believe hidden agendas are a form of theft. Truth is our primary product.',
  },
  {
    title: 'Time-Sanctity',
    body: "A job seeker's time is a finite life-resource. Wasting it on a ghost job is an institutional sin.",
  },
  {
    title: 'Symmetry of Power',
    body: 'For too long, companies have held all the data. We return the All-Seeing Eye to the individual.',
  },
  {
    title: 'Elite Rebellion',
    body: "We don't just complain about the system; we build superior systems that make the old ones obsolete.",
  },
];

export const metadata = {
  title: 'About — HireSignal',
  description: 'Our mission, vision, and the values that drive HireSignal.',
};

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white overflow-hidden">

      {/* ── Full-page watermark ──────────────────────────────────────────── */}
      <div
        className="pointer-events-none select-none fixed inset-0"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          style={{
            width: '650px',
            height: '650px',
            opacity: 0.22,
            mixBlendMode: 'normal',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* All page content sits above the watermark */}
      <div className="relative" style={{ zIndex: 1 }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-[#C9A84C]/20 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="HireSignal" width="36" height="36" style={{ display: 'block', mixBlendMode: 'normal' }} />
          <span className="font-display font-bold text-lg tracking-tight text-[#C9A84C]">HireSignal</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/#how-it-works" className="text-[#a0a0a0] hover:text-[#C9A84C] transition-colors hidden sm:block">How it works</Link>
          <Link href="/#pricing" className="text-[#a0a0a0] hover:text-[#C9A84C] transition-colors hidden sm:block">Pricing</Link>
          <Link href="/auth/login" className="text-[#a0a0a0] hover:text-white transition-colors">Sign in</Link>
          <Link href="/auth/register" className="px-4 py-2 bg-[#C9A84C] text-[#0a0a0a] rounded-lg font-medium hover:bg-[#b8943f] transition">
            Get started
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center pt-24 pb-16 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-medium tracking-widest uppercase mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] inline-block" />
          About HireSignal
        </div>

        <h1
          className="text-4xl sm:text-6xl font-display font-bold leading-tight mb-4"
          style={{ letterSpacing: '-0.02em' }}
        >
          Intelligence is the<br />
          <span style={{ color: GOLD }}>ultimate advantage.</span>
        </h1>

        <p className="text-[#a0a0a0] text-lg max-w-xl mx-auto leading-relaxed">
          We built the weapon we wished we had.
        </p>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />
      </div>

      {/* ── Mission ─────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <p className="text-[#C9A84C] text-xs font-medium tracking-[0.25em] uppercase mb-5">Mission</p>
        <blockquote className="text-2xl sm:text-3xl font-display font-semibold leading-snug text-white">
          &ldquo;To arm job seekers with an elite algorithmic{' '}
          <em className="not-italic" style={{ color: GOLD }}>Sixth Sense</em>{' '}
          that instantly scores Job Descriptions for hiring intent. We strip away corporate
          gaslighting to reveal which doors are actually open and which are just mirrors.&rdquo;
        </blockquote>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />
      </div>

      {/* ── Vision ──────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <p className="text-[#C9A84C] text-xs font-medium tracking-[0.25em] uppercase mb-5">Vision</p>
        <blockquote className="text-2xl sm:text-3xl font-display font-semibold leading-snug text-white">
          &ldquo;To collapse the Ghost Job economy entirely. We envision a future where{' '}
          <em className="not-italic" style={{ color: GOLD }}>the Signal</em>{' '}
          is the global standard for employment truth, forcing corporations to return to honest,
          high-integrity hiring or face total exclusion by the talent pool.&rdquo;
        </blockquote>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />
      </div>

      {/* ── Core Values ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-[#C9A84C] text-xs font-medium tracking-[0.25em] uppercase mb-3 text-center">Core Values</p>
        <h2 className="text-3xl font-display font-bold text-center mb-16">
          The code we operate by
        </h2>

        <div className="grid sm:grid-cols-2 gap-6">
          {VALUES.map((v, i) => (
            <div
              key={v.title}
              className="group relative border border-[#C9A84C]/15 rounded-2xl p-8 bg-[#111111] hover:border-[#C9A84C]/40 transition-all duration-300"
            >
              {/* Roman numeral marker */}
              <span
                className="absolute top-7 right-8 font-mono text-3xl font-bold opacity-10 select-none"
                style={{ color: GOLD }}
                aria-hidden="true"
              >
                {['I', 'II', 'III', 'IV'][i]}
              </span>

              {/* Gold rule */}
              <div className="w-8 h-0.5 mb-5 rounded-full" style={{ backgroundColor: GOLD }} />

              <h3 className="font-display font-bold text-lg mb-3 text-white group-hover:text-[#C9A84C] transition-colors">
                {v.title}
              </h3>
              <p className="text-[#a0a0a0] leading-relaxed text-sm">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 text-center overflow-hidden">
        {/* Glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-xl mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width="64" height="64" aria-hidden="true" className="mx-auto mb-8" style={{ mixBlendMode: 'normal' }} />
          <h2 className="text-3xl font-display font-bold mb-4">
            The Signal is live.
          </h2>
          <p className="text-[#a0a0a0] mb-8 leading-relaxed">
            Stop submitting CVs into the void. Start reading the room.
          </p>
          <Link
            href="/auth/register"
            className="inline-block px-8 py-3.5 font-medium rounded-lg transition"
            style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
          >
            Activate your Signal
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#C9A84C]/15 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#a0a0a0]">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="HireSignal" width="24" height="24" style={{ display: 'block', mixBlendMode: 'normal' }} />
            <span className="font-display font-bold text-[#C9A84C]">HireSignal</span>
          </Link>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/auth/login" className="hover:text-white transition-colors">Sign in</Link>
          </div>
          <p className="text-xs">© 2025 HireSignal. All rights reserved.</p>
        </div>
      </footer>

      </div>{/* end z-1 content wrapper */}
    </div>
  );
}
