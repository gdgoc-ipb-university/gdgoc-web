import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { printSummary, type PrintCandidate } from "@/lib/card-print";
import { CardPrintPage } from "./card-print";
import { ViewerContext, type DashboardViewer } from "./viewer";

// The "Cetak kartu" page (#159) against a fake Convex: the selection read page by page, and issuing numbers.
const member = (name: string, number: string | null, extra: Partial<PrintCandidate> = {}): PrintCandidate => ({
  ownerId: name.toLowerCase().replace(/\s+/g, "-"), name, memberType: "member", division: null, active: true, number, blocked: false, photo: "uploaded", ...extra,
});
let people: PrintCandidate[] = [];
const queried: { selection: unknown; cursor: string | null }[] = [];
const query = vi.fn(async (ref: FunctionReference<"query">, args: { selection: unknown; paginationOpts: { cursor: string | null } }) => {
  expect(getFunctionName(ref)).toBe("cards:printSelection");
  queried.push({ selection: args.selection, cursor: args.paginationOpts.cursor });
  // Two pages, as the server cuts them.
  const half = Math.ceil(people.length / 2);
  return args.paginationOpts.cursor ? { page: people.slice(half), isDone: true, continueCursor: "end" } : { page: people.slice(0, half), isDone: false, continueCursor: "half" };
});
let counter = 40;
const issueFor = vi.fn(async ({ ownerIds }: { ownerIds: string[] }) => {
  const issued = ownerIds.map((ownerId) => ({ ownerId, number: `2627-${String(++counter).padStart(4, "0")}` }));
  people = people.map((row) => ({ ...row, number: issued.find((card) => card.ownerId === row.ownerId)?.number ?? row.number }));
  return { issued, skipped: [] };
});
const convex = { query };
vi.mock("convex/react", () => ({ useConvex: () => convex, useMutation: () => issueFor }));
let params = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));

const viewer = (role: DashboardViewer["role"]): DashboardViewer => ({ id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role, active: true, onboarded: true, reviewer: true, memberType: null, division: null, tagConfirmed: false, campus: "", studyProgram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false });
const show = (role: DashboardViewer["role"] = "admin") => render(<ViewerContext.Provider value={viewer(role)}><CardPrintPage /></ViewerContext.Provider>);
const stat = (label: string) => screen.getAllByText(label).find((element) => element.tagName === "DT")!.nextElementSibling!.textContent;

afterEach(() => { cleanup(); sessionStorage.clear(); queried.length = 0; issueFor.mockClear(); });

describe("print summary", () => {
  it("prints members with this year's number in number order, and lists who has none, no upload, or is left out", () => {
    const rows = [
      member("Wati", "2627-0012"), member("Agus", "2627-0003", { photo: "google" }), member("Lina", null), member("Bayu", null, { photo: "initial" }),
      member("Oki", "2627-0007", { blocked: true }), member("Sari", "2627-0001", { active: false }), member("Tono", null, { active: false }),
    ];
    const summary = printSummary(rows);
    expect(summary.printing.map((row) => row.number)).toEqual(["2627-0003", "2627-0012"]);
    expect(summary.missing.map((row) => row.name)).toEqual(["Bayu", "Lina"]);
    expect(summary.noUpload.map((row) => row.name)).toEqual(["Agus"]);
    expect(summary.excluded.map((row) => row.name)).toEqual(["Oki", "Sari", "Tono"]);
    expect([summary.sheets, summary.pages]).toEqual([1, 2]);
    // Included on request, but only those with a number.
    expect(printSummary(rows, { includeExcluded: true }).printing.map((row) => row.number)).toEqual(["2627-0001", "2627-0003", "2627-0007", "2627-0012"]);
    expect(printSummary(Array.from({ length: 19 }, (_, index) => member(`M${index}`, `2627-${index}`))).pages).toBe(6);
  });
});

describe("print page", () => {
  it("is for staff only", () => {
    show("member");
    expect(screen.getByRole("heading", { name: "Khusus pengurus." })).toBeTruthy();
    expect(query).not.toHaveBeenCalled();
  });

  it("summarises the members matching the filters before printing", async () => {
    params = new URLSearchParams("community=core&status=active");
    people = [member("Rania Putri", "2627-0001", { memberType: "core", division: "Technical" }), member("Bima Sakti", null, { photo: "google" }), member("Citra Lestari", "2627-0002", { photo: "initial" }), member("Dewi Kartika", "2627-0005", { blocked: true })];
    const { container } = show();
    await screen.findAllByText("Akan dicetak");
    expect(queried.map((call) => call.cursor)).toEqual([null, "half"]);
    expect(queried[0].selection).toEqual({ kind: "filters", search: "", filters: expect.objectContaining({ community: ["core"], status: "active" }) });
    expect(screen.getByText(/Yang dicetak:/).closest("p")!.textContent).toContain("Semua anggota yang cocok dengan filter Komunitas: Core Team; Status: Aktif.");
    expect([stat("Akan dicetak"), stat("Belum punya nomor"), stat("Tanpa foto unggahan")]).toEqual(["2", "1", "1"]);
    expect(screen.getByText("1 lembar A4, 2 halaman bolak-balik")).toBeTruthy();
    const photos = screen.getByRole("region", { name: "Tanpa foto unggahan" });
    expect(within(photos).getByText("Citra Lestari").nextElementSibling?.textContent).toBe("Inisial");
    // Bima has no number, so his Google photo is not counted until he does.
    const left = screen.getByRole("region", { name: "Diblokir atau nonaktif" });
    expect(within(left).getByText("Dewi Kartika").nextElementSibling?.textContent).toBe("Kartu diblokir");
    await userEvent.click(within(left).getByRole("checkbox", { name: "Tetap cetak 1 kartu yang diblokir atau nonaktif" }));
    expect(stat("Akan dicetak")).toBe("3");
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("issues missing numbers in name order and in batches after a confirmation, then reads the selection again", async () => {
    const user = userEvent.setup();
    params = new URLSearchParams("pilihan=1");
    const missing = Array.from({ length: 55 }, (_, index) => member(`Anggota ${String(55 - index).padStart(2, "0")}`, null));
    people = [member("Rania Putri", "2627-0001"), ...missing, member("Oki Pratama", null, { active: false })];
    sessionStorage.setItem("dashboard:anggota:cetak", JSON.stringify(people.map((row) => row.ownerId)));
    show();
    await screen.findAllByText("Akan dicetak");
    expect(queried[0].selection).toEqual({ kind: "picked", ownerIds: people.map((row) => row.ownerId) });
    expect(stat("Belum punya nomor")).toBe("55");
    await user.click(screen.getByRole("button", { name: "Terbitkan 55 nomor" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Terbitkan 55 nomor kartu?" });
    expect(dialog.textContent).toContain("tidak bisa dibatalkan atau dipakai ulang");
    await user.click(within(dialog).getByRole("button", { name: "Terbitkan nomor" }));
    await waitFor(() => expect(stat("Akan dicetak")).toBe("56"));
    expect(issueFor.mock.calls.map(([args]) => args.ownerIds.length)).toEqual([50, 5]);
    expect(issueFor.mock.calls[0][0].ownerIds.slice(0, 2)).toEqual(["anggota-01", "anggota-02"]);
    expect(issueFor.mock.calls.flatMap(([args]) => args.ownerIds)).not.toContain("oki-pratama");
    expect(screen.getByText(/nomor diterbitkan/).textContent).toBe("55 nomor diterbitkan: 2627-0041 sampai 2627-0095.");
    expect(queried.length).toBe(4);
  });
});
