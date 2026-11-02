/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary':     '#0a0a0a',
        'bg-secondary':   '#111111',
        'bg-tertiary':    '#1e1e1e',
        'bg-hover':       '#252525',
        'text-primary':   '#ffffff',
        'text-secondary': '#a0a0a0',
        'border-muted':   '#2a2a2a',
        'accent': '#6366F1',
        'high':   '#22C55E',
        'medium': '#F59E0B',
        'low':    '#EF4444',
        'nodata': '#6B7280',
        // HireSignal "Revolt" landing palette — written brand wins over YAML pink.
        'signal-red':  '#FF0033',
        'void-black':  '#0A0A0A',
        'stark-white': '#FFFFFF',
        'seal-gold':   '#E9C400',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        bebas:   ['var(--font-bebas)', 'Impact', 'sans-serif'],
        chivo:   ['var(--font-chivo)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'stack-xl':      '8rem',
        'stack-lg':      '4rem',
        'stack-md':      '2rem',
        'margin-edge':   '4rem',
        'margin-mobile': '1.5rem',
        gutter:          '1rem',
      },
      borderRadius: {
        sharp: '0',
      },
    },
  },
  plugins: [],
};
