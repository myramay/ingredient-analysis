/**
 * lib/pubchem.ts — SERVER-SIDE ONLY
 *
 * Fetches chemical data from the PubChem REST API for a single ingredient.
 * Returns null on any failure (404, timeout, network error) so callers can
 * treat enrichment as best-effort without crashing the analysis flow.
 *
 * Timeout: 3 s per call — fast enough for parallel use, short enough not to
 * stall the whole response if PubChem is slow.
 *
 * Cache: Next.js caches the fetch for 24 h so repeat analyses of the same
 * ingredient don't make redundant network calls.
 */
import 'server-only';

import type { PubChemData } from '@/app/lib/types';

type Prop = {
  urn: { label: string; name?: string };
  value: { sval?: string; fval?: number };
};

export async function fetchPubChemData(ingredient: string): Promise<PubChemData | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3_000);

  try {
    const url =
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/` +
      `${encodeURIComponent(ingredient)}/JSON`;

    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 86_400 }, // cache 24 h
    });

    if (!res.ok) return null;

    const data = await res.json();
    const compound = data?.PC_Compounds?.[0];
    if (!compound) return null;

    const cid: number | null = compound.id?.id?.cid ?? null;
    if (!cid) return null;

    const props: Prop[] = compound.props ?? [];

    const getSval = (label: string, name?: string): string | null =>
      props.find(
        (p) => p.urn.label === label && (name ? p.urn.name === name : true)
      )?.value?.sval ?? null;

    return {
      cid,
      iupacName: getSval('IUPAC Name', 'Preferred'),
      molecularFormula: getSval('Molecular Formula'),
      molecularWeight:
        props.find((p) => p.urn.label === 'Molecular Weight')?.value?.fval ?? null,
      inchiKey: getSval('InChIKey'),
    };
  } catch {
    // AbortError (timeout), network failure, or JSON parse error — all are
    // treated the same: return null and let the caller skip enrichment.
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
