'use client';

/**
 * MoleculeViewer — renders an interactive 3D molecule using 3Dmol.js.
 *
 * 3Dmol.js requires the browser environment (window, canvas), so it is
 * imported dynamically inside useEffect and never executed server-side.
 *
 * Data flow:
 *   1. Fetch SDF from /api/pubchem-sdf?cid=<n>  (our proxy → PubChem)
 *   2. Pass SDF text to $3Dmol.createViewer
 *   3. Render stick model with atom colour scheme
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  cid: number;
  name: string;
}

type ViewerState = 'loading' | 'ready' | 'no3d' | 'error';

export default function MoleculeViewer({ cid, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ViewerState>('loading');

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        // Fetch SDF via our proxy (avoids CSP connect-src restriction)
        const sdfRes = await fetch(`/api/pubchem-sdf?cid=${cid}`);

        if (!sdfRes.ok) {
          if (!cancelled) setState(sdfRes.status === 404 ? 'no3d' : 'error');
          return;
        }

        const sdf = await sdfRes.text();

        // Dynamically import 3Dmol — it manipulates window/canvas and must run
        // client-side only. Importing in useEffect guarantees this.
        const $3Dmol = await import('3dmol');

        if (cancelled || !containerRef.current) return;

        const viewer = $3Dmol.createViewer(containerRef.current, {
          backgroundColor: '#fff8fb',
          antialias: true,
        });

        viewer.addModel(sdf, 'sdf');
        viewer.setStyle({}, {
          stick: { radius: 0.15, colorscheme: 'Jmol' },
          sphere: { scale: 0.25, colorscheme: 'Jmol' },
        });
        viewer.zoomTo();
        viewer.render();
        // Gentle continuous spin
        viewer.spin('y', 0.5);

        if (!cancelled) setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => { cancelled = true; };
  }, [cid]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Viewer canvas — 3Dmol writes into this div */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 320,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fff8fb',
          position: 'relative',
        }}
      />

      {/* State overlays */}
      {state === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,248,251,0.85)',
            borderRadius: 12,
            fontSize: 13,
            color: '#d4739a',
          }}
        >
          Loading 3D structure…
        </div>
      )}

      {state === 'no3d' && (
        <p className="text-xs text-center" style={{ color: '#a8547a' }}>
          No 3D conformer available for {name} in PubChem.
        </p>
      )}

      {state === 'error' && (
        <p className="text-xs text-center" style={{ color: '#a8547a' }}>
          Could not load 3D structure. PubChem may be temporarily unavailable.
        </p>
      )}

      {state === 'ready' && (
        <p className="text-xs text-center" style={{ color: '#c4879a' }}>
          Drag to rotate · Scroll to zoom
        </p>
      )}
    </div>
  );
}
