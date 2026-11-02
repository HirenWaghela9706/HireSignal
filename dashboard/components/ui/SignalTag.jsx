export function SignalTag({ label, type = 'neutral' }) {
  const colorClass =
    type === 'positive' ? 'border-high text-high' :
    type === 'negative' ? 'border-low text-low' :
    'border-nodata text-nodata';

  return (
    <span className={`inline-block px-2 py-1 text-xs rounded-full border ${colorClass}`}>
      {label}
    </span>
  );
}
