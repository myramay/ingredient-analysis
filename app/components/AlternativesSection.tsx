import type { Alternative } from '@/app/lib/types';

interface Props {
  alternatives: Alternative[];
}

export default function AlternativesSection({ alternatives }: Props) {
  if (!alternatives.length) return null;

  return (
    <div className="glass-card p-6 animate-fade-up" style={{ animationDelay: '0.2s', animationFillMode: 'both', opacity: 0 }}>
      <h2 className="text-base font-semibold mb-4" style={{ color: '#be185d' }}>
        Suggested Alternatives
      </h2>
      <div className="space-y-3">
        {alternatives.map((alt, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 rounded-2xl"
            style={{ background: 'rgba(255,240,245,0.7)', border: '1px solid rgba(255,107,157,0.15)' }}
          >
            <div className="flex items-center gap-2 sm:w-48 flex-shrink-0">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#fee2e2', color: '#991b1b' }}>
                {alt.original}
              </span>
              <span style={{ color: '#d4739a' }}>→</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#166534' }}>
                {alt.suggested}
              </span>
            </div>
            <p className="text-xs leading-relaxed flex-1" style={{ color: '#6b3050' }}>
              {alt.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
