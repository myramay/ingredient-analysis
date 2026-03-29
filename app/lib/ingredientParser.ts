/**
 * Parses a raw ingredient list string into an array of normalized ingredient names.
 * Handles common formats: comma-separated, newline-separated, or mixed.
 */
export function parseIngredientList(raw: string): string[] {
  if (!raw.trim()) return [];

  // Split on commas, newlines, semicolons, or bullet points
  const parts = raw
    .split(/[,\n;•·]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Remove common noise like numbers, brackets, asterisks
  return parts
    .map((part) => part.replace(/^\d+\.\s*/, '').replace(/\*/g, '').trim())
    .filter((s) => s.length > 0);
}

/**
 * Normalizes a single ingredient name for display and lookup.
 */
export function normalizeIngredient(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
