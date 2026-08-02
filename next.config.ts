import type { NextConfig } from "next";

/**
 * The audio worklets are served from /public and loaded by AudioWorklet, and
 * the browser opens a WebSocket straight to Google's Live API, so the CSP has
 * to allow both. `connect-src wss://generativelanguage.googleapis.com` is what
 * makes the direct-to-Google audio path work without proxying.
 */
const csp = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts; 'unsafe-inline' is required for the
  // App Router runtime without wiring per-request nonces.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The demo needs the mic; everything else is off.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Worklets are static and versioned with the deploy.
        source: "/worklets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
