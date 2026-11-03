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
  ({ _id: id, email, name, role, status: "active", ownerId: null, claimedAt: null, teamId: null, importedAt: Date.UTC(2026, 10, 27), fullName: null, campus: null, ...extra });
const rows = [
  row("e1", "budi@gmail.com", "Budi", "hacker", { ownerId: "u1", fullName: "Budi Santoso", claimedAt: 1 }),
  row("e2", "citra@gmail.com", "Citra", "hipster", { teamId: "t1" }),
  row("e4", "fina@gmail.com", "Fina", "hustler"),
  row("e3", "dina@gmail.com", "Dina", "hustler", { status: "withdrawn" }),
];
const mentors = [{ _id: "m1", ownerId: "u9", role: "hacker", name: "Raka Mentor", active: true }];
const teams = [{ _id: "t1", name: "Tim Kopi" }, { _id: "t2", name: "Tim Teh" }];
const roster = { cohort, rows, mentors, teams };
const members = { rows: [
  { ownerId: "u9", fullName: "Raka Mentor", campus: "IPB University", role: "member", active: true },
  { ownerId: "u8", fullName: "Rani Mentor", campus: "IPB University", role: "member", active: true },
  { ownerId: "u7", fullName: "Rafi Admin", campus: "IPB University", role: "admin", active: true },
] };
const importEnrolments = vi.fn(async (args: { rows: unknown[] }) => ({ added: args.rows.length - 1, updated: 1, unchanged: 0, linked: 0 }));
const setMentor = vi.fn(async () => null);
const setTeam = vi.fn(async () => null);
const deleteTeam = vi.fn(async () => null);
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : ({ "cohorts:roster": roster, "dashboard:members": members } as Record<string, unknown>)[getFunctionName(ref)],
  useMutation: (ref: FunctionReference<"mutation">) => ({ "cohorts:importEnrolments": importEnrolments, "cohorts:setMentor": setMentor, "cohorts:setTeam": setTeam, "cohorts:deleteTeam": deleteTeam } as Record<string, unknown>)[getFunctionName(ref)] ?? vi.fn(async () => null),
  useConvex: () => ({ query: exportBevy }),
}));
const exportBevy = vi.fn(async () => [{ email: "budi@gmail.com", name: "Budi Santoso" }, { email: "citra@gmail.com", name: "Citra" }]);

const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role: "admin", active: true, onboarded: true, reviewer: true, memberType: null, division: null, tagConfirmed: false, campus: "", studyProgram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false };
const show = (role: DashboardViewer["role"] = "admin") => render(<ViewerContext.Provider value={{ ...viewer, role }}><ProgramRoster slug="catalyst-2026" /></ViewerContext.Provider>);
const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

afterEach(() => { cleanup(); importEnrolments.mockClear(); setMentor.mockClear(); setTeam.mockClear(); deleteTeam.mockClear(); });

describe("program roster", () => {
  it("lists participants with role and sign-in status as an accessible table, and searches by name or email", async () => {
    const { container } = show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("GDGoC Catalyst 2026/27");
    expect(bodyRows().map((tr) => tr.textContent)).toEqual([
      expect.stringContaining("Budi Santoso"), expect.stringContaining("Citra"), expect.stringContaining("Dina"), expect.stringContaining("Fina"),
    ]);
    expect(bodyRows()[1].textContent).toContain("Tim Kopi");
    expect(bodyRows()[0].textContent).toContain("Sudah masuk");
    expect(bodyRows()[0].textContent).toContain("Di form: Budi");
    expect(bodyRows()[1].textContent).toContain("Belum masuk");
    expect(bodyRows()[2].textContent).toContain("Mengundurkan diri");
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
    await userEvent.type(screen.getByRole("searchbox", { name: "Cari nama atau email peserta" }), "citra@");
    expect(bodyRows()).toHaveLength(1);
  });

  it("shows teams with their role mix and who has no team, adds and removes members, and deletes a team after asking", async () => {
    show();
    const section = screen.getByRole("region", { name: "Tim" });
    expect(section.textContent).toContain("2 tim · 1 dari 3 peserta aktif sudah punya tim");
    const kopi = within(section).getByRole("heading", { name: "Tim Kopi" }).closest("li")!;
    expect(kopi.textContent).toContain("Hipster 1");
    // The withdrawn participant is in no list; the two active ones without a team are.
    const unassigned = within(section).getByRole("heading", { name: /Belum punya tim/ }).parentElement!;
    expect(unassigned.textContent).toContain("Budi Santoso");
    expect(unassigned.textContent).toContain("Fina");
    expect(unassigned.textContent).not.toContain("Dina");
    await userEvent.click(within(kopi as HTMLElement).getByRole("button", { name: "Keluarkan Citra dari Tim Kopi" }));
    expect(setTeam).toHaveBeenCalledWith({ id: "e2", teamId: null });
    const teh = within(section).getByRole("heading", { name: "Tim Teh" }).closest("li")!;
    await userEvent.click(within(teh as HTMLElement).getByRole("button", { name: /Tambah anggota/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Fina · Hustler" }));
    expect(setTeam).toHaveBeenLastCalledWith({ id: "e4", teamId: "t2" });
    await userEvent.click(within(teh as HTMLElement).getByRole("button", { name: "Hapus tim" }));
    await userEvent.click(await screen.findByRole("button", { name: "Ya, hapus tim" }));
    expect(deleteTeam).toHaveBeenCalledWith({ id: "t2" });
  });

  it("lists each role's mentors, adds an active member as a mentor of the chosen role, and removes one", async () => {
    show();
    const section = screen.getByRole("region", { name: "Mentor per peran" });
    expect(within(section).getByRole("heading", { name: "Hacker" }).parentElement!.textContent).toContain("Raka Mentor");
    expect(within(section).getAllByText("Belum ada mentor.")).toHaveLength(2);
    await userEvent.type(within(section).getByRole("searchbox", { name: "Tambah mentor" }), "Ra");
    // Raka already mentors Hacker and admins review everything, so only Rani is offered.
    const offered = within(section).getAllByRole("button", { name: "Jadikan mentor Hacker" });
    expect(offered).toHaveLength(1);
    await userEvent.click(offered[0]);
    expect(setMentor).toHaveBeenCalledWith({ cohortId: "c1", ownerId: "u8", role: "hacker", mentor: true });
    await userEvent.click(within(section).getByRole("button", { name: "Hapus Raka Mentor dari mentor Hacker" }));
    expect(setMentor).toHaveBeenLastCalledWith({ cohortId: "c1", ownerId: "u9", role: "hacker", mentor: false });
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

  it("offers owners, not admins, the Bevy CSV of active participants with the consent note", async () => {
    show();
    expect(screen.queryByRole("button", { name: "CSV untuk Bevy" })).toBeNull();
    cleanup();
    show("owner");
    URL.createObjectURL = vi.fn(() => "blob:bevy");
    URL.revokeObjectURL = vi.fn();
    await userEvent.click(screen.getByRole("button", { name: "CSV untuk Bevy" }));
    const dialog = screen.getByRole("dialog", { name: "CSV untuk Bevy" });
    expect(dialog.textContent).toContain("3 peserta aktif");
    expect(dialog.textContent).toContain("Menyetujui bergabung sebagai member GDG on Campus IPB University lewat form pendaftaran GDGoC Catalyst 2026/27.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Unduh CSV" }));
    await waitFor(() => expect(exportBevy).toHaveBeenCalledTimes(1));
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    // Decoding drops the byte order mark, so it is checked in the bytes.
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe("email,first_name,last_name\r\nbudi@gmail.com,Budi,Santoso\r\ncitra@gmail.com,Citra,\r\n");
  });
});
