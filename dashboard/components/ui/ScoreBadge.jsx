export function ScoreBadge({ score }) {
  const band = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const colorClass = band === 'high' ? 'text-high border-high' : band === 'medium' ? 'text-medium border-medium' : 'text-low border-low';
  const label = band === 'high' ? 'High Intent' : band === 'medium' ? 'Moderate Intent' : 'Low Intent';

  return (
    <div className={`inline-flex flex-col items-center px-3 py-1 rounded-lg border-2 ${colorClass}`}>
      <span className="font-mono font-bold text-lg">{score ?? '—'}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}
