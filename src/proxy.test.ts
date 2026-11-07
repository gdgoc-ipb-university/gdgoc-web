// @vitest-environment node
// next.config is evaluated in Node, and the config test helper needs a real global scope.
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRedirectUrl, getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";

const LEAGUE = "https://league.gdgocipb.com";
const MAIN = "https://www.gdgocipb.com";

/** The proxy and next.config as built with the given league URL; NEXT_PUBLIC_* values are read once at import. */
async function load(leagueUrl?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", MAIN);
  vi.stubEnv("NEXT_PUBLIC_LEAGUE_URL", leagueUrl ?? "");
  return { ...await import("./proxy"), nextConfig: (await import("../next.config")).default };
}

const request = (url: string) => new NextRequest(url, { headers: { host: new URL(url).host } });

afterEach(() => { vi.unstubAllEnvs(); });

describe("league proxy", () => {
  it("rewrites the league host's pages under /league, and nothing else", async () => {
    const { nextConfig } = await load(LEAGUE);
    const served = async (url: string, host = new URL(url).host) => {
      const response = await unstable_getResponseFromNextConfig({ url, nextConfig, headers: { host } });
      return isRewrite(response) ? getRewrittenUrl(response) : null;
    };
    expect(await served(`${LEAGUE}/`)).toBe(`${LEAGUE}/league`);
    expect(await served(`${LEAGUE}/daftar?dari=ig`)).toBe(`${LEAGUE}/league/daftar?dari=ig`);
    // Behind `next start` on 127.0.0.1 the request URL is the server's own; the Host header decides.
    expect(await served("http://127.0.0.1:3104/daftar", "league.gdgocipb.com")).toBe("http://127.0.0.1:3104/league/daftar");
    for (const url of [`${LEAGUE}/league`, `${LEAGUE}/league/daftar`, `${LEAGUE}/api/auth/get-session`, `${LEAGUE}/_next/image`, `${LEAGUE}/robots.txt`, `${MAIN}/`, `${MAIN}/daftar`]) expect(await served(url), url).toBeNull();
  });

  it("sends member pages on the league host to the main host, where sign-in returns", async () => {
    const { proxy } = await load(LEAGUE);
    expect(getRedirectUrl(proxy(request(`${LEAGUE}/dashboard/tugas?id=1`)))).toBe(`${MAIN}/dashboard/tugas?id=1`);
    expect(getRedirectUrl(proxy(request(`${LEAGUE}/onboarding?next=league`)))).toBe(`${MAIN}/onboarding?next=league`);
    expect(getRedirectUrl(proxy(request(`${LEAGUE}/k/abc`)))).toBe(`${MAIN}/k/abc`);
    expect(getRedirectUrl(proxy(request(`${LEAGUE}/league/daftar`)))).toBe(`${LEAGUE}/daftar`);
    const page = proxy(request(`${LEAGUE}/kategori`));
    expect(isRewrite(page)).toBe(false);
    expect(getRedirectUrl(page)).toBeNull();
  });

  it("keeps /league off the main host and moves the old page with a 301", async () => {
    const { proxy } = await load(LEAGUE);
    const league = proxy(request(`${MAIN}/league/daftar?x=1`));
    expect(league.status).toBe(308);
    expect(getRedirectUrl(league)).toBe(`${LEAGUE}/daftar?x=1`);
    expect(getRedirectUrl(proxy(request(`${MAIN}/league`)))).toBe(`${LEAGUE}/`);
    const old = proxy(request(`${MAIN}/program/tech-league`));
    expect(old.status).toBe(301);
    expect(getRedirectUrl(old)).toBe(`${LEAGUE}/`);
    const landing = proxy(request(`${MAIN}/program`));
    expect(isRewrite(landing)).toBe(false);
    expect(getRedirectUrl(landing)).toBeNull();
  });

  it("does nothing when the league has no host", async () => {
    const { proxy, nextConfig } = await load();
    expect(await (nextConfig.rewrites as () => Promise<unknown>)()).toEqual([]);
    for (const url of [`${MAIN}/league`, `${MAIN}/program/tech-league`, `${LEAGUE}/`]) {
      const response = proxy(request(url));
      expect(isRewrite(response)).toBe(false);
      expect(getRedirectUrl(response)).toBeNull();
    }
  });

  it("runs on pages but not on the auth API, Next's files or static files", async () => {
    const { config } = await load(LEAGUE);
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    for (const url of ["/", "/daftar", "/program/tech-league", "/league/daftar", "/dashboard"]) expect(matches(url), url).toBe(true);
    for (const url of ["/api/auth/get-session", "/_next/static/chunks/a.js", "/robots.txt", "/sitemap.xml", "/icon.svg", "/brand/og-image.jpg"]) expect(matches(url), url).toBe(false);
  });
});
