'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@/app/lib/types';
import LoadingSkeleton from './LoadingSkeleton';
import AnalysisResults from './AnalysisResults';

export default function InputForm() {
  const [productName, setProductName] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: productName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult(data as AnalysisResult);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError('');
  }

  if (loading) return <LoadingSkeleton />;

  if (result) return <AnalysisResults result={result} onReset={handleReset} />;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-4">
      <div className="glass-card p-5">
        <label htmlFor="product-name" className="block text-sm font-semibold mb-1.5" style={{ color: '#be185d' }}>
          Product Name
        </label>
        <input
          id="product-name"
          type="text"
          className="input-pink"
          placeholder="e.g. CeraVe Moisturizing Cream"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          maxLength={120}
          required
          autoFocus
        />
        <p className="mt-1.5 text-xs" style={{ color: '#c4879a' }}>
          Enter any well-known skincare or beauty product and we'll look up its ingredients for you.
        </p>
      </div>

      {error && (
        <div
          className="px-4 py-3 rounded-2xl text-sm font-medium"
          style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-pink w-full text-base"
        disabled={!productName.trim()}
      >
        Analyze Ingredients ✨
      </button>

      {/* Sample products */}
      <div className="flex flex-wrap gap-2 justify-center">
        {['CeraVe Moisturizing Cream', 'La Roche-Posay Cicaplast Baume B5', 'Neutrogena Hydro Boost'].map((name) => (
          <button
            key={name}
            type="button"
            className="text-xs px-3 py-1.5 rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'rgba(244,63,122,0.08)', color: '#d4739a', border: '1px solid rgba(244,63,122,0.2)' }}
            onClick={() => setProductName(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </form>
  );
}
