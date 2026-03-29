/**
 * lib/validation.ts
 *
 * Schema-based input validation and sanitization for all API routes.
 *
 * OWASP references:
 *   A03:2021 Injection              — sanitize before passing to LLM / DB
 *   A08:2021 Software & Data Integrity — reject unexpected / malformed input
 *
 * Design decisions:
 *   • No external dependency (no Zod) — keeps the security layer auditable
 *     and self-contained.
 *   • Validation and sanitization are separate steps: validate shape/types
 *     first, then strip/escape problematic characters.
 *   • Every function is pure and throws `ValidationError` on failure so
 *     callers can catch it and return a clean 400.
 */

// ─── Error type ──────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(
    /** The field that failed validation. */
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ─── Sanitization helpers ─────────────────────────────────────────────────────

/**
 * Strip characters that have no place in user-supplied text that will be
 * forwarded to an LLM, stored in a DB, or echoed back in a response.
 *
 *  • HTML tags — prevent reflected XSS if content is ever rendered in a
 *    browser without escaping (even in JSON responses served as HTML).
 *  • Null bytes — can truncate strings in C-backed libs or confuse parsers.
 *  • ASCII control characters (except \t \n \r) — no legitimate use in
 *    ingredient names or product names.
 */
function sanitize(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/\0/g, '')                // strip null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim();
}

// ─── /api/analyze validator ───────────────────────────────────────────────────

export interface ValidatedAnalyzeInput {
  /** Present when the user pasted their own list; absent when OpenAI should look it up. */
  ingredientList?: string;
  productName?: string;
}

/**
 * Validate and sanitize the POST body for /api/analyze.
 *
 * Rules:
 *   productName     optional string, max 120 chars after sanitization
 *   ingredientList  optional string, 3–5 000 chars after sanitization
 *   At least one of the two must be provided.
 *   (any other field)  → rejected (OWASP mass-assignment protection)
 */
export function validateAnalyzeInput(body: unknown): ValidatedAnalyzeInput {
  // ── 1. Top-level shape ────────────────────────────────────────────────────
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('body', 'Request body must be a JSON object.');
  }

  const raw = body as Record<string, unknown>;

  // ── 2. Reject unexpected fields (mass-assignment protection) ──────────────
  const ALLOWED_FIELDS = new Set(['ingredientList', 'productName']);
  const unexpected = Object.keys(raw).filter((k) => !ALLOWED_FIELDS.has(k));
  if (unexpected.length > 0) {
    throw new ValidationError(
      'body',
      `Unexpected field(s): ${unexpected.join(', ')}.`
    );
  }

  // ── 3. productName (optional) ─────────────────────────────────────────────
  let productName: string | undefined;
  if (raw.productName !== undefined) {
    if (typeof raw.productName !== 'string') {
      throw new ValidationError('productName', 'productName must be a string.');
    }
    const cleaned = sanitize(raw.productName);
    if (cleaned.length > 120) {
      throw new ValidationError(
        'productName',
        'Product name must be 120 characters or fewer.'
      );
    }
    productName = cleaned.length > 0 ? cleaned : undefined;
  }

  // ── 4. ingredientList (optional) ─────────────────────────────────────────
  let ingredientList: string | undefined;
  if (raw.ingredientList !== undefined) {
    if (typeof raw.ingredientList !== 'string') {
      throw new ValidationError('ingredientList', 'ingredientList must be a string.');
    }
    const cleaned = sanitize(raw.ingredientList);
    if (cleaned.length < 3) {
      throw new ValidationError('ingredientList', 'Ingredient list is too short.');
    }
    if (cleaned.length > 5_000) {
      throw new ValidationError(
        'ingredientList',
        'Ingredient list must be 5 000 characters or fewer.'
      );
    }
    ingredientList = cleaned;
  }

  // ── 5. At least one field required ───────────────────────────────────────
  if (!productName && !ingredientList) {
    throw new ValidationError('productName', 'A product name or ingredient list is required.');
  }

  return { ingredientList, productName };
}

// ─── /api/pubchem validator ───────────────────────────────────────────────────

/**
 * Validate and sanitize the `ingredient` query parameter for /api/pubchem.
 *
 * Rules:
 *   • Required, non-empty
 *   • Max 200 characters
 *   • Only characters that can legitimately appear in a chemical / INCI name:
 *       letters, digits, spaces, hyphens, parentheses, commas, periods,
 *       apostrophes, forward slashes, plus signs, square brackets.
 *     This blocks SQL fragments, shell metacharacters, and HTML injection.
 *
 * Valid examples: "Sodium Lauryl Sulfate", "PEG-10 Dimethicone",
 *   "1,3-Butanediol", "C12-15 Alkyl Benzoate", "Retinyl Acetate (Vitamin A)"
 */
export function validatePubChemInput(ingredient: string | null): string {
  if (!ingredient) {
    throw new ValidationError('ingredient', 'ingredient query param is required.');
  }

  const cleaned = sanitize(ingredient);

  if (cleaned.length === 0) {
    throw new ValidationError('ingredient', 'ingredient cannot be empty.');
  }
  if (cleaned.length > 200) {
    throw new ValidationError(
      'ingredient',
      'ingredient must be 200 characters or fewer.'
    );
  }

  // Allowlist of characters found in INCI / chemical names
  if (!/^[a-zA-Z0-9\s\-(),.'/+[\]]+$/.test(cleaned)) {
    throw new ValidationError(
      'ingredient',
      'ingredient contains invalid characters.'
    );
  }

  return cleaned;
}

// ─── Admin secret guard ───────────────────────────────────────────────────────

/**
 * Constant-time string comparison to prevent timing attacks on secret tokens.
 *
 * A naive `===` comparison short-circuits on the first mismatched character,
 * leaking information about how much of the secret is correct.  This
 * implementation always iterates the full length.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Validate the `Authorization: Bearer <token>` header against ADMIN_SECRET.
 *
 * Returns an error string if the check fails, or `null` if it passes.
 * Callers should return a 401 if this returns a string.
 */
export function validateAdminSecret(
  authHeader: string | null
): string | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    // Env var not configured → treat test routes as disabled
    return 'ADMIN_SECRET is not configured. Set it in .env.local to enable this route.';
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return 'Missing or malformed Authorization header. Expected: Authorization: Bearer <ADMIN_SECRET>';
  }

  const token = authHeader.slice(7); // strip "Bearer "
  if (!timingSafeEqual(token, secret)) {
    return 'Invalid admin secret.';
  }

  return null; // ✓ valid
}
