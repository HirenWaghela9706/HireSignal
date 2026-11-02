export function ConfidencePill({ level }) {
  const colorClass =
    level === 'standard' ? 'border-high text-high' :
    level === 'low' ? 'border-medium text-medium' :
    'border-nodata text-nodata';

  const label = level === 'standard' ? 'Standard' : level === 'low' ? 'Low' : 'Insufficient';

  return (
    <span className={`inline-block px-2 py-1 text-xs rounded-full border ${colorClass}`}>
      {label} confidence
    </span>
  );
}
