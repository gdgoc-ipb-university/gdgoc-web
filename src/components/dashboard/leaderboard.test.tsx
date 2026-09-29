import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { Id } from "../../../convex/_generated/dataModel";
import { Leaderboard, type Board, type SetHidden } from "./leaderboard";

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));

const week = "2026-09-28";
const at = Date.UTC(2026, 8, 28, 3, 0); // Monday 10.00 WIB
type Entry = Board["entries"][number];
type HiddenEntry = Board["hiddenEntries"][number];
type Role = "owner" | "admin" | "member";
const entry = (id: string, rank: number, name: string, score: number, extra: Partial<Entry> = {}): Entry =>
  ({ id: id as Id<"gameBests">, rank, name, score, achievedAt: at, hidden: false, you: false, canHide: false, ...extra });
const hiddenEntry = (id: string, name: string, score: number, extra: Partial<HiddenEntry> = {}): HiddenEntry => ({
  id: id as Id<"gameBests">, rank: null, name, score, achievedAt: at, hidden: true, you: false,
  hiddenAt: at + 3_600_000, hiddenBy: "Aldio L.", hiddenByRole: "owner", inactive: false, canRestore: true, ...extra,
});
const board = (entries: Entry[], extra: Partial<Board> = {}): Board =>
  ({ key: week, entries, hiddenEntries: [], you: null, canModerate: false, stats: { players: entries.length, runs: entries.length * 3 }, ...extra });

const weekBoard = board([
  entry("a", 1, "Cici L.", 1204),
  entry("b", 2, "Bima S.", 812, { you: true }),
  entry("c", 2, "Rania P.", 812),
  entry("d", 4, "Dimas R.", 57),
], { you: { rank: 2, score: 812, hidden: false }, stats: { players: 187, runs: 2210 } });
const allBoard = board([entry("e", 1, "Nadia K.", 4820), entry("f", 2, "Fajar M.", 3900)], { key: "all", you: { rank: 154, score: 90, hidden: false }, stats: { players: 1432, runs: 18604 } });
// The owner's view: every row but their own can be hidden; one hidden player is kept off only by a deactivated account.
const joko = hiddenEntry("x", "Joko C.", 999999);
const wati = hiddenEntry("w", "Wati S.", 640, { hiddenAt: null, hiddenBy: null, hiddenByRole: null, inactive: true, canRestore: false });
const eko = hiddenEntry("k", "Eko P.", 300, { hiddenBy: "Sari W.", hiddenByRole: "admin", inactive: true });
const ownerBoard = board([
  entry("a", 1, "Cici L.", 1204, { canHide: true }),
  entry("b", 2, "Bima S.", 812, { you: true }),
  entry("c", 3, "Rania P.", 700, { canHide: true }),
], { canModerate: true, hiddenEntries: [joko, wati, eko], you: { rank: 2, score: 812, hidden: false } });
// An admin's view of the same board: owner and admin rows, and players an owner hid, are out of reach.
const adminBoard = board([
  entry("a", 1, "Cici L.", 1204, { canHide: true }),
  entry("b", 2, "Bima S.", 812, { you: true }),
  entry("c", 3, "Rania P.", 700),
], { canModerate: true, hiddenEntries: [{ ...joko, canRestore: false }, wati, eko] });

function show({ boards = { week: weekBoard, all: allBoard }, role = "member", onSetHidden = vi.fn<SetHidden>(async () => null) }: {
  boards?: { week: Board | undefined; all: Board | undefined }; role?: Role; onSetHidden?: SetHidden;
} = {}) {
  const view = render(<Leaderboard week={week} role={role} boards={boards} onSetHidden={onSetHidden} />);
  return { ...view, update: (next: Board) => view.rerender(<Leaderboard week={week} role={role} boards={{ week: next, all: allBoard }} onSetHidden={onSetHidden} />) };
}
const tables = () => screen.getAllByRole("table");
const rows = (table = tables()[0]) => within(table).getAllByRole("row").slice(1);
const rowOf = (name: RegExp) => screen.getByRole("rowheader", { name }).closest("tr")!;
function narrowScreen() {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 640px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}
async function audit(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Bogor Run leaderboard page", () => {
  it("has accessible tab and table semantics, with and without the moderation column", async () => {
    const { container, unmount } = show({ role: "owner", boards: { week: ownerBoard, all: allBoard } });
    expect(await audit(container)).toEqual([]);
    unmount();
    narrowScreen();
    const narrow = show({ role: "admin", boards: { week: adminBoard, all: allBoard } });
    expect(await audit(narrow.container)).toEqual([]);
  });

  it("shows this week's range, shared ranks, WIB times, and highlights your row", () => {
    show();
    expect(screen.getByRole("tab", { name: /Minggu ini/ }).textContent).toContain("28 Sep – 4 Okt");
    expect(screen.getByRole("tab", { name: /Minggu ini/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("table").querySelector("caption")?.textContent).toBe("100 besar Bogor Run minggu ini, 28 Sep – 4 Okt");
    expect(rows().map((row) => row.querySelector(".dash-rank")?.textContent)).toEqual(["1", "2", "2", "4"]);
    const mine = rowOf(/Bima S\./);
    expect(mine.getAttribute("data-you")).toBe("true");
    expect(within(mine).getByText("Kamu")).toBeTruthy();
    expect(within(rows()[0]).getByText("1.204")).toBeTruthy();
    expect([...rows()[0].querySelectorAll("time")].map((time) => time.textContent)).toEqual(["28 Sep 2026, 10.00 WIB", "28 Sep 2026, 10.00"]);
    expect(rows()[0].querySelector("time")?.getAttribute("datetime")).toBe("2026-09-28T03:00:00.000Z");
    expect(screen.getByText("Peringkatmu minggu ini").nextElementSibling?.textContent).toBe("#2");
    expect(screen.getByText("187")).toBeTruthy();
    expect(screen.getByText("2.210")).toBeTruthy();
    // Members get no moderation column, controls or hidden list.
    expect(screen.queryByRole("columnheader", { name: "Moderasi" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sembunyikan/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Disembunyikan" })).toBeNull();
    expect(screen.queryByText(/Sebagai (admin|pemilik)/)).toBeNull();
  });

  it("switches periods with the keyboard and keeps your rank visible outside the top 100", async () => {
    const person = userEvent.setup();
    show();
    await person.click(screen.getByRole("tab", { name: /Minggu ini/ }));
    await person.keyboard("{ArrowRight}");
    const all = screen.getByRole("tab", { name: "Sepanjang masa" });
    expect(document.activeElement).toBe(all);
    expect(all.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(all.id);
    expect(screen.getByText("Peringkatmu sepanjang masa").nextElementSibling?.textContent).toBe("#154");
    expect(screen.getByText(/Skor terbaik 90 · di luar 100 besar/)).toBeTruthy();
    expect(screen.queryByText("Kamu")).toBeNull();
    await person.keyboard("{End}{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Minggu ini/ }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: /Minggu ini/ }));
  });

  it("says 1.000+ past the counted ranks and explains a hidden score", () => {
    const { unmount } = show({ boards: { week: { ...weekBoard, you: { rank: null, score: 3, hidden: false } }, all: allBoard } });
    expect(screen.getByText("Peringkatmu minggu ini").nextElementSibling?.textContent).toBe("1.000+");
    unmount();
    show({ boards: { week: board([entry("a", 1, "Cici L.", 1204)], { you: { rank: null, score: 812, hidden: true } }), all: allBoard } });
    expect(screen.getByText("Peringkatmu minggu ini").nextElementSibling?.textContent).toBe("—");
    expect(screen.getByText(/Skormu sedang disembunyikan admin/)).toBeTruthy();
    expect(screen.getByText("Skor terbaik 812 · disembunyikan")).toBeTruthy();
  });

  it("shows a loading state and an empty state that links to the game", () => {
    const { unmount } = show({ boards: { week: undefined, all: undefined } });
    expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("Memuat papan skor…"))).toBe(true);
    unmount();
    show({ boards: { week: board([]), all: allBoard } });
    expect(screen.getByRole("heading", { name: "Belum ada skor minggu ini." })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    const links = screen.getAllByRole("link", { name: /Main Bogor Run/ });
    expect(links.length).toBe(2);
    for (const link of links) expect(link.getAttribute("href")).toBe("/#join");
  });

  it("lists hidden players apart for staff, with who hid them and why", () => {
    show({ role: "owner", boards: { week: ownerBoard, all: allBoard } });
    expect(screen.getByText(/Sebagai pemilik, kamu bisa menyembunyikan pemain/)).toBeTruthy();
    // The ranked table holds visible players only; the note up top links to the hidden list further down.
    expect(rows().map((row) => row.querySelector(".dash-board-name")?.textContent)).toEqual(["Cici L.", "Bima S.", "Rania P."]);
    expect(screen.getByText(/3 pemain disembunyikan dari papan minggu ini\./).querySelector("a")?.getAttribute("href")).toBe("#board-hidden");
    const section = screen.getByRole("region", { name: "Disembunyikan" });
    expect(section.id).toBe("board-hidden");
    expect(within(section).getByText("KHUSUS ADMIN · 3 PEMAIN")).toBeTruthy();
    const hidden = within(section).getByRole("table");
    expect(hidden.querySelector("caption")?.textContent).toBe("Pemain yang disembunyikan dari papan minggu ini, 28 Sep – 4 Okt");
    expect(rows(hidden).map((row) => row.querySelector(".dash-board-name")?.textContent)).toEqual(["Joko C.", "Wati S.", "Eko P."]);
    expect(hidden.querySelector(".dash-rank")).toBeNull();

    const jokoRow = rowOf(/Joko C\./);
    expect(jokoRow.querySelector(".dash-board-why")?.textContent).toBe("Disembunyikan oleh Aldio L. (pemilik) pada 28 Sep 2026, 11.00 WIB.");
    expect(jokoRow.querySelector(".dash-board-when-inline")?.textContent).toBe("Skor dicapai 28 Sep 2026, 10.00 WIB");
    expect(within(jokoRow).getByText("999.999")).toBeTruthy();
    expect(within(jokoRow).getByRole("button", { name: "Tampilkan lagi Joko C." })).toBeTruthy();

    // Kept off only by a deactivated account: reactivation brings them back, not a button here.
    const watiRow = rowOf(/Wati S\./);
    expect(within(watiRow).getByText("Nonaktif")).toBeTruthy();
    expect(watiRow.querySelector(".dash-board-why")?.textContent).toBe("Akunnya dinonaktifkan, jadi skornya ikut disembunyikan sampai akunnya aktif lagi.");
    expect(within(watiRow).queryByRole("button")).toBeNull();
    expect(within(watiRow).getByText("Tampil saat akun aktif")).toBeTruthy();

    const ekoRow = rowOf(/Eko P\./);
    expect(ekoRow.querySelector(".dash-board-why")?.textContent).toBe("Disembunyikan oleh Sari W. (admin) pada 28 Sep 2026, 11.00 WIB. Akunnya juga sedang nonaktif.");
    expect(within(ekoRow).getByRole("button", { name: "Tampilkan lagi Eko P." })).toBeTruthy();

    // Your own row has no control and needs no reason.
    const mine = rowOf(/Bima S\./);
    expect(within(mine).queryByRole("button")).toBeNull();
    expect(mine.querySelector(".dash-board-refusal")).toBeNull();
    expect(within(rowOf(/Rania P\./)).getByRole("button", { name: "Sembunyikan Rania P." })).toBeTruthy();
  });

  it("shows admins which rows only an owner can change instead of offering a control the server refuses", () => {
    show({ role: "admin", boards: { week: adminBoard, all: allBoard } });
    expect(screen.getByText(/Sebagai admin, kamu bisa menyembunyikan member.*Skor admin dan pemilik hanya bisa diatur pemilik\./)).toBeTruthy();
    expect(within(rowOf(/Cici L\./)).getByRole("button", { name: "Sembunyikan Cici L." })).toBeTruthy();
    const rania = rowOf(/Rania P\./);
    expect(within(rania).queryByRole("button")).toBeNull();
    expect(within(rania).getByText("Khusus pemilik")).toBeTruthy();
    const jokoRow = rowOf(/Joko C\./);
    expect(within(jokoRow).queryByRole("button")).toBeNull();
    expect(within(jokoRow).getByText("Khusus pemilik")).toBeTruthy();
    expect(within(rowOf(/Wati S\./)).getByText("Tampil saat akun aktif")).toBeTruthy();
    expect(within(rowOf(/Eko P\./)).getByRole("button", { name: "Tampilkan lagi Eko P." })).toBeTruthy();
  });

  it("hides a player after confirming, then moves focus on once the row leaves the ranked table", async () => {
    let finish: (value: null) => void = () => {};
    const onSetHidden = vi.fn<SetHidden>(() => new Promise((resolve) => { finish = resolve; }));
    const person = userEvent.setup();
    const { update } = show({ role: "owner", boards: { week: ownerBoard, all: allBoard }, onSetHidden });
    const hide = screen.getByRole("button", { name: "Sembunyikan Cici L." });
    await person.click(hide);
    expect(hide.getAttribute("aria-expanded")).toBe("true");
    expect(hide.closest("tr")!.getAttribute("data-confirming")).toBe("true");
    const dialog = screen.getByRole("group", { name: "Sembunyikan Cici L." });
    expect(dialog.textContent).toContain("Skornya tetap tersimpan");
    expect(dialog.textContent).toContain("Karena kamu pemilik, hanya pemilik yang bisa menampilkannya lagi.");
    expect(dialog.closest("td")!.colSpan).toBe(5);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Ya, sembunyikan" }));
    await person.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("group", { name: "Sembunyikan Cici L." })).toBeNull();
    expect(document.activeElement).toBe(hide);
    expect(hide.closest("tr")!.hasAttribute("data-confirming")).toBe(false);
    expect(onSetHidden).not.toHaveBeenCalled();

    await person.click(hide);
    await person.click(screen.getByRole("button", { name: "Ya, sembunyikan" }));
    expect(onSetHidden).toHaveBeenCalledWith("a", true);
    const pending = screen.getByRole("button", { name: "Menyimpan…" }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Batal" }) as HTMLButtonElement).disabled).toBe(true);
    expect((hide as HTMLButtonElement).disabled).toBe(true);
    finish(null);
    await waitFor(() => expect(screen.queryByRole("group", { name: "Sembunyikan Cici L." })).toBeNull());
    expect(screen.getByText("Cici L. disembunyikan dari semua papan skor dan kini ada di daftar Disembunyikan.")).toBeTruthy();
    expect(document.activeElement).toBe(hide);

    // The board catches up: Cici moves to the hidden list and focus skips your own row to the next one with a button.
    update({ ...ownerBoard, entries: ownerBoard.entries.slice(1).map((row) => ({ ...row, rank: row.rank - 1 })),
      hiddenEntries: [joko, hiddenEntry("a", "Cici L.", 1204), wati, eko] });
    expect(rows().map((row) => row.querySelector(".dash-board-name")?.textContent)).toEqual(["Bima S.", "Rania P."]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sembunyikan Rania P." }));
  });

  it("restores a player and moves focus when the board has caught up before the mutation resolves", async () => {
    const person = userEvent.setup();
    let update: (next: Board) => void = () => {};
    // Convex can deliver the new board before the mutation's promise settles, unmounting the row mid-await.
    const onSetHidden = vi.fn<SetHidden>(async () => { update({ ...ownerBoard, hiddenEntries: [wati, eko] }); return null; });
    update = show({ role: "owner", boards: { week: ownerBoard, all: allBoard }, onSetHidden }).update;
    await person.click(screen.getByRole("button", { name: "Tampilkan lagi Joko C." }));
    const dialog = screen.getByRole("group", { name: "Tampilkan lagi Joko C." });
    expect(dialog.closest("tr")!.previousElementSibling!.getAttribute("data-confirming")).toBe("true");
    expect(dialog.closest("td")!.colSpan).toBe(4);
    await person.click(within(dialog).getByRole("button", { name: "Ya, tampilkan lagi" }));
    expect(onSetHidden).toHaveBeenCalledWith("x", false);
    await waitFor(() => expect(screen.getByText("Joko C. ditampilkan lagi di semua papan skor.")).toBeTruthy());
    expect(screen.queryByRole("rowheader", { name: /Joko C\./ })).toBeNull();
    // Wati has no button, so focus lands on Eko's.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tampilkan lagi Eko P." }));
  });

  it("explains that restoring a deactivated player waits for the account, and falls back to the list heading", async () => {
    const person = userEvent.setup();
    const onSetHidden = vi.fn<SetHidden>(async () => null);
    const { update } = show({ role: "owner", boards: { week: { ...ownerBoard, hiddenEntries: [eko] }, all: allBoard }, onSetHidden });
    await person.click(screen.getByRole("button", { name: "Tampilkan lagi Eko P." }));
    expect(screen.getByRole("group", { name: "Tampilkan lagi Eko P." }).textContent).toContain("Akunnya masih nonaktif, jadi skornya baru tampil setelah akunnya diaktifkan kembali.");
    await person.click(screen.getByRole("button", { name: "Ya, tampilkan lagi" }));
    await waitFor(() => expect(screen.getByText("Eko P. tidak lagi disembunyikan admin, tapi skornya baru tampil setelah akunnya diaktifkan kembali.")).toBeTruthy());
    // Eko stays listed, now hidden only by the account, so the button gives way to the reason.
    update({ ...ownerBoard, hiddenEntries: [{ ...eko, hiddenAt: null, hiddenBy: null, hiddenByRole: null, canRestore: false }] });
    expect(within(rowOf(/Eko P\./)).getByText("Tampil saat akun aktif")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Disembunyikan" }));
  });

  it("keeps the confirmation open and shows the server message when moderation fails", async () => {
    const message = "Pemain ini disembunyikan pemilik, jadi hanya pemilik yang bisa menampilkannya lagi.";
    const onSetHidden = vi.fn<SetHidden>(async () => { throw Object.assign(new Error("forbidden"), { data: { code: "FORBIDDEN", message } }); });
    const person = userEvent.setup();
    show({ role: "admin", boards: { week: adminBoard, all: allBoard }, onSetHidden });
    await person.click(screen.getByRole("button", { name: "Tampilkan lagi Eko P." }));
    await person.click(screen.getByRole("button", { name: "Ya, tampilkan lagi" }));
    expect(onSetHidden).toHaveBeenCalledWith("k", false);
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(screen.getByRole("group", { name: "Tampilkan lagi Eko P." })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Ya, tampilkan lagi" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("moves the control under the score on narrow screens so the table needs no sideways scroll", async () => {
    narrowScreen();
    const person = userEvent.setup();
    show({ role: "admin", boards: { week: adminBoard, all: allBoard } });
    expect(screen.queryByRole("columnheader", { name: "Moderasi" })).toBeNull();
    for (const table of tables()) expect(within(table).getAllByRole("columnheader").length).toBe(table.classList.contains("dash-board-off") ? 3 : 4);
    const cici = rowOf(/Cici L\./);
    const hide = within(cici).getByRole("button", { name: "Sembunyikan Cici L." });
    expect(hide.closest("td")!.className).toBe("dash-board-score");
    expect(within(rowOf(/Rania P\./)).getByText("Khusus pemilik").closest("td")!.className).toBe("dash-board-score");
    await person.click(hide);
    expect(screen.getByRole("group", { name: "Sembunyikan Cici L." }).closest("td")!.colSpan).toBe(4);
  });

  it("keeps the hidden list for staff when nobody is ranked, and says when it is empty", () => {
    const { unmount } = show({ role: "owner", boards: { week: { ...ownerBoard, entries: [], hiddenEntries: [joko] }, all: allBoard } });
    expect(screen.getByRole("heading", { name: "Belum ada skor minggu ini." })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Disembunyikan" })).getByRole("rowheader", { name: /Joko C\./ })).toBeTruthy();
    unmount();
    show({ role: "owner", boards: { week: { ...ownerBoard, hiddenEntries: [] }, all: allBoard } });
    expect(screen.queryByText(/disembunyikan dari papan minggu ini\. Lihat/)).toBeNull();
    expect(screen.getByText("Tidak ada pemain yang disembunyikan dari papan minggu ini.")).toBeTruthy();
    expect(tables().length).toBe(1);
  });
});
