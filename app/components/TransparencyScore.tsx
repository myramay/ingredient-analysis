'use client';

import { useEffect, useRef } from 'react';
import type { TransparencyScore as TScore } from '@/app/lib/types';

interface Props {
  score: TScore;
}

function scoreColor(n: number) {
  if (n >= 80) return '#22c55e';
  if (n >= 60) return '#84cc16';
  if (n >= 40) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(n: number) {
  if (n >= 80) return 'Excellent';
  if (n >= 60) return 'Good';
  if (n >= 40) return 'Fair';
  return 'Needs Attention';
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 339.3

export default function TransparencyScore({ score }: Props) {
  const circleRef = useRef<SVGCircleElement>(null);
  const color = scoreColor(score.overall);
  const offset = CIRCUMFERENCE - (score.overall / 100) * CIRCUMFERENCE;

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    el.style.setProperty('--score-offset', String(offset));
    // Force reflow so animation triggers on mount
    el.style.strokeDashoffset = String(CIRCUMFERENCE);
    requestAnimationFrame(() => {
      el.classList.add('score-ring-circle');
    });
  }, [offset]);

  const breakdownItems = [
    { label: 'Ingredient Risk', value: score.breakdown.ingredientRisk },
    { label: 'Clarity', value: score.breakdown.clarity },
    { label: 'Research Backing', value: score.breakdown.researchBacking },
    { label: 'Complexity', value: score.breakdown.complexity },
  ];

  return (
    <div className="glass-card p-6 animate-fade-up">
      <h2 className="text-base font-semibold mb-4" style={{ color: '#be185d' }}>
        Transparency Score
      </h2>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Ring meter */}
        <div className="relative flex-shrink-0 w-32 h-32">
          <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle
              cx="64" cy="64" r={RADIUS}
              fill="none"
              stroke="#ffe4ee"
              strokeWidth="12"
            />
            {/* Progress */}
            <circle
              ref={circleRef}
              cx="64" cy="64" r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              style={{
                strokeDasharray: CIRCUMFERENCE,
                strokeDashoffset: CIRCUMFERENCE,
                transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ color }}>
              {score.overall}
            </span>
            <span className="text-[11px] font-medium mt-0.5" style={{ color }}>
              {scoreLabel(score.overall)}
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 w-full space-y-3">
          {breakdownItems.map(({ label, value }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#6b3050' }}>{label}</span>
                <span className="font-semibold" style={{ color: scoreColor(value) }}>{value}</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: '#ffe4ee' }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-700"
                  style={{
                    width: `${value}%`,
                    background: `linear-gradient(90deg, ${scoreColor(value)}, ${scoreColor(value)}cc)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {score.summary && (
        <p className="mt-4 text-sm leading-relaxed" style={{ color: '#6b3050' }}>
          {score.summary}
        </p>
      )}
    </div>
  );
}
