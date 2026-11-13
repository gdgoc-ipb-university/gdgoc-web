/**
 * The header the auth route sets for Better Auth on Convex, which reads it first (`convex/auth.ts`). Auth requests reach
 * Convex through a second Cloudflare hop, which appends to `x-forwarded-for` and overwrites `cf-connecting-ip`, so
 * neither still names the visitor there (#294).
 */
export const CLIENT_IP_HEADER = "x-gdgoc-client-ip";

/**
 * The visitor's IP as the site's edge saw it: Cloudflare's `cf-connecting-ip` (the site is behind Cloudflare), then
 * `x-real-ip`, then the first `x-forwarded-for` entry. Null when none is set.
 */
export function clientIp(headers: Headers) {
  const candidates = [headers.get("cf-connecting-ip"), headers.get("x-real-ip"), headers.get("x-forwarded-for")?.split(",")[0]];
  return candidates.map((value) => value?.trim()).find(Boolean) ?? null;
}

/**
 * The request to forward to Convex: the same method, URL and body, with CLIENT_IP_HEADER set from `clientIp`. A value the
 * client sent is always replaced, or removed when no IP is known. The body is passed on as the original stream.
 */
export function withClientIp(request: Request) {
  const headers = new Headers(request.headers);
  const ip = clientIp(request.headers);
  if (ip) headers.set(CLIENT_IP_HEADER, ip);
  else headers.delete(CLIENT_IP_HEADER);
  return new Request(request, { headers });
}
