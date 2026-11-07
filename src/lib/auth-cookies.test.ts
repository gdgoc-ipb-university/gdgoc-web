import { describe, expect, it } from "vitest";
import { hostOnlyExpiries, withHostOnlyExpiries } from "./auth-cookies";
import { hostOptions } from "../../convex/auth";

describe("shared login across hosts", () => {
  it("trusts the league and shares cookies on the parent domain only when configured", () => {
    expect(hostOptions({ SITE_URL: "https://www.gdgocipb.com" })).toEqual({ trustedOrigins: ["https://www.gdgocipb.com"] });
    expect(hostOptions({})).toEqual({ trustedOrigins: [] });
    expect(hostOptions({ SITE_URL: "https://www.gdgocipb.com", LEAGUE_URL: "https://league.gdgocipb.com", AUTH_COOKIE_DOMAIN: "gdgocipb.com" })).toEqual({
      trustedOrigins: ["https://www.gdgocipb.com", "https://league.gdgocipb.com"],
      advanced: { crossSubDomainCookies: { enabled: true, domain: "gdgocipb.com" } },
    });
  });

  it("expires the old host-only twin of every cookie set on the parent domain", () => {
    expect(hostOnlyExpiries([
      "__Secure-better-auth.session_token=abc.sig; Max-Age=604800; Domain=gdgocipb.com; Path=/; HttpOnly; Secure; SameSite=Lax",
      "better-auth.state=; Max-Age=0; Domain=lvh.me; Path=/; HttpOnly; SameSite=Lax",
      "host-only=1; Path=/",
    ])).toEqual([
      "__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure",
      "better-auth.state=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    ]);
  });

  it("passes a response through untouched when it sets no domain cookie", async () => {
    const plain = new Response("{}", { headers: { "set-cookie": "a=1; Path=/" } });
    expect(withHostOnlyExpiries(plain)).toBe(plain);
    const shared = withHostOnlyExpiries(new Response("ok", { status: 302, headers: { location: "/", "set-cookie": "a=1; Domain=gdgocipb.com; Path=/" } }));
    expect(shared.status).toBe(302);
    expect(shared.headers.getSetCookie()).toEqual(["a=1; Domain=gdgocipb.com; Path=/", "a=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"]);
    expect(await shared.text()).toBe("ok");
  });
});
