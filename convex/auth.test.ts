import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit, SESSION_READS, sessionCache } from "./auth";

const base = "http://localhost:3104";
type Row = Record<string, unknown>;

/** Better Auth with the site's rate limit and session cache over an in-memory database. Email stands in for Google. */
function setup() {
  const db: Record<string, Row[]> = { user: [], session: [], account: [], verification: [], rateLimit: [] };
  const auth = betterAuth({
    baseURL: base, secret: "test-secret-that-is-long-enough-for-better-auth", database: memoryAdapter(db),
    emailAndPassword: { enabled: true }, rateLimit, session: sessionCache,
  });
  return { auth, db };
}

const signIn = (auth: ReturnType<typeof setup>["auth"]) => auth.handler(new Request(`${base}/api/auth/sign-in/email`, {
  method: "POST", headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ email: "teman@example.com", password: "kata-sandi-uji-123" }),
}));

describe("auth rate limit", () => {
  it("leaves the session, the Convex token and its keys out of the database limit", () => {
    expect(SESSION_READS).toEqual(["/get-session", "/convex/token", "/convex/jwks", "/convex/.well-known/openid-configuration"]);
    for (const path of SESSION_READS) expect(rateLimit.customRules[path]).toBe(false);
    expect(rateLimit).toMatchObject({ enabled: true, storage: "database", window: 60, max: 60 });
  });

  it("answers every session check without counting it, past 60 a minute", async () => {
    const { auth, db } = setup();
    const statuses: number[] = [];
    for (let i = 0; i < 70; i++) statuses.push((await auth.handler(new Request(`${base}/api/auth/get-session`))).status);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(db.rateLimit).toEqual([]);
  });

  it("still limits sign-in, counting it in the database", async () => {
    const { auth, db } = setup();
    await auth.api.signUpEmail({ body: { email: "teman@example.com", password: "kata-sandi-uji-123", name: "Teman Uji" } });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await signIn(auth)).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(db.rateLimit).toHaveLength(1);
  });
});

const cookieOf = (headers: Headers) => headers.getSetCookie().map((cookie) => cookie.split(";")[0]).filter((pair) => !pair.endsWith("=")).join("; ");
const sessionOf = async (auth: ReturnType<typeof setup>["auth"], cookie: string) =>
  (await (await auth.handler(new Request(`${base}/api/auth/get-session`, { headers: { cookie } }))).json()) as { user: { email: string } } | null;

describe("session cookie cache", () => {
  afterEach(() => vi.useRealTimers());

  it("answers session checks from the signed cookie for five minutes, then from the database again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { auth, db } = setup();
    const { headers } = await auth.api.signUpEmail({ body: { email: "teman@example.com", password: "kata-sandi-uji-123", name: "Teman Uji" }, returnHeaders: true });
    const cookie = cookieOf(headers);
    expect(cookie).toContain("better-auth.session_data=");

    db.session.length = 0; // revoked elsewhere: the cookie still answers until it is five minutes old
    expect((await sessionOf(auth, cookie))?.user.email).toBe("teman@example.com");
    vi.setSystemTime(Date.now() + 5 * 60_000 + 1_000);
    expect(await sessionOf(auth, cookie)).toBeNull();
  });
});
