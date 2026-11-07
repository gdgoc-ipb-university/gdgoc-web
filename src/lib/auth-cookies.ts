/**
 * Before #179 every auth cookie was host-only on www. Once AUTH_COOKIE_DOMAIN moves them to the parent domain, a browser
 * can hold both an old host-only cookie and the shared one of the same name. Better Auth reads the shared one, which the
 * browser sends last, but signing out clears only the shared one, and the old host-only session would then sign the member
 * back in on www. So every auth response that sets a cookie on a domain also expires the host-only cookie of that name.
 * The browser keeps the two apart, so this never touches the shared cookie.
 */
export function hostOnlyExpiries(setCookies: string[]) {
  return setCookies.flatMap((header) => {
    const [pair, ...attributes] = header.split(";").map((part) => part.trim());
    if (!attributes.some((attribute) => /^domain=/i.test(attribute))) return [];
    const name = pair.slice(0, pair.indexOf("="));
    const path = attributes.find((attribute) => /^path=/i.test(attribute)) ?? "Path=/";
    const secure = attributes.some((attribute) => attribute.toLowerCase() === "secure");
    return [`${name}=; Max-Age=0; ${path}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`];
  });
}

/** The auth response with the host-only expiries appended, or the response itself when it sets no domain cookie. */
export function withHostOnlyExpiries(response: Response) {
  const expiries = hostOnlyExpiries(response.headers.getSetCookie());
  if (!expiries.length) return response;
  const headers = new Headers(response.headers);
  for (const expiry of expiries) headers.append("set-cookie", expiry);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
