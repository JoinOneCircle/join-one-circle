const localFallbackOrigin = "http://localhost:3000";

/** Only app-relative paths may be used as post-authentication destinations. */
export function safeInternalPath(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\r\n\0]/.test(value)) return fallback;

  const rawPath = value.split(/[?#]/, 1)[0];
  // Reject encoded separators and percent signs, including double-encoded
  // versions that a downstream proxy might decode differently.
  if (/%(?:2f|5c|25|0a|0d|00)/i.test(rawPath)) return fallback;

  try {
    const origin = "https://join-one-circle.invalid";
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin || parsed.pathname.startsWith("//")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/** Never use the caller-controlled Origin header to construct an email link. */
export function configuredSiteOrigin(siteUrl: string | undefined, nodeEnv: string | undefined, requestOrigin?: string | null) {
  if (siteUrl?.trim()) {
    const configured = new URL(siteUrl);
    const local = configured.hostname === "localhost" || configured.hostname === "127.0.0.1";
    if (configured.protocol !== "https:" && !(nodeEnv !== "production" && local && configured.protocol === "http:")) {
      throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS outside local development");
    }
    return configured.origin;
  }

  if (nodeEnv === "production") throw new Error("NEXT_PUBLIC_SITE_URL is required in production");
  if (requestOrigin) {
    try {
      const requested = new URL(requestOrigin);
      if (requested.protocol === "http:" && (requested.hostname === "localhost" || requested.hostname === "127.0.0.1")) {
        return requested.origin;
      }
    } catch { /* Use the fixed local fallback below. */ }
  }
  return localFallbackOrigin;
}
