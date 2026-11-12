/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { components, internal } from "./_generated/api";
import schema from "./schema";
import { TOKEN_SECONDS } from "./auth";

const modules = import.meta.glob("./**/*.ts");
const site = "https://example-123.convex.site";

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type T = ReturnType<typeof setup>;

/** A signed-in member's session token, for the Bearer header the convex plugin accepts. */
async function sessionToken(t: T) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: "Teman Uji", email: "teman@example.com", emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const token = crypto.randomUUID();
  await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token, expiresAt: Date.now() + 3600000, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  return token;
}

const part = (jwt: string, index: number) => JSON.parse(atob(jwt.split(".")[index].replace(/-/g, "+").replace(/_/g, "/")));
const keyId = (jwt: string) => part(jwt, 0).kid as string;

async function convexToken(t: T, token: string) {
  const response = await t.fetch("/api/auth/convex/token", { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

const keyRows = (t: T) => t.query(components.betterAuth.adapter.findMany, { model: "jwks", paginationOpts: { cursor: null, numItems: 10 } });

beforeEach(() => {
  vi.stubEnv("SITE_URL", "http://localhost:3104");
  vi.stubEnv("CONVEX_SITE_URL", site);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-that-is-long-enough-for-better-auth");
  vi.stubEnv("JWKS", undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("static JWKS", () => {
  it("getLatestJwks returns the key already signing tokens, and never a new one", async () => {
    const t = setup();
    const signedWith = keyId(await convexToken(t, await sessionToken(t)));
    const first = await t.action(internal.auth.getLatestJwks, {});
    const second = await t.action(internal.auth.getLatestJwks, {});
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ id: signedWith, alg: "RS256" });
    expect(second[0].id).toBe(signedWith);
    expect((await keyRows(t)).page).toHaveLength(1);
  });

  it("signs tokens with the key in JWKS without reading the key table", async () => {
    const t = setup();
    const member = await sessionToken(t);
    const latest = await t.action(internal.auth.getLatestJwks, {});
    vi.stubEnv("JWKS", JSON.stringify(latest));
    await t.mutation(components.betterAuth.adapter.deleteMany, { input: { model: "jwks", where: [] }, paginationOpts: { cursor: null, numItems: 10 } });
    expect(keyId(await convexToken(t, member))).toBe(latest[0].id);
    expect((await keyRows(t)).page).toHaveLength(0);
    const served = await (await t.fetch("/api/auth/convex/jwks")).json() as { keys: { kid: string }[] };
    expect(served.keys.map((key) => key.kid)).toEqual([latest[0].id]);
  });
});

describe("auth config", () => {
  const load = async () => (await import("./auth.config")).default.providers[0] as { jwks: string };

  it("fetches the keys from the deployment while JWKS is unset", async () => {
    expect((await load()).jwks).toBe(`${site}/api/auth/convex/jwks`);
  });

  it("checks tokens against the public key in JWKS, never the private one", async () => {
    const key = { id: "kid-1", alg: "RS256", createdAt: 1, publicKey: JSON.stringify({ kty: "RSA", n: "abc", e: "AQAB" }), privateKey: "secret" };
    vi.stubEnv("JWKS", JSON.stringify([key]));
    const { jwks } = await load();
    expect(jwks.startsWith("data:text/plain;charset=utf-8;base64,")).toBe(true);
    const decoded = JSON.parse(atob(jwks.split(",")[1]));
    expect(decoded).toEqual({ keys: [{ alg: "RS256", kty: "RSA", n: "abc", e: "AQAB", kid: "kid-1" }] });
  });

  it("falls back to fetching when reading an unset variable throws, as Convex does when checking a push", async () => {
    const env = process.env;
    process.env = new Proxy(env, {
      get(target, name) {
        if (name === "JWKS") throw new Error("Environment variable JWKS is used in auth config file but its value was not set");
        return Reflect.get(target, name);
      },
    });
    try { expect((await load()).jwks).toBe(`${site}/api/auth/convex/jwks`); }
    finally { process.env = env; }
  });
});

describe("Convex token lifetime", () => {
  it("lasts an hour, so an open tab renews it and reruns its queries a quarter as often as Better Auth's 15 minutes", async () => {
    const t = setup();
    const { iat, exp } = part(await convexToken(t, await sessionToken(t)), 1) as { iat: number; exp: number };
    expect(TOKEN_SECONDS).toBe(3600);
    expect(exp - iat).toBe(TOKEN_SECONDS);
  });
});
