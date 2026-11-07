import { afterEach, describe, expect, it, vi } from "vitest";

const LEAGUE = "https://league.gdgocipb.com";
const MAIN = "https://www.gdgocipb.com";

/** Each module as built with the given league URL; NEXT_PUBLIC_* values are read once at import. */
async function load(leagueUrl?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", MAIN);
  vi.stubEnv("NEXT_PUBLIC_LEAGUE_URL", leagueUrl ?? "");
  const [league, techLeague, sitemap, breadcrumb] = await Promise.all([import("./league"), import("./tech-league"), import("../app/sitemap"), import("./breadcrumb")]);
  return { ...league, ...techLeague, sitemap: sitemap.default, ...breadcrumb };
}

afterEach(() => { vi.unstubAllEnvs(); });

describe("Tech League on its own host", () => {
  it("moves the competition's URL, JSON-LD and sitemap entry to the league root", async () => {
    const { techLeague, techLeagueJsonLd, sitemap, leagueHref, mainHref } = await load(`${LEAGUE}/`);
    expect(techLeague).toMatchObject({ href: `${LEAGUE}/`, url: `${LEAGUE}/`, path: "/program/tech-league" });
    const event = techLeagueJsonLd();
    expect(event).toMatchObject({ "@id": `${LEAGUE}/#event`, url: `${LEAGUE}/`, location: { url: `${LEAGUE}/` } });
    expect(event.organizer.url).toBe(`${MAIN}/`);
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain(`${LEAGUE}/`);
    expect(urls).not.toContain(`${MAIN}/program/tech-league`);
    expect(leagueHref("/daftar")).toBe(`${LEAGUE}/daftar`);
    expect(mainHref("/dashboard")).toBe(`${MAIN}/dashboard`);
  });

  it("ends the breadcrumb on the league's own URL", async () => {
    const { breadcrumbJsonLd, techLeague } = await load(LEAGUE);
    expect(breadcrumbJsonLd([{ name: "Program", path: "/program" }, { name: "Tech League", path: techLeague.url }]).itemListElement.map((item) => item.item))
      .toEqual([MAIN, `${MAIN}/program`, `${LEAGUE}/`]);
  });

  it("keeps the old page and previews the league under /league without a host", async () => {
    const { techLeague, techLeagueJsonLd, sitemap, leagueHref, mainHref, leagueUrl } = await load();
    expect(leagueUrl).toBeNull();
    expect(techLeague).toMatchObject({ href: "/program/tech-league", url: `${MAIN}/program/tech-league` });
    expect(techLeagueJsonLd().url).toBe(`${MAIN}/program/tech-league`);
    expect(sitemap().map((entry) => entry.url)).toContain(`${MAIN}/program/tech-league`);
    expect([leagueHref(), leagueHref("/daftar"), mainHref("/dashboard")]).toEqual(["/league", "/league/daftar", "/dashboard"]);
  });
});
