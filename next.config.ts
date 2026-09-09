import type { NextConfig } from "next";

/**
 * Security response headers applied to every route (including /api, which the
 * proxy matcher cannot reach). Defence-in-depth for a live app holding family
 * PII + authenticated sessions:
 *  - HSTS: force HTTPS (the host already serves HTTPS).
 *  - X-Content-Type-Options: stop MIME sniffing.
 *  - Referrer-Policy: don't leak full URLs (e.g. ?next=, reset codes) cross-site.
 *  - X-Frame-Options + CSP frame-ancestors: block clickjacking of the
 *    authenticated members area / account + billing pages.
 *  - Permissions-Policy: allow Lily's microphone only on this same origin and
 *    deny the other powerful features the app does not use.
 *  - Content-Security-Policy: limit script/connect/frame origins to the
 *    services actually used. Supabase (NEXT_PUBLIC_SUPABASE_URL) is needed for
 *    connect-src (browser auth/data); Stripe Checkout is a full-page redirect,
 *    so js.stripe.com/api.stripe.com are allowed for forward-compatibility if
 *    Stripe.js is ever added. OpenAI/Resend/SMTP are server-side only and need
 *    not appear here. 'unsafe-inline' is kept for styles (Tailwind) and the
 *    Next runtime; tighten with a nonce in a later pass.
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

// Marketing / analytics tag origins (Google Tag Manager + GA4 + Google Ads, and
// the Meta/Facebook Pixel). GTM is a tag container that can load Google Ads and
// GA4 tags, so the well-known Google + Meta origins are allow-listed on the
// relevant directives. Beacon/collect calls are GETs on https: images, already
// covered by img-src; connect-src covers the XHR/fetch/sendBeacon variants.
const analyticsScript =
  "https://www.googletagmanager.com https://www.google-analytics.com " +
  "https://www.googleadservices.com https://googleads.g.doubleclick.net " +
  "https://connect.facebook.net";
const analyticsConnect =
  "https://www.googletagmanager.com https://*.google-analytics.com " +
  "https://*.analytics.google.com https://www.google.com " +
  "https://googleads.g.doubleclick.net https://stats.g.doubleclick.net " +
  "https://connect.facebook.net https://www.facebook.com";
const analyticsFrame =
  "https://www.googletagmanager.com https://td.doubleclick.net " +
  "https://bid.g.doubleclick.net https://www.facebook.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://js.stripe.com ${analyticsScript}`,
  `connect-src 'self' ${supabaseOrigin} https://api.stripe.com ${analyticsConnect}`,
  `frame-src 'self' https://js.stripe.com https://checkout.stripe.com ${analyticsFrame}`,
]
  .join("; ")
  .replace(/\s+/g, " ")
  .trim();

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
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
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
