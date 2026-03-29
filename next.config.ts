/**
 * next.config.ts
 *
 * Security headers applied to every response.
 *
 * OWASP references:
 *   A05:2021 Security Misconfiguration — set restrictive defaults
 *   A03:2021 Injection — CSP prevents injected scripts from executing
 */

import type { NextConfig } from 'next';

// ─── Content Security Policy ──────────────────────────────────────────────────
//
// Notes on each directive:
//
//   script-src  'unsafe-inline'
//     Next.js inlines small scripts for hydration.  A nonce-based approach
//     removes this need but requires middleware; this is the pragmatic default.
//     Remove 'unsafe-inline' and add a nonce when you add auth middleware.
//
//   script-src  'unsafe-eval'  (dev only)
//     React + Turbopack use eval() in development for call-stack reconstruction
//     and hot-module replacement.  React explicitly never uses eval() in
//     production, so this directive is omitted from the production CSP.
//
//   style-src   'unsafe-inline'
//     React's `style={{ ... }}` prop generates inline styles.  Removing this
//     would require refactoring all inline styles to CSS classes.
//
//   connect-src *.supabase.co
//     Allows the browser to call the Supabase REST API directly (anon client).
//
//   font-src    fonts.gstatic.com
//     Geist font loaded via next/font/google.
//
//   frame-ancestors 'none'
//     Prevents the page from being embedded in an iframe (clickjacking).
//     Supersedes X-Frame-Options in modern browsers; we send both.
//
const isDev = process.env.NODE_ENV === 'development';

const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' is required by React/Turbopack in dev; never sent in prod
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  // ── Prevent MIME-type sniffing ──────────────────────────────────────────
  // Stops browsers from guessing a response's content type, which can allow
  // a script disguised as an image to execute.
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },

  // ── Clickjacking protection ─────────────────────────────────────────────
  // Older browsers that don't understand frame-ancestors fall back to this.
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },

  // ── Referrer policy ─────────────────────────────────────────────────────
  // Send the full URL to same-origin requests; only the origin to cross-origin
  // ones.  Prevents ingredient lists from leaking in Referer headers to third
  // parties (e.g. PubChem, Google Fonts).
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },

  // ── Permissions policy ──────────────────────────────────────────────────
  // Disable browser features this app never uses, limiting the impact of any
  // future XSS.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },

  // ── Content Security Policy ─────────────────────────────────────────────
  {
    key: 'Content-Security-Policy',
    value: CSP,
  },

  // ── HTTPS enforcement ───────────────────────────────────────────────────
  // Once a browser has visited over HTTPS, subsequent visits are forced over
  // HTTPS for 1 year, including subdomains.
  // Remove `includeSubDomains` if you have HTTP-only subdomains.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },

  // ── Cross-Origin policies ───────────────────────────────────────────────
  // Prevent Spectre-style side-channel attacks by isolating the browsing
  // context.  Required to enable `SharedArrayBuffer` if needed in future.
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
];

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // Apply to all routes
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
