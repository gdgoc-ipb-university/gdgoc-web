import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { DiscordOnboardingCard } from "./discord-link";
import { DiscordPanel } from "./dashboard/discord-panel";

const mocks = vi.hoisted(() => ({ state: undefined as unknown, unlink: vi.fn(), retry: vi.fn(), linkSocial: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (query: FunctionReference<"query">) => getFunctionName(query) === "discord:mine" ? mocks.state : undefined,
  useMutation: (mutation: FunctionReference<"mutation">) => getFunctionName(mutation) === "discord:unlink" ? mocks.unlink : mocks.retry,
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { linkSocial: (...args: unknown[]) => mocks.linkSocial(...args) } }));

const serverUrl = "https://discord.com/channels/900000000000000001";
const linkedAt = Date.UTC(2026, 10, 12, 3);
const link = (overrides: object = {}) => ({ username: "temanuji", linkedAt, joinStatus: "joined", lastSyncedAt: linkedAt, lastError: null, ...overrides });
const set = (state: unknown) => { mocks.state = state; };
const panel = () => { render(<DiscordPanel />); return screen.getByRole("region", { name: "Discord" }); };

beforeEach(() => {
  mocks.unlink = vi.fn(async () => null);
  mocks.retry = vi.fn(async () => null);
  mocks.linkSocial = vi.fn(async () => ({ data: { url: "https://discord.com/oauth2/authorize", redirect: true }, error: null }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  window.history.replaceState(null, "", "/dashboard/profil");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Discord on Profil", () => {
  it("says Discord isn't set up yet, with nothing to press", () => {
    set({ configured: false, serverUrl: null, link: null });
    const section = panel();
    expect(within(section).getByRole("status").textContent).toContain("Discord belum disiapkan pengurus");
    expect(within(section).queryByRole("button")).toBeNull();
  });

  it("connects through Better Auth's linkSocial and returns to Profil", async () => {
    set({ configured: true, serverUrl, link: null });
    window.history.replaceState(null, "", "/dashboard/profil?tab=1");
    const user = userEvent.setup();
    const section = panel();
    expect(within(section).getByText(/tanpa email/)).toBeTruthy();
    await user.click(within(section).getByRole("button", { name: "Hubungkan Discord" }));
    expect(mocks.linkSocial).toHaveBeenCalledWith({ provider: "discord", callbackURL: "/dashboard/profil?tab=1&discord=terhubung", errorCallbackURL: "/dashboard/profil?tab=1&discord=gagal" });
    expect(within(section).getByRole("button", { name: "Membuka Discord…" })).toHaveProperty("disabled", true);
  });

  it("shows why linking was refused, in Indonesian", async () => {
    set({ configured: true, serverUrl, link: null });
    mocks.linkSocial = vi.fn(async () => ({ data: null, error: { message: "Akun ini sedang dinonaktifkan. Hubungi admin GDGoC IPB." } }));
    const user = userEvent.setup();
    const section = panel();
    await user.click(within(section).getByRole("button", { name: "Hubungkan Discord" }));
    expect(within(section).getByRole("alert").textContent).toBe("Akun ini sedang dinonaktifkan. Hubungi admin GDGoC IPB.");
    expect(within(section).getByRole("button", { name: "Hubungkan Discord" })).toHaveProperty("disabled", false);
  });

  it("explains a Discord account another member holds, then cleans the address", async () => {
    set({ configured: true, serverUrl, link: null });
    window.history.replaceState(null, "", "/dashboard/profil?discord=gagal&error=account_already_linked_to_different_user");
    const section = panel();
    expect((await within(section).findByRole("alert")).textContent).toContain("sudah terhubung ke akun member lain");
    expect(window.location.pathname + window.location.search).toBe("/dashboard/profil");
  });

  it("shows the linked account, its date and the server, then unlinks after a confirmation", async () => {
    set({ configured: true, serverUrl, link: link() });
    const user = userEvent.setup();
    const { container } = render(<DiscordPanel />);
    const section = screen.getByRole("region", { name: "Discord" });
    expect(within(section).getByText("temanuji")).toBeTruthy();
    expect(within(section).getByText("12 November 2026")).toBeTruthy();
    expect(within(section).getByText("Sudah di server")).toBeTruthy();
    expect(within(section).getByRole("link", { name: /Buka server/ })).toHaveProperty("href", serverUrl);
    const audit = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(audit.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);

    await user.click(within(section).getByRole("button", { name: "Putuskan" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("tetap di server Discord");
    expect(mocks.unlink).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Putuskan" }));
    expect(mocks.unlink).toHaveBeenCalledWith({});
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(within(section).getByRole("status").textContent).toContain("Discord diputus");
  });

  it("shows a join under way, and Discord's wait while it retries", () => {
    set({ configured: true, serverUrl, link: link({ username: null, joinStatus: "pending" }) });
    const section = panel();
    expect(within(section).getByText("Menunggu nama dari Discord…")).toBeTruthy();
    expect(within(section).getByText("Sedang masuk server")).toBeTruthy();
    expect(within(section).queryByRole("link", { name: /Buka server/ })).toBeNull();
    cleanup();
    set({ configured: true, serverUrl, link: link({ joinStatus: "pending", lastError: "Discord sedang sibuk. Kami mencoba lagi otomatis." }) });
    expect(within(panel()).getByText("Discord sedang sibuk. Kami mencoba lagi otomatis.")).toBeTruthy();
  });

  it("shows why the join failed and tries again on request", async () => {
    set({ configured: true, serverUrl, link: link({ joinStatus: "failed", lastError: "Bot GDGoC IPB belum punya izin menambahkan member. Pengurus perlu memeriksanya." }) });
    const user = userEvent.setup();
    const section = panel();
    expect(within(section).getByText("Belum masuk server")).toBeTruthy();
    expect(within(section).getByText(/Bot GDGoC IPB belum punya izin/)).toBeTruthy();
    expect(within(section).queryByRole("link", { name: /Buka server/ })).toBeNull();
    await user.click(within(section).getByRole("button", { name: "Coba lagi" }));
    expect(mocks.retry).toHaveBeenCalledWith({});
  });
});

describe("Discord on onboarding's community screen", () => {
  it("offers to connect and comes back to the same screen", async () => {
    set({ configured: true, serverUrl, link: null });
    window.history.replaceState(null, "", "/onboarding?next=league&undangan=ABCD2345");
    const user = userEvent.setup();
    render(<DiscordOnboardingCard />);
    expect(screen.getByText("Server Discord GDGoC IPB")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Hubungkan Discord/ }));
    expect(mocks.linkSocial).toHaveBeenCalledWith({ provider: "discord", callbackURL: "/onboarding?next=league&undangan=ABCD2345&discord=terhubung", errorCallbackURL: "/onboarding?next=league&undangan=ABCD2345&discord=gagal" });
  });

  it("says when Discord isn't set up, so the member can skip it", () => {
    set({ configured: false, serverUrl: null, link: null });
    render(<DiscordOnboardingCard />);
    expect(screen.getByText(/sedang disiapkan/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the linked account and the server once joined", () => {
    set({ configured: true, serverUrl, link: link() });
    render(<DiscordOnboardingCard />);
    expect(screen.getByRole("status").textContent).toBe("Terhubung sebagai temanuji. Kamu sudah di server GDGoC IPB.");
    expect(screen.getByRole("link", { name: /Buka server/ })).toHaveProperty("href", serverUrl);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
