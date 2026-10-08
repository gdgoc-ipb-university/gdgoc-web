// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { weekKey, weekStart } from "./leaderboard";

const convex = vi.hoisted(() => ({ mutation: vi.fn(), query: vi.fn(), setAuth: vi.fn(), clearAuth: vi.fn() }));
const auth = vi.hoisted(() => ({ getSession: vi.fn(), token: vi.fn(), social: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class { mutation = convex.mutation; query = convex.query; setAuth = convex.setAuth; clearAuth = convex.clearAuth; },
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { getSession: auth.getSession, convex: { token: auth.token }, signIn: { social: auth.social } } }));

type Online = typeof import("./online");
let online: Online;
let hidden: boolean;
let issued: number;
const MINUTE = 60_000;

beforeEach(async () => {
  vi.useFakeTimers({ now: Date.UTC(2026, 8, 30, 3) }); // a Wednesday
  vi.resetModules();
  vi.clearAllMocks();
  hidden = false; issued = 0;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  convex.mutation.mockImplementation(async () => { issued += 1; return { token: `t${issued}`, seed: issued, issuedAt: Date.now() }; });
  sessionStorage.clear();
  online = await import("./online");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("tickets", () => {
  it("drops a prefetched ticket after ten minutes when nothing renews it", async () => {
    await online.prefetchTicket();
    await vi.advanceTimersByTimeAsync(online.TICKET_TTL - 1);
    expect(online.takeTicket()).toEqual({ seed: 1, token: "t1" });
    await vi.advanceTimersByTimeAsync(online.TICKET_TTL);
    expect(online.takeTicket()).toBeNull();
  });

  it("keeps a fresh ticket ready through long runs and long looks at the board", async () => {
    const stop = online.keepTicketFresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(issued).toBe(1);
    expect(online.takeTicket()).toEqual({ seed: 1, token: "t1" }); // a run starts, and the next ticket is fetched
    await vi.advanceTimersByTimeAsync(0);
    expect(issued).toBe(2);
    await vi.advanceTimersByTimeAsync(11 * MINUTE); // an 11-minute run, or 11 minutes on the game-over board
    expect(issued).toBe(3); // renewed half a minute before it aged out
    expect(online.takeTicket()).toEqual({ seed: 3, token: "t3" });
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(issued).toBeLessThanOrEqual(10); // about one renewal every 9.5 minutes, no busy loop
    stop();
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(issued).toBeLessThanOrEqual(10);
  });

  it("fetches nothing in a hidden tab and renews as soon as it comes back", async () => {
    const stop = online.keepTicketFresh();
    await vi.advanceTimersByTimeAsync(0);
    hidden = true;
    await vi.advanceTimersByTimeAsync(30 * MINUTE);
    expect(issued).toBe(1); // the stale ticket was not renewed while hidden
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(online.ticketPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(online.ticketPending()).toBe(false);
    expect(online.takeTicket()).toEqual({ seed: 2, token: "t2" });
    stop();
  });

  it("never carries a ticket across Monday 00:00 WIB, where the week it counts for ends", async () => {
    const monday = weekStart(weekKey(Date.now())) + 7 * 24 * 60 * MINUTE;
    vi.setSystemTime(monday - 2 * MINUTE);
    const stop = online.keepTicketFresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(issued).toBe(1);
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(issued).toBe(1); // a new ticket fetched on Sunday would be no better
    await vi.advanceTimersByTimeAsync(MINUTE + 1_500);
    expect(issued).toBe(2); // renewed right after midnight
    expect(online.takeTicket()).toEqual({ seed: 2, token: "t2" });
    stop();
  });

  it("drops a Sunday ticket at midnight even without renewals", async () => {
    const monday = weekStart(weekKey(Date.now())) + 7 * 24 * 60 * MINUTE;
    vi.setSystemTime(monday - MINUTE);
    await online.prefetchTicket();
    await vi.advanceTimersByTimeAsync(MINUTE - 1);
    expect(online.takeTicket()).not.toBeNull();
    await online.prefetchTicket();
    await vi.advanceTimersByTimeAsync(2);
    expect(online.takeTicket()).toBeNull();
  });

  it("reports a ticket on its way, and keeps playing when ranking is off", async () => {
    convex.mutation.mockResolvedValue(null);
    const request = online.prefetchTicket();
    expect(online.ticketPending()).toBe(true);
    expect(await request).toBeNull();
    expect(online.ticketPending()).toBe(false);
    expect(online.takeTicket()).toBeNull();
  });

  it("asks for tickets for its engine version, and stops asking once the server runs another", async () => {
    const { ENGINE_VERSION } = await import("./engine");
    await online.prefetchTicket();
    expect(convex.mutation).toHaveBeenLastCalledWith(expect.anything(), { engine: ENGINE_VERSION });
    expect(online.isOutdated()).toBe(false);
    online.takeTicket(); // starts fetching the next one
    convex.mutation.mockResolvedValue({ outdated: true });
    await vi.advanceTimersByTimeAsync(online.TICKET_TTL);
    expect(await online.prefetchTicket()).toBeNull();
    expect(online.isOutdated()).toBe(true);
    const calls = convex.mutation.mock.calls.length;
    const stop = online.keepTicketFresh();
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    stop();
    expect(convex.mutation).toHaveBeenCalledTimes(calls);
    expect(online.takeTicket()).toBeNull();
  });
});

describe("sign-in state", () => {
  it("signs the Convex client in with a session's token, and treats no session as a guest", async () => {
    auth.getSession.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    auth.token.mockResolvedValue({ data: { token: "jwt" }, error: null });
    expect(await online.signedIn(true)).toBe(true);
    expect(convex.setAuth).toHaveBeenCalledWith("jwt");
    auth.getSession.mockResolvedValue({ data: null, error: null });
    expect(await online.signedIn(true)).toBe(false);
    expect(convex.clearAuth).toHaveBeenCalled();
    expect(auth.token).toHaveBeenCalledOnce();
  });

  it("reports a failed token request of a signed-in player as a connection problem, not as a guest", async () => {
    auth.getSession.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    auth.token.mockResolvedValue({ data: null, error: { status: 503 } });
    await expect(online.signedIn(true)).rejects.toThrow();
    const run = { seed: 1, token: "t", inputs: [], endTick: 10, score: 1 };
    await expect(online.submitRun(run)).rejects.toThrow(); // the game offers "Coba simpan lagi", not a Google round trip
    expect(convex.mutation).not.toHaveBeenCalled();
    auth.getSession.mockResolvedValue({ data: null, error: { status: 500 } });
    await expect(online.signedIn(true)).rejects.toThrow();
  });
});

describe("pending guest runs", () => {
  const run = { seed: 4, token: "t", inputs: [120, 1], endTick: 480, score: 42 };

  it("keeps a guest's run for the sign-in round trip, once, for 30 minutes", async () => {
    auth.social.mockResolvedValue({ error: { message: "offline" } });
    expect(await online.signInToSave(run)).toHaveProperty("error");
    expect(sessionStorage.getItem(online.PENDING_KEY)).toBeNull(); // a sign-in that never started keeps nothing
    sessionStorage.setItem(online.PENDING_KEY, JSON.stringify({ ...run, endedAt: Date.now() - 29 * MINUTE }));
    expect(online.takePendingRun()).toMatchObject(run);
    expect(online.takePendingRun()).toBeNull();
    sessionStorage.setItem(online.PENDING_KEY, JSON.stringify({ ...run, endedAt: Date.now() - 31 * MINUTE }));
    expect(online.takePendingRun()).toBeNull();
    for (const broken of ["{", JSON.stringify({ ...run, endedAt: Date.now(), inputs: [1.5] }), JSON.stringify({ ...run, endedAt: Date.now(), token: null })]) {
      sessionStorage.setItem(online.PENDING_KEY, broken);
      expect(online.takePendingRun()).toBeNull();
    }
  });
});
