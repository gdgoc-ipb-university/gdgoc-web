import { describe, expect, it } from "vitest";
import { bearerKey, botRateLimit, keyMatches, programEvents, programViews, requestsAvailable, siteLinks } from "./bot-api";
import { catalyst } from "./catalyst";
import { programs } from "./programs";
import { techLeague } from "./tech-league";

describe("the key", () => {
  it("reads only a bearer token", () => {
    expect(bearerKey("Bearer abc123")).toBe("abc123");
    expect(bearerKey("bearer abc123 ")).toBe("abc123");
    expect(bearerKey(null)).toBe("");
    expect(bearerKey("Basic abc123")).toBe("");
    expect(bearerKey("Bearer ")).toBe("");
    expect(bearerKey("Bearer abc 123")).toBe("");
  });

  it("matches only the exact key, whatever the lengths", async () => {
    expect(await keyMatches("k-0123456789", "k-0123456789")).toBe(true);
    expect(await keyMatches("k-012345678", "k-0123456789")).toBe(false);
    expect(await keyMatches("k-01234567890", "k-0123456789")).toBe(false);
    expect(await keyMatches("K-0123456789", "k-0123456789")).toBe(false);
    expect(await keyMatches("", "k-0123456789")).toBe(false);
  });
});

describe("the rate limit", () => {
  const now = 1_800_000_000_000;

  it("starts full and refills one request a second, up to the burst", () => {
    expect(requestsAvailable(null, now)).toBe(botRateLimit.requests);
    expect(requestsAvailable({ tokens: 0, tokensAt: now - 2_500 }, now)).toBe(2.5);
    expect(requestsAvailable({ tokens: 59, tokensAt: now - 10_000 }, now)).toBe(botRateLimit.requests);
    expect(requestsAvailable({ tokens: 3, tokensAt: now + 1_000 }, now)).toBe(3);
  });
});

describe("links", () => {
  it("follow SITE_URL and LEAGUE_URL, falling back to production", () => {
    const staging = siteLinks({ SITE_URL: "https://staging.example/", LEAGUE_URL: "https://league.staging.example" });
    expect(staging.page("/dashboard/tugas/a")).toBe("https://staging.example/dashboard/tugas/a");
    expect(staging.program("catalyst")).toBe(`https://staging.example${catalyst.path}`);
    expect(staging.program("tech-league")).toBe("https://league.staging.example/");
    expect(staging.program("study-jam")).toBeNull();
    expect(siteLinks({ SITE_URL: "https://staging.example" }).program("tech-league")).toBe(`https://staging.example${techLeague.path}`);
    expect(siteLinks({ SITE_URL: "not a url" }).page("/program")).toBe("https://www.gdgocipb.com/program");
  });
});

describe("programs", () => {
  it("are the /program list, in its order", () => {
    const views = programViews(siteLinks({ SITE_URL: "https://staging.example" }));
    expect(views.map((view) => view.id)).toEqual(programs.map((program) => program.id));
    expect(views[0]).toEqual({ id: "catalyst", name: "GDGoC Catalyst", description: programs[0].audience, schedule: programs[0].schedule, url: "https://staging.example/program/catalyst" });
  });
});

describe("events", () => {
  it("are Tech League's full timeline while Catalyst's schedule is on hold", () => {
    const events = programEvents(true);
    expect(events).toHaveLength(techLeague.timeline.length);
    expect(events.every((event) => event.program === "tech-league")).toBe(true);
    expect(events[0]).toEqual({
      id: "tech-league/registrasi-gelombang-awal", program: "tech-league", title: "Registrasi gelombang awal", phase: "Registrasi", note: null,
      start: "2026-12-07", end: "2026-12-09", startsAt: Date.parse("2026-12-07T00:00:00+07:00"), endsAt: Date.parse("2026-12-10T00:00:00+07:00"),
    });
    expect(events.find((event) => event.id === "tech-league/final-daring")).toMatchObject({ end: "2027-01-17", note: "Minggu, tiga cabang bersamaan." });
  });

  it("add Catalyst's timeline once its schedule is set, each id unique", () => {
    const events = programEvents(false);
    expect(events.filter((event) => event.program === "catalyst").map((event) => event.id)).toEqual([
      "catalyst/pendaftaran-oprec", "catalyst/pengumuman-peserta", "catalyst/sembilan-sesi-daring-setiap-hari-minggu", "catalyst/showcase-dan-awarding-capstone",
    ]);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
  });
});
