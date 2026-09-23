import type { NextConfig } from "next";

/**
 * Security response headers applied to every route (including /api, which the
 * proxy matcher cannot reach). Defence-in-depth for a live app holding family
 * PII + authenticated sessions:
 *  - HSTS: force HTTPS on the configured production host. Subdomains and
 *    preload need separate validation before they can be included safely.
 *  - X-Content-Type-Options: stop MIME sniffing.
 *  - Referrer-Policy: never expose invitation tokens or reset codes through
 *    a Referer header, including to same-origin assets.
 *  - X-Frame-Options + CSP frame-ancestors: block clickjacking of the
 *    authenticated members area / account + billing pages.
 *  - Permissions-Policy: deny powerful features that this app does not use.
 *  - Content-Security-Policy: limit script/connect/frame origins to the
 *    services actually used. Supabase (NEXT_PUBLIC_SUPABASE_URL) is needed for
 *    browser auth/data. AI and email providers remain server-side and are not
 *    exposed in the browser policy. 'unsafe-inline' is kept only where the
 *    current Next runtime requires it; replace with nonces before certification.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDevelopment = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {
    return "";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "frame-src 'none'",
]
  .join("; ")
  .replace(/\s+/g, " ")
  .trim();

const securityHeaders = [
  ...(isDevelopment ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const privateResponseHeaders = [{ key: "Cache-Control", value: "private, no-store, max-age=0" }];

const nextConfig: NextConfig = {
  // Document uploads are handled by the reviewed Server Action in
  // /documents/actions.ts. The action itself rejects files over 25 MB and
  // disallowed MIME types; this slightly higher transport limit accounts for
  // multipart form overhead before the action receives the file.
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  // Pin the project root — there are multiple lockfiles on this machine, and
  // production builds use webpack (see the "build" script) for Netlify
  // compatibility with Next.js 16 middleware.
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  // For Node hosting (Hostinger): build with HOSTINGER=1 to emit a
  // self-contained server at .next/standalone/server.js. Left undefined on
  // Netlify so its own Next runtime is unaffected.
  output: process.env.HOSTINGER === "1" ? "standalone" : undefined,
  // Security response headers on every route (incl. /api).
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      ...[
        "/dashboard/:path*", "/children/:path*", "/actions/:path*",
        "/documents/:path*", "/circle-ai/:path*", "/my-circle/:path*",
        "/account/:path*", "/privacy/:path*", "/workspace/:path*",
        "/invite/:path*", "/auth/:path*", "/api/:path*",
        "/login/:path*", "/signup/:path*", "/forgot-password/:path*",
        "/reset-password/:path*", "/onboarding/:path*",
      ].map((source) => ({ source, headers: privateResponseHeaders })),
    ];
  },
};

export default nextConfig;
