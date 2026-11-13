import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getIp } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { CLIENT_IP_HEADER, clientIp, withClientIp } from "./client-ip";
import { networkOptions } from "../../convex/auth";

const SITE = "https://www.gdgocipb.com";
const CONVEX_SITE = "https://convex-site.example.test";
const CLOUDFLARE_EDGE = "172.70.1.1";

describe("client IP for the auth route", () => {
  it("prefers cf-connecting-ip, then x-real-ip, then the first x-forwarded-for entry", () => {
    const all = { "cf-connecting-ip": "203.0.113.7", "x-real-ip": "198.51.100.4", "x-forwarded-for": "192.0.2.9, 10.0.0.1" };
    expect(clientIp(new Headers(all))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ ...all, "cf-connecting-ip": "" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers({ "x-forwarded-for": " 192.0.2.9 , 10.0.0.1" }))).toBe("192.0.2.9");
    expect(clientIp(new Headers({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(new Headers())).toBeNull();
  });

  it("always replaces a client-sent header, and removes it when no IP is known", async () => {
    const spoofed = await withClientIp(new Request(SITE, { headers: { [CLIENT_IP_HEADER]: "1.1.1.1", "cf-connecting-ip": "203.0.113.7" } }));
    expect(spoofed.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    const unknown = await withClientIp(new Request(SITE, { headers: { [CLIENT_IP_HEADER]: "1.1.1.1" } }));
    expect(unknown.headers.has(CLIENT_IP_HEADER)).toBe(false);
  });

  /**
   * A request like the one Next's production server hands the route: it passes `instanceof Request`, but this realm's
   * Request constructor didn't build it, so `new Request(it, …)` throws (#297). Only its public members work.
   */
  function foreignRequest(url: string, init: { method: string; headers: Record<string, string>; body?: string }) {
    const inner = new Request(url, init);
    return Object.create(Request.prototype, {
      url: { value: inner.url }, method: { value: inner.method }, headers: { value: inner.headers },
      arrayBuffer: { value: () => inner.arrayBuffer() },
    }) as Request;
  }

  it("forwards a request that this realm's Request constructor can't copy", async () => {
    const headers = { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", [CLIENT_IP_HEADER]: "1.1.1.1" };
    const post = foreignRequest(`${SITE}/api/auth/sign-in/social`, { method: "POST", headers, body: '{"provider":"google"}' });
    expect(() => new Request(post, {})).toThrow();
    const forwarded = await withClientIp(post);
    expect(forwarded.method).toBe("POST");
    expect(forwarded.url).toBe(`${SITE}/api/auth/sign-in/social`);
    expect(forwarded.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    expect(await forwarded.text()).toBe('{"provider":"google"}');
    const get = await withClientIp(foreignRequest(`${SITE}/api/auth/get-session`, { method: "GET", headers: { "x-real-ip": "198.51.100.4" } }));
    expect(get.method).toBe("GET");
    expect(get.headers.get(CLIENT_IP_HEADER)).toBe("198.51.100.4");
    expect(get.body).toBeNull();
  });

  it("keeps the method, URL, other headers and a streamed body", async () => {
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"provider":'));
      controller.enqueue(new TextEncoder().encode('"google"}'));
      controller.close();
    } });
    const original = new Request(`${SITE}/api/auth/sign-in/social?x=1`, {
      method: "POST", body, duplex: "half", headers: { "content-type": "application/json", cookie: "a=1", "cf-connecting-ip": "203.0.113.7" },
    } as RequestInit);
    const forwarded = await withClientIp(original);
    expect(forwarded.method).toBe("POST");
    expect(forwarded.url).toBe(`${SITE}/api/auth/sign-in/social?x=1`);
    expect(forwarded.headers.get("cookie")).toBe("a=1");
    expect(forwarded.headers.get("content-type")).toBe("application/json");
    expect(await forwarded.text()).toBe('{"provider":"google"}');
  });
});

describe("auth route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function forward(method: "GET" | "POST", init: { body?: string; headers: Record<string, string> }) {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://convex.example.test");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", CONVEX_SITE);
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const route = await import("../app/api/auth/[...all]/route");
    const { NextRequest } = await import("next/server");
    const response = await route[method](new NextRequest(`${SITE}/api/auth/sign-in/social`, { method, ...init }));
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, sent] = fetch.mock.calls[0];
    return { url, sent, headers: new Headers(sent.headers) };
  }

  it("forwards the visitor's IP and the POST body to Convex", async () => {
    const { url, sent, headers } = await forward("POST", {
      body: JSON.stringify({ provider: "google", callbackURL: "/dashboard" }),
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "203.0.113.7", [CLIENT_IP_HEADER]: "1.1.1.1" },
    });
    expect(url).toBe(`${CONVEX_SITE}/api/auth/sign-in/social`);
    expect(sent.method).toBe("POST");
    expect(headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    expect(headers.get("content-type")).toBe("application/json");
    expect(new TextDecoder().decode(sent.body as ArrayBuffer)).toBe('{"provider":"google","callbackURL":"/dashboard"}');
  });

  it("forwards the visitor's IP on GET", async () => {
    const { sent, headers } = await forward("GET", { headers: { "x-real-ip": "198.51.100.4", cookie: "a=1" } });
    expect(sent.method).toBe("GET");
    expect(sent.body).toBeUndefined();
    expect(headers.get(CLIENT_IP_HEADER)).toBe("198.51.100.4");
    expect(headers.get("cookie")).toBe("a=1");
  });
});

describe("Better Auth rate limiting behind two proxies", () => {
  const options = networkOptions({ SITE_URL: SITE, AUTH_COOKIE_DOMAIN: "gdgocipb.com" });

  /** What Convex receives once the second Cloudflare hop has appended to x-forwarded-for. */
  function arriving(ip: string, withHeader: boolean) {
    return new Headers({ "x-forwarded-for": `${ip}, ${CLOUDFLARE_EDGE}`, ...(withHeader ? { [CLIENT_IP_HEADER]: ip } : {}) });
  }

  it("resolves the client IP from our header, and falls back to a single x-forwarded-for", () => {
    expect(getIp(arriving("203.0.113.7", true), options)).toBe("203.0.113.7");
    expect(getIp(arriving("198.51.100.4", true), options)).toBe("198.51.100.4");
    expect(getIp(new Headers({ "x-forwarded-for": "192.0.2.9" }), options)).toBe("192.0.2.9");
  });

  function auth(extra: object) {
    return betterAuth({
      baseURL: SITE, secret: "test-secret-that-is-at-least-32-characters", database: memoryAdapter({}),
      rateLimit: { enabled: true, storage: "memory", window: 60, max: 60 }, ...extra,
    });
  }

  async function signIn(instance: ReturnType<typeof auth>, headers: Headers) {
    headers.set("content-type", "application/json");
    headers.set("origin", SITE);
    const response = await instance.handler(new Request(`${SITE}/api/auth/sign-in/social`, {
      method: "POST", headers, body: JSON.stringify({ provider: "google" }),
    }));
    return response.status;
  }

  // First, while the in-memory limiter is empty: without a trusted IP, tests key on the localhost fallback and production
  // on `no-trusted-ip`, one bucket either way.
  it("pooled every visitor into one bucket without them", async () => {
    const instance = auth({ trustedOrigins: [SITE] });
    for (let attempt = 0; attempt < 3; attempt++) expect(await signIn(instance, arriving("203.0.113.20", false))).not.toBe(429);
    expect(await signIn(instance, arriving("203.0.113.21", false))).toBe(429);
  });

  it("gives two visitors separate sign-in buckets with our options", async () => {
    const instance = auth(options);
    for (let attempt = 0; attempt < 3; attempt++) expect(await signIn(instance, arriving("203.0.113.10", true))).not.toBe(429);
    expect(await signIn(instance, arriving("203.0.113.10", true))).toBe(429);
    expect(await signIn(instance, arriving("203.0.113.11", true))).not.toBe(429);
  });
});
