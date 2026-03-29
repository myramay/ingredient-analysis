'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { IngredientAnalysis, PubChemData } from '@/app/lib/types';

// Lazy-load the 3D viewer — it imports 3Dmol.js which needs the browser
const MoleculeViewer = dynamic(() => import('./MoleculeViewer'), { ssr: false });

interface Props {
  ingredient: IngredientAnalysis;
  index: number;
}

const SAFETY_CONFIG = {
  safe:            { label: 'Safe',            icon: '✓', bg: 'badge-safe',            desc: 'Well-studied and generally non-irritating' },
  caution:         { label: 'Caution',         icon: '!', bg: 'badge-caution',         desc: 'May irritate sensitive skin' },
  controversial:   { label: 'Controversial',   icon: '?', bg: 'badge-controversial',   desc: 'Mixed research in the community' },
  allergen:        { label: 'Allergen',         icon: '⚠', bg: 'badge-allergen',        desc: 'Known allergen or frequent sensitizer' },
  under_research:  { label: 'Under Research',  icon: '◌', bg: 'badge-under_research',  desc: 'Limited data available' },
};

const CATEGORY_ICONS: Record<string, string> = {
  solvent: '💧', emollient: '🧴', preservative: '🛡', fragrance: '🌸',
  surfactant: '🫧', humectant: '💦', emulsifier: '⚗️', antioxidant: '🍃',
  active: '⚡', colorant: '🎨', thickener: '🌀', other: '•',
};

export default function IngredientCard({ ingredient, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pubchemData, setPubchemData] = useState<PubChemData | null>(
    ingredient.pubchemData ?? null
  );
  const [pubchemLoading, setPubchemLoading] = useState(false);
  const [showMolecule, setShowMolecule] = useState(false);

  const config = SAFETY_CONFIG[ingredient.safety] ?? SAFETY_CONFIG.safe;
  const catIcon = CATEGORY_ICONS[ingredient.category] ?? '•';
  const confidencePct = Math.round(ingredient.confidence * 100);

  async function handleExpand() {
    const opening = !expanded;
    setExpanded(opening);
    // Fetch PubChem data the first time the card is opened
    if (opening && pubchemData === null && !pubchemLoading) {
      setPubchemLoading(true);
      try {
        const res = await fetch(
          `/api/pubchem?ingredient=${encodeURIComponent(ingredient.name)}`
        );
        if (res.ok) setPubchemData(await res.json());
      } catch {
        // PubChem unavailable — card still renders without chemical data
      } finally {
        setPubchemLoading(false);
      }
    }
  }

  return (
    <div
      className={`glass-card p-5 cursor-pointer safety-${ingredient.safety} animate-fade-up`}
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both', opacity: 0 }}
      onClick={handleExpand}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold truncate" style={{ color: '#1a0a10' }}>
              {ingredient.name}
            </span>
            {ingredient.normalizedName !== ingredient.name && (
              <span className="text-xs" style={{ color: '#d4739a' }}>
                ({ingredient.normalizedName})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs" aria-hidden>{catIcon}</span>
            <span className="text-xs capitalize" style={{ color: '#a8547a' }}>
              {ingredient.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.bg}`}>
            {config.icon} {config.label}
          </span>
          <span
            className="text-xs transition-transform duration-200"
            style={{ color: '#d4739a', transform: expanded ? 'rotate(180deg)' : 'none' }}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </div>

      {/* Explanation (always visible) */}
      <p className="mt-2.5 text-sm leading-relaxed" style={{ color: '#4a1530' }}>
        {ingredient.explanation}
      </p>

      {/* Expanded: reasoning + confidence */}
      {expanded && (
        <div className="mt-3 pt-3 space-y-2.5 border-t" style={{ borderColor: 'rgba(255,107,157,0.15)' }}>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#d4739a' }}>
              Why this rating
            </span>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: '#6b3050' }}>
              {ingredient.reasoning}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#d4739a' }}>Confidence</span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: '#ffe4ee' }}>
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${confidencePct}%`, background: 'linear-gradient(90deg, #f43f7a, #be185d)' }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color: '#f43f7a' }}>{confidencePct}%</span>
          </div>
          <p className="text-xs italic" style={{ color: '#c4879a' }}>{config.desc}</p>

          {/* PubChem chemical data — fetched on first expand */}
          {pubchemLoading && (
            <p className="text-xs" style={{ color: '#d4739a' }}>Loading chemical data…</p>
          )}
          {pubchemData && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#d4739a' }}>
                Chemical Data
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
                {pubchemData.molecularFormula && (
                  <>
                    <span className="text-xs" style={{ color: '#a8547a' }}>Formula</span>
                    <span className="text-xs font-mono" style={{ color: '#6b3050' }}>
                      {pubchemData.molecularFormula}
                    </span>
                  </>
                )}
                {pubchemData.molecularWeight && (
                  <>
                    <span className="text-xs" style={{ color: '#a8547a' }}>Mol. weight</span>
                    <span className="text-xs font-mono" style={{ color: '#6b3050' }}>
                      {pubchemData.molecularWeight} g/mol
                    </span>
                  </>
                )}
                {pubchemData.cid && (
                  <>
                    <span className="text-xs" style={{ color: '#a8547a' }}>PubChem CID</span>
                    <a
                      href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemData.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs"
                      style={{ color: '#f43f7a' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pubchemData.cid} ↗
                    </a>
                  </>
                )}
              </div>

              {/* 3D structure button — only shown when a CID is available */}
              {pubchemData.cid && (
                <button
                  className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #f43f7a, #be185d)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMolecule(true);
                  }}
                >
                  ⬡ View 3D Structure
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3D Molecule Modal */}
      {showMolecule && pubchemData?.cid && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`3D structure of ${ingredient.name}`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(26, 10, 16, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowMolecule(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #fff0f6 0%, #ffe4ee 100%)',
              borderRadius: 16,
              padding: 20,
              width: 'min(480px, 92vw)',
              boxShadow: '0 24px 64px rgba(244,63,122,0.25)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1a0a10' }}>
                  {ingredient.name}
                </p>
                <p className="text-xs" style={{ color: '#a8547a' }}>
                  3D Molecular Structure
                </p>
              </div>
              <button
                onClick={() => setShowMolecule(false)}
                aria-label="Close"
                style={{
                  background: 'rgba(244,63,122,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#f43f7a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <MoleculeViewer cid={pubchemData.cid} name={ingredient.name} />
          </div>
        </div>
      )}
    </div>
  );
}
