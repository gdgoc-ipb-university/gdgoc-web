import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it } from "vitest";
import { rateLimit, SESSION_READS } from "./auth";

const base = "http://localhost:3104";
type Row = Record<string, unknown>;

/** Better Auth with the site's rate limit over an in-memory database. Email sign-in stands in for Google here. */
function setup() {
  const db: Record<string, Row[]> = { user: [], session: [], account: [], verification: [], rateLimit: [] };
  const auth = betterAuth({
    baseURL: base, secret: "test-secret-that-is-long-enough-for-better-auth", database: memoryAdapter(db),
    emailAndPassword: { enabled: true }, rateLimit,
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
