import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { DashboardShell } from "./shell";
import type { DashboardViewer } from "./viewer";

// An owner with every Kelola permission, the longest sidebar there is.
const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role: "owner", active: true, onboarded: true, reviewer: true, memberType: "core", division: "Technical", campus: "", studyProgram: "", doorHelper: true, photo: null, photoUploaded: false, techSupportHandler: true };

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => viewer,
  useMutation: () => vi.fn(async () => null),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/profil", useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("../brand-logo", () => ({ BrandLogo: () => <span>GDGoC IPB</span> }));

afterEach(cleanup);

describe("dashboard sidebar", () => {
  it("lets the nav scroll past Lenis and keeps the account block outside it", () => {
    render(<DashboardShell><h1>Profil</h1></DashboardShell>);
    const sidebar = screen.getByRole("complementary", { name: "Dashboard" });
    const nav = within(sidebar).getByRole("navigation", { name: "Navigasi dashboard" });
    // Lenis leaves wheel events to the browser inside an element marked data-lenis-prevent.
    expect(nav.closest("[data-lenis-prevent]")).toBe(sidebar);
    expect(within(nav).getAllByRole("link")).toHaveLength(12);
    const signOut = within(sidebar).getByRole("button", { name: "Keluar" });
    expect(nav.contains(signOut)).toBe(false);
    expect(nav.contains(within(sidebar).getByRole("link", { name: "Ke beranda situs" }))).toBe(false);
    expect(nav.contains(within(sidebar).getByText("me@example.com"))).toBe(false);
  });
});
