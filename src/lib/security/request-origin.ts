// Next normalises loopback URLs to localhost. Compare Origin with the actual
// HTTP Host (which browsers cannot override), not the normalised NextURL host.
export function isSameOriginRequest(request: Pick<Request, "headers" | "url">) {
  try {
    const supplied = request.headers.get("origin");
    if (!supplied) return false;
    const origin = new URL(supplied), url = new URL(request.url);
    const host = request.headers.get("host") ?? url.host;
    return supplied === origin.origin && ["http:", "https:"].includes(origin.protocol) && origin.protocol === url.protocol && origin.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}
