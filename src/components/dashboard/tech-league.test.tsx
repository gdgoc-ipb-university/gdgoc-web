import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { TechLeagueTeams } from "./tech-league";
import { ViewerContext, type DashboardViewer } from "./viewer";

// The staff view of Tech League teams and the registration import against a fake Convex.
const team = (id: string, name: string, code: string, track: string, trackName: string, captain: { name: string; email: string } | null, extra: object = {}) => ({
  _id: id, name, code, track, trackName, standing: "complete", createdAt: 1, submittedAt: null, registration: null, captain,
  members: captain ? [{ ownerId: `${id}-c`, name: captain.name, captain: true }, { ownerId: `${id}-m`, name: "Bima Sakti", captain: false }] : [], ...extra,
});
const teams = [
  team("t1", "Tim Hujan", "ABC234", "software", "Software Development", { name: "Rania Putri", email: "rania@example.com" }),
  team("t2", "Tim Pelangi", "XYZ789", "uiux", "UI/UX Design", { name: "Sari Dewi", email: "sari@example.com" }, { registration: { paid: true, importedAt: 1 } }),
  team("t3", "Tim Kabut", "KMN456", "business", "Business Plan", null, { standing: "flagged", registration: { paid: false, importedAt: 1 } }),
];
const importRegistrations = vi.fn(async (args: { rows: unknown[] }) => ({ registered: args.rows.length, updated: 0, unchanged: 0, unmatched: [] }));
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : ({ "league:staffTeams": teams } as Record<string, unknown>)[getFunctionName(ref)],
  useMutation: (ref: FunctionReference<"mutation">) => ({ "league:importRegistrations": importRegistrations } as Record<string, unknown>)[getFunctionName(ref)] ?? vi.fn(async () => null),
}));

const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role: "admin", active: true, onboarded: true, reviewer: true, memberType: null, division: null, tagConfirmed: false, campus: "", studyProgram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false };
const show = (role: DashboardViewer["role"] = "admin") => render(<ViewerContext.Provider value={{ ...viewer, role }}><TechLeagueTeams /></ViewerContext.Provider>);

afterEach(() => { cleanup(); importRegistrations.mockClear(); });

describe("Tech League for staff", () => {
  it("lists teams by track with the captain's email as the only contact", async () => {
    const { container } = show();
    const table = screen.getByRole("table");
    const [, kabut, hujan, pelangi] = within(table).getAllByRole("row");
    expect(kabut.textContent).toContain("Tanpa kapten");
    expect(hujan.textContent).toContain("rania@example.com");
    expect(hujan.textContent).toContain("Belum terdaftar");
    expect(pelangi.textContent).toContain("Lunas");
    expect(table.textContent).not.toContain("bima");
    const axeResult = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(axeResult.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("is for staff only", () => {
    show("member");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("previews an import before saving, lists unmatched rows, and sends only the changes", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Impor pendaftaran" }));
    await userEvent.click(screen.getByRole("textbox", { name: "Atau tempel sel dari Google Sheets" }));
    await userEvent.paste("Timestamp\tEmail Ketua\tStatus Pembayaran\n1\trania@example.com\tLunas\n2\tsari@example.com\tLunas\n3\tbima@example.com\tLunas");
    await userEvent.click(screen.getByRole("button", { name: "Baca data" }));
    const summary = screen.getAllByRole("status").find((node) => node.textContent?.includes("tidak cocok"))!;
    expect(summary.textContent).toContain("1 tim baru terdaftar · 0 diperbarui · 1 sudah sama · 1 tidak cocok");
    expect(summary.textContent).toContain("Baris 4, bima@example.com: Tidak ada tim dengan kapten beremail ini.");
    expect(importRegistrations).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Simpan 1 tim" }));
    expect(importRegistrations).toHaveBeenCalledWith({ rows: [{ email: "rania@example.com", paid: true }] });
    expect(await screen.findByText(/Impor selesai: 1 tim baru terdaftar/)).toBeTruthy();
  });
});
