import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { catalystCohort } from "@/lib/cohort";
import { ProgramRoster } from "./program";
import { ViewerContext, type DashboardViewer } from "./viewer";

// The roster and its import against a fake Convex that serves one Catalyst cohort.
const cohort = { _id: "c1", slug: "catalyst-2026", name: "GDGoC Catalyst 2026/27", status: "setup", roles: catalystCohort.roles };
const row = (id: string, email: string, name: string, role: string, extra: object = {}) =>
  ({ _id: id, email, name, role, status: "active", ownerId: null, claimedAt: null, importedAt: Date.UTC(2026, 10, 27), fullName: null, campus: null, ...extra });
const rows = [
  row("e1", "budi@gmail.com", "Budi", "hacker", { ownerId: "u1", fullName: "Budi Santoso", claimedAt: 1 }),
  row("e2", "citra@gmail.com", "Citra", "hipster"),
  row("e3", "dina@gmail.com", "Dina", "hustler", { status: "withdrawn" }),
];
const roster = { cohort, rows };
const importEnrolments = vi.fn(async (args: { rows: unknown[] }) => ({ added: args.rows.length - 1, updated: 1, unchanged: 0, linked: 0 }));
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) => getFunctionName(ref) === "cohorts:roster" ? roster : undefined,
  useMutation: (ref: FunctionReference<"mutation">) => getFunctionName(ref) === "cohorts:importEnrolments" ? importEnrolments : vi.fn(async () => null),
}));

const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role: "admin", active: true, onboarded: true, reviewer: true, memberType: null, division: null, campus: "", studyProgram: "" };
const show = () => render(<ViewerContext.Provider value={viewer}><ProgramRoster slug="catalyst-2026" /></ViewerContext.Provider>);
const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

afterEach(() => { cleanup(); importEnrolments.mockClear(); });

describe("program roster", () => {
  it("lists participants with role and sign-in status as an accessible table, and searches by name or email", async () => {
    const { container } = show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("GDGoC Catalyst 2026/27");
    expect(bodyRows().map((tr) => tr.textContent)).toEqual([
      expect.stringContaining("Budi Santoso"), expect.stringContaining("Citra"), expect.stringContaining("Dina"),
    ]);
    expect(bodyRows()[0].textContent).toContain("Sudah masuk");
    expect(bodyRows()[0].textContent).toContain("Di form: Budi");
    expect(bodyRows()[1].textContent).toContain("Belum masuk");
    expect(bodyRows()[2].textContent).toContain("Mengundurkan diri");
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
    await userEvent.type(screen.getByRole("searchbox", { name: "Cari nama atau email peserta" }), "citra@");
    expect(bodyRows()).toHaveLength(1);
  });

  it("imports pasted cells: guesses the columns and roles, shows what changes and what is skipped, then sends only the changes", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Impor peserta" }));
    const sheet = [
      "Timestamp\tEmail Address\tNama Lengkap\tPilih peran",
      "1\tbudi@gmail.com\tBudi\tHacker (engineering)",
      "2\tcitra@gmail.com\tCitra\tHustler (PM)",
      "3\teka@gmail.com\tEka Putra\tHacker (engineering)",
      "4\tbukan-email\tFajar\tHipster (UI/UX)",
    ].join("\n");
    const paste = screen.getByRole("textbox", { name: "Atau tempel sel dari Google Sheets" });
    await userEvent.click(paste);
    await userEvent.paste(sheet);
    await userEvent.click(screen.getByRole("button", { name: "Baca data" }));
    expect(screen.getByText("4 baris terbaca. Pastikan kolom dan perannya sudah benar.")).toBeTruthy();
    const summary = document.querySelector(".dash-import-summary")!;
    expect(summary.textContent).toContain("1 baru · 1 diperbarui · 1 sudah sama · 1 dilewati");
    await userEvent.click(within(summary as HTMLElement).getByText("Lihat baris yang dilewati"));
    expect(summary.textContent).toContain("Baris 5: Email “bukan-email” tidak valid.");

    await userEvent.click(screen.getByRole("button", { name: "Impor 2 peserta" }));
    await waitFor(() => expect(importEnrolments).toHaveBeenCalledTimes(1));
    expect(importEnrolments).toHaveBeenCalledWith({ cohortId: "c1", rows: [
      { email: "citra@gmail.com", name: "Citra", role: "hustler" }, { email: "eka@gmail.com", name: "Eka Putra", role: "hacker" },
    ] });
    expect(await screen.findByText("Impor selesai: 1 peserta ditambahkan, 1 diperbarui.")).toBeTruthy();
  });
});
