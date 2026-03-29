import type { AnalysisResult, SafetyLevel } from '@/app/lib/types';
import TransparencyScore from './TransparencyScore';
import IngredientCard from './IngredientCard';
import AlternativesSection from './AlternativesSection';

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

const SAFETY_ORDER: SafetyLevel[] = ['allergen', 'controversial', 'caution', 'under_research', 'safe'];

function SafetySummaryBadge({ safety, count }: { safety: SafetyLevel; count: number }) {
  if (!count) return null;
  const styles: Record<SafetyLevel, { bg: string; text: string; label: string }> = {
    safe:           { bg: '#dcfce7', text: '#166534', label: 'Safe' },
    caution:        { bg: '#fef3c7', text: '#92400e', label: 'Caution' },
    controversial:  { bg: '#ffedd5', text: '#9a3412', label: 'Controversial' },
    allergen:       { bg: '#fee2e2', text: '#991b1b', label: 'Allergen' },
    under_research: { bg: '#ede9fe', text: '#4c1d95', label: 'Under Research' },
  };
  const s = styles[safety];
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}
    >
      {count} {s.label}
    </span>
  );
}

export default function AnalysisResults({ result, onReset }: Props) {
  const sortedIngredients = [...result.ingredients].sort(
    (a, b) => SAFETY_ORDER.indexOf(a.safety) - SAFETY_ORDER.indexOf(b.safety)
  );

  const counts = result.ingredients.reduce<Record<SafetyLevel, number>>(
    (acc, ing) => { acc[ing.safety] = (acc[ing.safety] ?? 0) + 1; return acc; },
    {} as Record<SafetyLevel, number>
  );

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {result.productName && (
            <p className="text-sm font-medium" style={{ color: '#d4739a' }}>
              Analyzed: <span style={{ color: '#be185d' }}>{result.productName}</span>
            </p>
          )}
          <p className="text-sm" style={{ color: '#a8547a' }}>
            {result.ingredients.length} ingredients analyzed
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          style={{ background: 'rgba(255,107,157,0.12)', color: '#be185d' }}
        >
          ← Analyze Another
        </button>
      </div>

      {/* Safety summary pills */}
      <div className="flex flex-wrap gap-2">
        {SAFETY_ORDER.map((s) => (
          <SafetySummaryBadge key={s} safety={s} count={counts[s] ?? 0} />
        ))}
      </div>

      {/* Score */}
      <TransparencyScore score={result.transparencyScore} />

      {/* Overall summary */}
      {result.overallSummary && (
        <div
          className="glass-card p-5 animate-fade-up"
          style={{ animationDelay: '0.1s', animationFillMode: 'both', opacity: 0 }}
        >
          <h2 className="text-base font-semibold mb-2" style={{ color: '#be185d' }}>
            Overview
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#4a1530' }}>
            {result.overallSummary}
          </p>
        </div>
      )}

      {/* Ingredient cards */}
      <div>
        <h2 className="text-base font-semibold mb-3 px-1" style={{ color: '#be185d' }}>
          Ingredient Breakdown
        </h2>
        <div className="space-y-3">
          {sortedIngredients.map((ing, i) => (
            <IngredientCard key={ing.name + i} ingredient={ing} index={i} />
          ))}
        </div>
      </div>

      {/* Alternatives */}
      {result.alternatives.length > 0 && (
        <AlternativesSection alternatives={result.alternatives} />
      )}

      {/* Footer note */}
      <p className="text-center text-xs pb-4" style={{ color: '#c4879a' }}>
        For informational purposes only. Not medical advice. Consult a dermatologist for personal concerns.
      </p>
    </div>
  );
}
