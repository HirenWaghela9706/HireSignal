import Link from 'next/link';
import CtaForm from './CtaForm';

export const metadata = {
  title: 'HireSignal — Ghost Jobs End Here',
  description:
    'Stop the resume harvesting. End the silence. Demand accountability from the corporate machine.',
};

const COUNTER_STRIKE = [
  {
    num: '01',
    title: 'SIGNAL',
    body:
      'Our algorithm detects listings that have sat stagnant for 60+ days without a single verified hire. No more black holes.',
  },
  {
    num: '02',
    title: 'VERIFY',
    body:
      'Crowdsourced validation. Users report automated rejection loops and non-existent interview cycles in real time.',
  },
  {
    num: '03',
    title: 'REVOLT',
    body:
      'Expose the offenders. Publicly available watchlists that force recruiters to acknowledge the human cost of ghosting.',
  },
];

const WALL_ROWS = [
  { entity: 'OMNICRON HOLDINGS', grade: 'F', tapeClass: 'label-tape--red',  alerts: 412, action: 'Reposted "Senior Engineer" 9× in 90 days' },
  { entity: 'VANTAGE LABS INC',  grade: 'D', tapeClass: 'label-tape--gold', alerts: 187, action: '4-stage interview cancelled after offer' },
  { entity: 'NORTHWIND PARTNERS', grade: 'C', tapeClass: 'label-tape--ghost', alerts:  64, action: 'No response 47 days after final round' },
  { entity: 'AXIOM RECRUIT GMBH', grade: 'F', tapeClass: 'label-tape--red',  alerts: 298, action: 'Listing live 214 days, zero hires reported' },
];

const TESTIMONIALS = [
  { quote: 'I sent 312 applications. HireSignal told me 184 of them were ghosts. I got two interviews the week I started filtering.', name: 'Maren Köhler',  rotate: '-rotate-2' },
  { quote: 'Finally a tool that treats the recruiter side like the adversary it can be. The Wall of Shame is brutal and necessary.',     name: 'Dario Petrović', rotate: 'rotate-1'  },
  { quote: 'Three rounds, a take-home, then radio silence. HireSignal already had them flagged. I should have looked first.',            name: 'Aisha Renteria', rotate: '-rotate-1' },
];

const PILL_LINK_CLASS = 'font-bebas tracking-widest text-sm hover:text-signal-red transition-none';

export default function RevoltLanding() {
  return (
    <div className="revolt-grain bg-void-black text-stark-white font-chivo min-h-screen relative">

      {/* ── Top Nav ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-void-black border-b border-stark-white">
        <div className="flex items-center justify-between px-margin-mobile md:px-margin-edge py-4">
          <Link href="/" aria-label="HireSignal home" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="HireSignal" width="36" height="36" style={{ display: 'block' }} />
            <span className="font-bebas text-2xl tracking-widest">HIRESIGNAL</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#manifesto"    className={PILL_LINK_CLASS}>MANIFESTO</a>
            <a href="#how-it-works" className={PILL_LINK_CLASS}>HOW IT WORKS</a>
            <a href="#the-wall"     className={PILL_LINK_CLASS}>THE WALL</a>
            <a href="#pricing"      className={PILL_LINK_CLASS}>PRICING</a>
          </nav>
          <a href="#pricing" className="btn-stamp text-sm md:text-base">JOIN THE REVOLT</a>
        </div>
      </header>

      <main className="relative z-10">

        {/* ── 1. Hero ──────────────────────────────────────────────── */}
        <section
          id="manifesto"
          className="px-margin-mobile md:px-margin-edge pt-stack-lg md:pt-stack-xl pb-stack-xl"
        >
          <div className="max-w-5xl">
            <h1 className="font-bebas leading-[0.85] tracking-tight text-[18vw] md:text-[10rem] lg:text-[11rem]">
              <span className="block text-stark-white">GHOST JOBS</span>
              <span className="block text-signal-red">END HERE</span>
            </h1>
            <p className="font-chivo text-lg md:text-xl mt-stack-md max-w-2xl leading-relaxed">
              Stop the <span className="redacted">resume harvesting</span>. End the silence.
              Demand accountability from the corporate machine. We flag the stagnant, the fake,
              and the <span className="redacted">exploitative</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-stack-md">
              <a href="#pricing"  className="btn-stamp">JOIN THE REVOLT</a>
              <a href="#the-wall" className="btn-stamp btn-stamp--outline">SEE THE DATA</a>
            </div>
          </div>
        </section>

        {/* ── 2. Stats band, framed by hazard stripes ──────────────── */}
        <section id="how-it-works" aria-label="Damage report">
          <div className="hazard-stripes h-4 md:h-6" />
          <div className="px-margin-mobile md:px-margin-edge py-stack-lg md:py-stack-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md md:gap-12">
              {[
                { n: '40%', label: 'FAKE POSTINGS' },
                { n: '2M+', label: 'RESUMES HARVESTED' },
                { n: '0',   label: 'ACCOUNTABILITY' },
              ].map(({ n, label }) => (
                <div key={label}>
                  <div className="font-bebas text-signal-red leading-none text-[24vw] md:text-[10rem]">
                    {n}
                  </div>
                  <div className="font-bebas tracking-widest text-xl md:text-2xl mt-2">{label}</div>
                </div>
              ))}
            </div>
            <p className="italic text-sm text-stark-white/70 mt-stack-md">
              Sources: [placeholder, replace with citations]
            </p>
          </div>
          <div className="hazard-stripes h-4 md:h-6" />
        </section>

        {/* ── 3. The Counter-Strike ───────────────────────────────── */}
        <section className="px-margin-mobile md:px-margin-edge pt-stack-xl pb-stack-xl">
          <h2 className="font-bebas tracking-tight text-5xl md:text-7xl leading-none">
            THE COUNTER-STRIKE
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-stack-lg">
            {COUNTER_STRIKE.map(({ num, title, body }) => (
              <article key={num} className="border border-stark-white p-6 md:p-8 bg-void-black">
                <div className="font-bebas text-7xl md:text-8xl text-signal-red leading-none">
                  {num}
                </div>
                <h3 className="font-bebas tracking-widest text-2xl mt-4">{title}</h3>
                <p className="font-chivo text-base mt-3 leading-relaxed text-stark-white/90">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── 4. The Wall of Shame ────────────────────────────────── */}
        <section id="the-wall" className="px-margin-mobile md:px-margin-edge pb-stack-xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-stack-md">
            <h2 className="font-bebas tracking-tight text-5xl md:text-7xl leading-none">
              THE WALL OF SHAME
            </h2>
            <span className="label-tape">
              LIVE UPDATES // UTC [timestamp]
            </span>
          </div>

          <div className="border border-stark-white">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-stark-white font-bebas tracking-widest text-sm">
              <div className="col-span-5">ENTITY</div>
              <div className="col-span-2">VERDICT</div>
              <div className="col-span-5">LAST ACTION</div>
            </div>
            {WALL_ROWS.map((row, i) => (
              <div
                key={row.entity}
                className={`grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-5 ${i !== WALL_ROWS.length - 1 ? 'border-b border-stark-white/40' : ''}`}
              >
                <div className="md:col-span-5 font-bebas tracking-widest text-xl md:text-2xl">
                  {row.entity}
                </div>
                <div className="md:col-span-2 flex items-center gap-3">
                  <span className={`label-tape ${row.tapeClass} text-base font-bebas`}>
                    {row.grade}
                  </span>
                  <span className="font-chivo text-sm text-stark-white/70">
                    {row.alerts} alerts
                  </span>
                </div>
                <div className="md:col-span-5 font-chivo text-sm text-stark-white/85">
                  {row.action}
                </div>
              </div>
            ))}
          </div>
          <p className="italic text-sm text-stark-white/70 mt-4">
            Illustrative. Live grades are evidence-backed.
          </p>
        </section>

        {/* ── 5. Movement ─────────────────────────────────────────── */}
        <section className="px-margin-mobile md:px-margin-edge pb-stack-xl">
          <div className="font-bebas text-signal-red leading-none text-[28vw] md:text-[14rem]">
            42,831
          </div>
          <div className="font-bebas tracking-widest text-2xl md:text-4xl mt-2">
            SEEKERS FIGHTING BACK.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-stack-lg">
            {TESTIMONIALS.map(({ quote, name, rotate }, i) => (
              <figure
                key={name}
                className={`bg-stark-white text-void-black p-6 border-2 border-void-black ${rotate}`}
                style={{ transformOrigin: 'top left' }}
              >
                <blockquote className="font-chivo text-base leading-snug">
                  &ldquo;{quote}&rdquo;
                </blockquote>
                <figcaption className="font-bebas tracking-widest text-sm mt-4">
                  — {name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── 6. Pricing ──────────────────────────────────────────── */}
        <section id="pricing" className="px-margin-mobile md:px-margin-edge pb-stack-xl">
          <h2 className="font-bebas tracking-tight text-5xl md:text-7xl leading-none">
            PICK YOUR SIDE
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-stack-lg max-w-5xl">
            {/* RECRUIT — free */}
            <article className="border border-stark-white p-8 bg-void-black flex flex-col">
              <h3 className="font-bebas tracking-widest text-3xl">RECRUIT</h3>
              <p className="font-chivo text-sm text-stark-white/75 mt-1">Get in the fight.</p>
              <div className="font-bebas text-7xl mt-stack-md leading-none">€0</div>
              <ul className="mt-stack-md space-y-3 font-chivo text-base flex-1">
                <li><span className="text-signal-red">✓</span> Limited ghost-job checks per month</li>
                <li><span className="text-signal-red">✓</span> Read-only Wall of Shame access</li>
                <li><span className="text-signal-red">✓</span> Community access</li>
                <li className="text-stark-white/50"><span>✕</span> Real-time alerts</li>
                <li className="text-stark-white/50"><span>✕</span> Browser extension</li>
              </ul>
              <a href="/auth/register" className="btn-stamp btn-stamp--outline mt-stack-md self-start">
                JOIN FREE
              </a>
            </article>

            {/* INSURGENT — paid, dominant, red border */}
            <article className="border-4 border-signal-red p-8 bg-void-black flex flex-col relative">
              <div className="absolute -top-4 right-6">
                <span className="most-wanted-stamp text-sm md:text-base">MOST WANTED</span>
              </div>
              <h3 className="font-bebas tracking-widest text-3xl text-signal-red">INSURGENT</h3>
              <p className="font-chivo text-sm text-stark-white/75 mt-1">For the relentless.</p>
              <div className="font-bebas leading-none mt-stack-md flex items-baseline gap-2">
                <span className="text-7xl">€6.99</span>
                <span className="text-base text-stark-white/70">/month</span>
              </div>
              <ul className="mt-stack-md space-y-3 font-chivo text-base flex-1">
                <li><span className="text-signal-red">✓</span> Unlimited ghost-job detection</li>
                <li><span className="text-signal-red">✓</span> Real-time ghost alerts</li>
                <li><span className="text-signal-red">✓</span> Full browser extension</li>
                <li><span className="text-signal-red">✓</span> Full Wall of Shame access &amp; submissions</li>
                <li><span className="text-signal-red">✓</span> Priority signal</li>
              </ul>
              <p className="font-chivo text-xs text-stark-white/60 mt-stack-md">Monthly billing.</p>
              <a href="/auth/register" className="btn-stamp mt-3 self-start">JOIN THE REVOLT</a>
            </article>
          </div>
        </section>

        {/* ── 7. Final CTA banner ─────────────────────────────────── */}
        <section className="bg-signal-red text-stark-white px-margin-mobile md:px-margin-edge py-stack-lg md:py-stack-xl">
          <h2 className="font-bebas tracking-tight leading-none text-4xl md:text-7xl max-w-4xl">
            IT&rsquo;S TIME COMPANIES TAKE ACCOUNTABILITY
          </h2>
          <CtaForm />
        </section>

        {/* ── 8. Footer ───────────────────────────────────────────── */}
        <footer className="border-t border-stark-white px-margin-mobile md:px-margin-edge py-stack-lg">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <Link href="/" className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="HireSignal" width="36" height="36" style={{ display: 'block' }} />
                <span className="font-bebas text-2xl tracking-widest">HIRESIGNAL</span>
              </Link>
              <p className="font-bebas tracking-widest text-sm mt-4">
                NO MORE GHOSTS. NO MORE SILENCE.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 font-bebas tracking-widest text-sm">
              <a href="#manifesto"        className="hover:text-signal-red">MANIFESTO</a>
              <a href="#pricing"          className="hover:text-signal-red">PRICING</a>
              <a href="/terms"            className="hover:text-signal-red">TERMS</a>
              <a href="/privacy"          className="hover:text-signal-red">PRIVACY</a>
              <span className="text-stark-white/60">© 2026 HIRESIGNAL</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
