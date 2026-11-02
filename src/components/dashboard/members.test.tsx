import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useEffect, useReducer } from "react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { compareMembers, matchesFilters, noFilters, pageSlice, type MemberFilters, type MemberSort } from "@/lib/member-table";
import { MembersPage } from "./members";
import { ViewerContext, type DashboardViewer } from "./viewer";

// The members page against a fake Convex: the list is cut and sorted the way `dashboard.members` does it.
type Row = { ownerId: string; fullName: string; email: string; campus: string; studyProgram: string; role: "owner" | "admin" | "member"; active: boolean; joinedAt: number; memberType: "member" | "core" | "bod" | null; division: string | null; reviewer: boolean; techSupportHandler?: boolean; tagConfirmed: boolean; reviewsByTag: boolean; card?: { number: string; revoked: boolean } | null; photo?: string | null; photoUploaded?: boolean };
const names = ["Adi", "Bima", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Indra", "Joko", "Kiki", "Lina", "Mira", "Nadia", "Oki", "Putri", "Qori", "Rania", "Sari", "Tono", "Umar", "Vina", "Wati", "Xena", "Yusuf", "Zahra", "Agus", "Bayu", "Cahya", "Dina"];
const rows: Row[] = names.map((fullName, index) => ({
  ownerId: `u${index}`, fullName, email: `${fullName.toLowerCase()}@example.com`, campus: "IPB University", studyProgram: "Ilmu Komputer",
  role: "member", active: true, joinedAt: Date.UTC(2026, 8, 1) + index * 86_400_000, memberType: "member", division: null, reviewer: false, tagConfirmed: false, reviewsByTag: false,
}));
rows[1] = { ...rows[1], memberType: "core", division: "Technical" };
rows[2] = { ...rows[2], active: false };
rows[29] = { ...rows[29], card: { number: "2627-0030", revoked: false } };
rows[28] = { ...rows[28], photo: "https://example.convex.cloud/api/storage/cahya", photoUploaded: true };

const setActive = vi.fn(async () => null);
const setCardRevoked = vi.fn(async () => null);
const setTechSupportHandler = vi.fn(async () => null);
const removePhoto = vi.fn(async () => null);
const mutations: Record<string, ReturnType<typeof vi.fn>> = { "dashboard:setActive": setActive, "cards:setRevoked": setCardRevoked, "dashboard:setTechSupportHandler": setTechSupportHandler, "photos:removeFor": removePhoto };
// Like Convex, the same arguments return the same object, so results can be compared by reference.
const results = new Map<string, unknown>();
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: Args) => {
    const key = `${getFunctionName(ref)}${JSON.stringify(args)}`;
    if (!results.has(key)) results.set(key, list(getFunctionName(ref), args));
    return results.get(key);
  },
  useMutation: (ref: FunctionReference<"mutation">) => mutations[getFunctionName(ref)] ?? vi.fn(async () => null),
  useConvex: () => ({ query: vi.fn() }),
}));
type Args = { search: string; filters: Partial<MemberFilters>; sort?: MemberSort; page: number; pageSize: number };
function list(name: string, args: Args) {
  if (name === "dashboard:stats") return { members: 30, owners: 0, admins: 0, reviewers: 0, core: 1, bod: 0, deactivated: 1, unconfirmed: 1, divisions: { Technical: 1 } };
  const filters = { ...noFilters, ...args.filters };
  const matching = rows.filter((row) => matchesFilters({ ...row, access: row.role }, filters) && row.fullName.toLowerCase().includes(args.search.toLowerCase()));
  matching.sort(compareMembers(args.sort ?? "joined-desc"));
  const slice = pageSlice(matching.length, args.page, args.pageSize);
  return { rows: matching.slice(slice.start, slice.end), total: matching.length, page: slice.page, pageSize: slice.pageSize, pageCount: slice.pageCount };
}
// Next updates `useSearchParams` after pushState and replaceState; the fake does the same with an event.
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/anggota",
  useSearchParams: () => {
    const [, rerender] = useReducer((count: number) => count + 1, 0);
    useEffect(() => { window.addEventListener("test:url", rerender); return () => window.removeEventListener("test:url", rerender); }, []);
    return new URLSearchParams(window.location.search);
  },
}));

const viewer = (role: DashboardViewer["role"]): DashboardViewer => ({ id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role, active: true, onboarded: true, reviewer: true, memberType: null, division: null, campus: "", studyProgram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false });
function show(role: DashboardViewer["role"] = "owner") {
  return render(<ViewerContext.Provider value={viewer(role)}><MembersPage /></ViewerContext.Provider>);
}
const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const search = () => window.location.search;

beforeEach(() => {
  window.history.replaceState(null, "", "/dashboard/anggota");
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((...args) => { original(...args); window.dispatchEvent(new Event("test:url")); });
  }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); setActive.mockClear(); });

describe("members table", () => {
  it("is an accessible table with numbered pages", async () => {
    const { container } = show();
    expect(bodyRows()).toHaveLength(25);
    expect(screen.getByRole("status", { name: "" }).textContent).toBe("Menampilkan 1–25 dari 30 anggota");
    const pages = screen.getByRole("navigation", { name: "Halaman anggota" });
    expect(within(pages).getByRole("button", { name: "Halaman 1" }).getAttribute("aria-current")).toBe("page");
    expect((within(pages).getByRole("button", { name: "Halaman sebelumnya" }) as HTMLButtonElement).disabled).toBe(true);
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("keeps the page, sort, filter, and page size in the URL", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Halaman berikutnya" }));
    expect(search()).toBe("?page=2");
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Halaman 2" }).getAttribute("aria-current")).toBe("page");

    await user.click(screen.getByRole("button", { name: "Anggota" }));
    expect(search()).toBe("?sort=name-asc");
    expect(screen.getByRole("columnheader", { name: "Anggota" }).getAttribute("aria-sort")).toBe("ascending");
    expect(within(bodyRows()[0]).getByRole("rowheader").textContent).toContain("Adi");

    await user.click(screen.getByRole("button", { name: /Baris per halaman/ }));
    await user.click(await screen.findByRole("option", { name: "10" }));
    expect(search()).toBe("?sort=name-asc&size=10");
    expect(screen.getByRole("button", { name: "Halaman 3" })).toBeTruthy();
  });

  it("filters in a dialog that previews the count, then shows removable chips", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Filter" }));
    const dialog = await screen.findByRole("dialog", { name: "Filter anggota" });
    // The content scrolls on its own; the page's smooth scrolling must not take the wheel.
    expect(dialog.querySelector(".dash-dialog-content")?.hasAttribute("data-lenis-prevent")).toBe(true);
    expect(within(dialog).getByRole("radiogroup", { name: /Peninjau apresiasi/ })).toBeTruthy();
    await user.click(within(dialog).getByRole("radio", { name: /Nonaktif/ }));
    expect(search()).toBe("");
    await user.click(within(dialog).getByRole("checkbox", { name: /^Core Team/ }));
    expect(within(dialog).getByRole("button", { name: "Tidak ada yang cocok" })).toBeTruthy();
    await user.click(within(dialog).getByRole("checkbox", { name: /^Core Team/ }));
    await user.click(within(dialog).getByRole("button", { name: "Tampilkan 1 anggota" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(search()).toBe("?status=deactivated");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Filter, 1 aktif" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Halaman anggota" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Hapus filter Status: Nonaktif" }));
    expect(search()).toBe("");
    expect(bodyRows()).toHaveLength(25);
  });

  it("waits for typing to stop before searching, and replaces the history entry", async () => {
    const user = userEvent.setup();
    show();
    await user.type(screen.getByLabelText("Cari nama anggota"), "rania");
    expect(search()).toBe("");
    await waitFor(() => expect(search()).toBe("?q=rania"));
    expect(window.history.pushState).not.toHaveBeenCalled();
    expect(bodyRows()).toHaveLength(1);
  });

  it("groups owner actions in a menu and asks before deactivating", async () => {
    const user = userEvent.setup();
    show("owner");
    await user.click(screen.getByRole("button", { name: "Kelola Dina" }));
    const menu = screen.getByRole("menu", { name: "Kelola Dina" });
    expect(within(within(menu).getByRole("group", { name: "Akses" })).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Jadikan admin", "Jadikan peninjau apresiasi", "Jadikan pengelola Tech Support"]);
    expect(within(within(menu).getByRole("group", { name: "Komunitas" })).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Ubah peran komunitas"]);
    await user.click(within(within(menu).getByRole("group", { name: "Status" })).getByRole("menuitem", { name: "Nonaktifkan" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Nonaktifkan?" });
    expect(dialog.textContent).toContain("Nonaktifkan Dina?");
    await user.click(within(dialog).getByRole("button", { name: "Ya, nonaktifkan" }));
    expect(setActive).toHaveBeenCalledWith({ ownerId: "u29", active: false });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("lets owners grant the Tech Support queue, after asking", async () => {
    const user = userEvent.setup();
    show("owner");
    await user.click(screen.getByRole("button", { name: "Kelola Dina" }));
    await user.click(screen.getByRole("menuitem", { name: "Jadikan pengelola Tech Support" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Jadikan Dina pengelola Tech Support?");
    await user.click(within(dialog).getByRole("button", { name: /Jadikan pengelola Tech Support|Ya/ }));
    expect(setTechSupportHandler).toHaveBeenCalledWith({ ownerId: "u29", handler: true });
  });

  it("blocks a member's card from the status group, after asking", async () => {
    const user = userEvent.setup();
    show("admin");
    await user.click(screen.getByRole("button", { name: "Kelola Dina" }));
    const status = within(screen.getByRole("menu", { name: "Kelola Dina" })).getByRole("group", { name: "Status" });
    expect(within(status).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Nonaktifkan", "Blokir kartu"]);
    await user.click(within(status).getByRole("menuitem", { name: "Blokir kartu" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Blokir kartu?" });
    expect(dialog.textContent).toContain("Akunnya tetap aktif");
    await user.click(within(dialog).getByRole("button", { name: "Ya, blokir kartu" }));
    expect(setCardRevoked).toHaveBeenCalledWith({ ownerId: "u29", revoked: true });
    // A member who has not opened their card has nothing to block.
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Kelola Cahya" }));
    expect(within(screen.getByRole("menu", { name: "Kelola Cahya" })).queryByRole("menuitem", { name: "Blokir kartu" })).toBeNull();
  });

  it("shows a member's photo in their row and lets staff remove an uploaded one, after asking", async () => {
    const user = userEvent.setup();
    show("admin");
    const row = screen.getByRole("link", { name: "Cahya" }).closest("tr") as HTMLElement;
    expect(row.querySelector("img.account-avatar")?.getAttribute("src")).toBe("https://example.convex.cloud/api/storage/cahya");
    await user.click(screen.getByRole("button", { name: "Kelola Cahya" }));
    await user.click(screen.getByRole("menuitem", { name: "Hapus foto profil" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Hapus foto profil?" });
    expect(dialog.textContent).toContain("foto Google atau inisial");
    await user.click(within(dialog).getByRole("button", { name: "Ya, hapus foto profil" }));
    expect(removePhoto).toHaveBeenCalledWith({ ownerId: "u28" });
    // A member who never uploaded one has nothing to remove.
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Kelola Dina" }));
    expect(within(screen.getByRole("menu", { name: "Kelola Dina" })).queryByRole("menuitem", { name: "Hapus foto profil" })).toBeNull();
  });

  it("offers admins no access changes, and links every row to the member's page", async () => {
    const user = userEvent.setup();
    show("admin");
    expect(screen.getByRole("link", { name: "Lihat detail Dina" }).getAttribute("href")).toBe("/dashboard/anggota/u29");
    await user.click(screen.getByRole("button", { name: "Kelola Dina" }));
    const menu = screen.getByRole("menu", { name: "Kelola Dina" });
    expect(within(menu).queryByRole("menuitem", { name: "Jadikan admin" })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: "Nonaktifkan" })).toBeTruthy();
    await act(async () => { await user.keyboard("{Escape}"); });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
