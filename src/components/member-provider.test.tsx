import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemberProvider } from "./member-provider";

/** The provider's auth state, as Convex's provider would see it. */
vi.mock("convex/react", () => ({
  ConvexReactClient: class {},
  ConvexProviderWithAuth: ({ children, useAuth }: { children: ReactNode; useAuth: () => { isLoading: boolean; isAuthenticated: boolean } }) => {
    const auth = useAuth();
    return <div data-testid="auth">{auth.isLoading ? "loading" : auth.isAuthenticated ? "signed in" : "guest"}{children}</div>;
  },
}));

/** Better Auth's client keeps the fetch it finds when it loads, so the stub goes in first. */
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn(async (_input: RequestInfo | URL) => Response.json({
    session: { id: "session-1", userId: "user-1", token: "t", expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    user: { id: "user-1", name: "Teman Uji", email: "teman@example.com" },
  }));
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
});
const sessionChecks = () => fetchMock.mock.calls.filter(([input]) => String(input instanceof Request ? input.url : input).includes("/get-session")).length;
const showTab = () => act(() => {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  fetchMock.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("MemberProvider session checks", () => {
  // The client's session store lives for the whole module, as it does for a page, so this is one page's life in order.
  it("reads the session when the page loads and when another tab signs out, not each time the tab comes back", async () => {
    render(<MemberProvider><p>Dashboard</p></MemberProvider>);
    await waitFor(() => expect(screen.getByTestId("auth").textContent).toContain("signed in"));
    expect(sessionChecks()).toBe(1);

    for (let i = 0; i < 3; i++) { vi.setSystemTime(Date.now() + 60_000); await showTab(); }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sessionChecks()).toBe(1);

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "better-auth.message", newValue: JSON.stringify({ event: "session", data: { trigger: "signout" }, clientId: "other", timestamp: Date.now() }),
      }));
    });
    await waitFor(() => expect(sessionChecks()).toBe(2));
  });
});
