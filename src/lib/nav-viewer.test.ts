import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedNavViewer, forgetNavViewer, loadNavViewer, navViewerFrom } from "./nav-viewer";

afterEach(() => { forgetNavViewer(); vi.unstubAllGlobals(); });

describe("public header viewer", () => {
  it("reads a first name and initial from the session, and nothing for a guest", () => {
    expect(navViewerFrom(null)).toBeNull();
    expect(navViewerFrom({ session: null })).toBeNull();
    expect(navViewerFrom({ user: { name: "Aldio Lisafron" } })).toEqual({ firstName: "Aldio", initial: "A" });
    expect(navViewerFrom({ user: { name: "  M. Rizky   Pratama " } })).toEqual({ firstName: "Rizky", initial: "R" });
    expect(navViewerFrom({ user: { name: "ilham" } })).toEqual({ firstName: "ilham", initial: "I" });
    expect(navViewerFrom({ user: { name: "" } })).toEqual({ firstName: "Kamu", initial: "K" });
    expect(navViewerFrom({ user: { name: "Muhammadiyahabdurrahman Yusuf" } })?.firstName).toHaveLength(14);
    expect(navViewerFrom({ user: { name: "\u202eÉmile Zola" } })).toEqual({ firstName: "Émile", initial: "É" });
  });

  it("asks the same-origin session endpoint once a minute and forgets on sign-out", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ session: { id: "s" }, user: { name: "Aldio Lisafron" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(cachedNavViewer()).toBeUndefined();
    expect(await loadNavViewer()).toEqual({ firstName: "Aldio", initial: "A" });
    expect(fetch).toHaveBeenCalledWith("/api/auth/get-session", expect.objectContaining({ credentials: "same-origin" }));
    expect(cachedNavViewer()).toEqual({ firstName: "Aldio", initial: "A" });
    expect(cachedNavViewer(Date.now() + 61_000)).toBeUndefined();
    forgetNavViewer();
    expect(cachedNavViewer()).toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("null", { status: 200 })));
    expect(await loadNavViewer()).toBeNull();
    expect(cachedNavViewer()).toBeNull(); // a known guest, not unknown
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    forgetNavViewer();
    await expect(loadNavViewer()).rejects.toThrow("500");
    expect(cachedNavViewer()).toBeUndefined();
  });
});
