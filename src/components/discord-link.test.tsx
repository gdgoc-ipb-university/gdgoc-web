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
  // Read at call time, so a test can change what the next press does.
  useMutation: (mutation: FunctionReference<"mutation">) => (...args: unknown[]) => (getFunctionName(mutation) === "discord:unlink" ? mocks.unlink : mocks.retry)(...args),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { linkSocial: (...args: unknown[]) => mocks.linkSocial(...args) } }));

const serverUrl = "https://discord.com/channels/900000000000000001";
const linkedAt = Date.UTC(2026, 10, 12, 3);
const link = (overrides: object = {}) => ({ username: "temanuji", linkedAt, joinStatus: "joined", lastSyncedAt: linkedAt, lastError: null, ...overrides });
const set = (state: unknown) => { mocks.state = state; };
const panel = () => { render(<DiscordPanel />); return screen.getByRole("region", { name: "Discord" }); };
const noPermission = "Bot GDGoC IPB belum punya izin menambahkan member. Pengurus perlu memeriksanya.";
/** Back from Discord's consent page, as Better Auth sends the member. */
const backFromDiscord = (path = "/dashboard/profil") => window.history.replaceState(null, "", `${path}?discord=terhubung`);

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
    set({ configured: true, serverUrl, link: link({ joinStatus: "failed", lastError: noPermission }) });
    const user = userEvent.setup();
    const section = panel();
    expect(within(section).getByText("Belum masuk server")).toBeTruthy();
    expect(within(section).getByText(/Bot GDGoC IPB belum punya izin/)).toBeTruthy();
    expect(within(section).queryByRole("link", { name: /Buka server/ })).toBeNull();
    await user.click(within(section).getByRole("button", { name: "Coba lagi" }));
    expect(mocks.retry).toHaveBeenCalledWith({});
  });
});

describe("The notice after connecting follows the join status (#261)", () => {
  it.each([
    ["pending", {}, "Discord terhubung. Kami sedang menambahkanmu ke server GDGoC IPB."],
    ["pending, waiting on Discord", { lastError: "Discord sedang sibuk. Kami mencoba lagi otomatis." }, "Discord terhubung. Discord sedang sibuk. Kami mencoba lagi otomatis."],
    // Discord answers "already a member" the same way, so someone who was in the server before linking reads this too.
    ["joined", { joinStatus: "joined" }, "Discord terhubung. Kamu sudah di server GDGoC IPB."],
  ])("says how the join stands when it is %s", async (_status, overrides, text) => {
    set({ configured: true, serverUrl, link: link({ joinStatus: "pending", lastSyncedAt: null, ...overrides }) });
    backFromDiscord();
    const section = panel();
    expect((await within(section).findByRole("status")).textContent).toBe(text);
    expect(window.location.search).toBe("");
  });

  it("gives the reason once when the join failed, beside Coba lagi", async () => {
    set({ configured: true, serverUrl, link: link({ joinStatus: "failed", lastError: noPermission }) });
    backFromDiscord();
    const section = panel();
    expect((await within(section).findByRole("alert")).textContent).toBe(`Discord terhubung, tapi kamu belum masuk server GDGoC IPB. ${noPermission}`);
    expect(within(section).getAllByText(/belum punya izin/)).toHaveLength(1);
    expect(within(section).getByText("Belum masuk server")).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("moves from being added to in the server while the page stays open", async () => {
    set({ configured: true, serverUrl, link: link({ joinStatus: "pending", lastSyncedAt: null }) });
    backFromDiscord();
    const { rerender } = render(<DiscordPanel />);
    const section = screen.getByRole("region", { name: "Discord" });
    expect((await within(section).findByRole("status")).textContent).toBe("Discord terhubung. Kami sedang menambahkanmu ke server GDGoC IPB.");
    expect(within(section).getByText("Sedang masuk server")).toBeTruthy();

    set({ configured: true, serverUrl, link: link() });
    rerender(<DiscordPanel />);
    expect(within(section).getByRole("status").textContent).toBe("Discord terhubung. Kamu sudah di server GDGoC IPB.");
    expect(within(section).getByText("Sudah di server")).toBeTruthy();
    expect(within(section).getByRole("link", { name: /Buka server/ })).toHaveProperty("href", serverUrl);
    expect(within(section).queryByText(/sedang menambahkanmu/)).toBeNull();
  });

  it("turns into an alert with the reason when the join fails while the page is open", async () => {
    set({ configured: true, serverUrl, link: link({ joinStatus: "pending", lastSyncedAt: null }) });
    backFromDiscord();
    const { rerender } = render(<DiscordPanel />);
    const section = screen.getByRole("region", { name: "Discord" });
    await within(section).findByRole("status");

    set({ configured: true, serverUrl, link: link({ joinStatus: "failed", lastSyncedAt: null, lastError: noPermission }) });
    rerender(<DiscordPanel />);
    expect(within(section).getByRole("alert").textContent).toBe(`Discord terhubung, tapi kamu belum masuk server GDGoC IPB. ${noPermission}`);
    expect(within(section).queryByText(/sedang menambahkanmu/)).toBeNull();
  });

  it("after Coba lagi, says it is trying, then where the join ended", async () => {
    set({ configured: true, serverUrl, link: link({ joinStatus: "failed", lastSyncedAt: null, lastError: noPermission }) });
    // Convex shows the mutation's write before its promise resolves.
    mocks.retry = vi.fn(async () => { set({ configured: true, serverUrl, link: link({ joinStatus: "pending", lastSyncedAt: null }) }); return null; });
    const user = userEvent.setup();
    const { rerender } = render(<DiscordPanel />);
    const section = screen.getByRole("region", { name: "Discord" });
    await user.click(within(section).getByRole("button", { name: "Coba lagi" }));
    expect(within(section).getByRole("status").textContent).toBe("Kami mencoba lagi menambahkanmu ke server GDGoC IPB.");

    set({ configured: true, serverUrl, link: link({ joinStatus: "failed", lastSyncedAt: null, lastError: noPermission }) });
    rerender(<DiscordPanel />);
    expect(within(section).getByRole("alert").textContent).toBe(`Kamu masih belum masuk server GDGoC IPB. ${noPermission}`);

    mocks.retry = vi.fn(async () => { set({ configured: true, serverUrl, link: link() }); return null; });
    await user.click(within(section).getByRole("button", { name: "Coba lagi" }));
    expect(within(section).getByRole("status").textContent).toBe("Kamu sudah di server GDGoC IPB.");
    expect(within(section).queryByRole("alert")).toBeNull();
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

  it("follows the join from the same screen after Discord sends the member back", async () => {
    set({ configured: true, serverUrl, link: link({ joinStatus: "pending", lastSyncedAt: null }) });
    backFromDiscord("/onboarding");
    const { rerender } = render(<DiscordOnboardingCard />);
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(screen.getByRole("status").textContent).toBe("Terhubung sebagai temanuji. Sedang menambahkanmu ke server GDGoC IPB…");

    set({ configured: true, serverUrl, link: link() });
    rerender(<DiscordOnboardingCard />);
    expect(screen.getByRole("status").textContent).toBe("Terhubung sebagai temanuji. Kamu sudah di server GDGoC IPB.");
    expect(screen.getByRole("link", { name: /Buka server/ })).toBeTruthy();
    expect(screen.queryAllByRole("status")).toHaveLength(1);
  });

  it("gives the reason and Coba lagi when the join failed, as Profil does", async () => {
    set({ configured: true, serverUrl, link: link({ joinStatus: "failed", lastSyncedAt: null, lastError: noPermission }) });
    mocks.retry = vi.fn(async () => { set({ configured: true, serverUrl, link: link({ joinStatus: "pending", lastSyncedAt: null }) }); return null; });
    backFromDiscord("/onboarding");
    const user = userEvent.setup();
    render(<DiscordOnboardingCard />);
    const line = screen.getByRole("status");
    expect(line.textContent).toBe(`Terhubung sebagai temanuji. ${noPermission}`);
    expect(line.dataset.status).toBe("failed");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("link", { name: /Buka server/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Coba lagi/ }));
    expect(mocks.retry).toHaveBeenCalledWith({});
    expect(screen.getByRole("status").textContent).toBe("Terhubung sebagai temanuji. Sedang menambahkanmu ke server GDGoC IPB…");
    expect(screen.queryByRole("button", { name: /Coba lagi/ })).toBeNull();
  });

  it("shows the linked account and the server once joined", () => {
    set({ configured: true, serverUrl, link: link() });
    render(<DiscordOnboardingCard />);
    expect(screen.getByRole("status").textContent).toBe("Terhubung sebagai temanuji. Kamu sudah di server GDGoC IPB.");
    expect(screen.getByRole("link", { name: /Buka server/ })).toHaveProperty("href", serverUrl);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
