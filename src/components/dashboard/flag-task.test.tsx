import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { EditAssignmentPage, NewAssignmentPage } from "./assignments";
import { AssignmentDetail } from "./assignment-detail";
import { ViewerContext, type DashboardViewer } from "./viewer";
import { MemberFlag, type Challenge, type SubmitFlag } from "./flag-task";

// Flag tasks (#240) in Kelola tugas against a fake Convex.
const task = {
  _id: "a1", _creationTime: 1, title: "Join Discord", slug: "join-discord", description: "Flag-nya ada di #pengumuman.", dueAt: Date.parse("2026-11-20T23:59:00+07:00"),
  status: "published", revision: 3, createdBy: "me", createdAt: 1, updatedAt: 1, audience: ["member"], kind: "flag", maxPoints: 100, minPoints: 20, decrement: 10,
};
const detail = { assignment: task, canManage: true, canReview: true, cohort: null, reviewers: [], flag: "GDGOC{join-discord}", submission: null, files: [] };
const solves = { solves: [
  { order: 1, name: "Rania Putri", inactive: false, solvedAt: Date.parse("2026-11-11T10:42:00+07:00"), points: 100, wrong: 2 },
  { order: 2, name: "Bima Sakti", inactive: true, solvedAt: Date.parse("2026-11-11T11:05:00+07:00"), points: 90, wrong: 0 },
], wrong: 9, wrongMembers: 4 };
const create = vi.fn(async () => "a2");
const update = vi.fn(async () => "join-discord");
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : ({ "assignments:get": detail, "assignments:slugPreview": "join-discord", "flags:solves": solves } as Record<string, unknown>)[getFunctionName(ref)],
  useMutation: (ref: FunctionReference<"mutation">) => ({ "assignments:create": create, "assignments:update": update } as Record<string, unknown>)[getFunctionName(ref)] ?? vi.fn(async () => null),
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
  useConvex: () => ({}),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role: "admin", active: true, onboarded: true, reviewer: true, memberType: null, division: null, tagConfirmed: false, campus: "", studyProgram: "", instagram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false };
const show = (page: React.ReactNode) => render(<ViewerContext.Provider value={viewer}>{page}</ViewerContext.Provider>);
const field = (name: RegExp | string) => screen.getByRole("spinbutton", { name }) as HTMLInputElement;

afterEach(() => { cleanup(); create.mockClear(); update.mockClear(); vi.useRealTimers(); });
const accessible = async (container: HTMLElement) => {
  const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] }, rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map(({ id }) => id)).toEqual([]);
};

describe("flag tasks in Kelola tugas", () => {
  it("swaps the score and rubric for a flag and its points, with a live preview", async () => {
    const { container } = show(<NewAssignmentPage />);
    expect(screen.queryByRole("textbox", { name: "Flag" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Flag, dinilai otomatis" }));
    expect(screen.queryByRole("spinbutton", { name: /Nilai maksimal/ })).toBeNull();
    expect(screen.queryByRole("group", { name: /Rubrik/ })).toBeNull();
    expect(screen.getByText("Solver ke-1: 100, ke-2: 90, ke-5: 60, minimum 20 mulai solver ke-9.")).toBeTruthy();
    await userEvent.clear(field("Turun per solve"));
    await userEvent.type(field("Turun per solve"), "40");
    expect(screen.getByText("Solver ke-1: 100, ke-2: 60, minimum 20 mulai solver ke-3.")).toBeTruthy();
    await userEvent.clear(field("Poin minimal"));
    expect(screen.getByText("Isi ketiga angka poin untuk melihat pratinjaunya.")).toBeTruthy();
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id }) => id)).toEqual([]);
  });

  it("checks the flag and points before saving, then sends them trimmed", async () => {
    show(<NewAssignmentPage />);
    await userEvent.click(screen.getByRole("radio", { name: "Flag, dinilai otomatis" }));
    await userEvent.type(screen.getByRole("textbox", { name: /Judul tugas/ }), "Join Discord");
    await userEvent.type(screen.getByRole("textbox", { name: /Instruksi/ }), "Cari flag-nya di Discord.");
    await userEvent.clear(field("Poin minimal"));
    await userEvent.type(field("Poin minimal"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Buka untuk sasaran" }));
    expect(create).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Flag" }));
    expect(screen.getByText("Isi flag yang harus ditemukan member.")).toBeTruthy();
    expect(screen.getByText("Poin minimal tidak boleh melebihi poin maksimal.")).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Flag" }), "  GDGOC{{join-discord} "); // "{{" types a literal brace
    await userEvent.clear(field("Poin minimal"));
    await userEvent.type(field("Poin minimal"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Buka untuk sasaran" }));
    expect(create).toHaveBeenCalledWith({ values: expect.objectContaining({ title: "Join Discord", flag: { flag: "GDGOC{join-discord}", maxPoints: "100", minPoints: "20", decrement: "10" } }), publish: true });
  });

  it("edits a flag task without the kind switch, starting from its flag and points", async () => {
    show(<EditAssignmentPage id="join-discord" />);
    expect(screen.queryByRole("radio", { name: "Flag, dinilai otomatis" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Flag" }) as HTMLInputElement).value).toBe("GDGOC{join-discord}");
    expect(screen.getByText("Flag tidak diterima lagi setelah tenggat.")).toBeTruthy();
    await userEvent.clear(field("Poin maksimal"));
    await userEvent.type(field("Poin maksimal"), "200");
    await userEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: "a1", revision: 3, values: expect.objectContaining({ flag: { flag: "GDGOC{join-discord}", maxPoints: "200", minPoints: "20", decrement: "10" } }) }));
  });

  it("shows staff the flag and points instead of submissions and reviewers", () => {
    show(<AssignmentDetail id="join-discord" />);
    const summary = screen.getByRole("region", { name: "Flag dan poin" });
    expect(summary.textContent).toContain("GDGOC{join-discord}");
    expect(summary.textContent).toContain("Solver ke-1: 100, ke-2: 90, ke-5: 60, minimum 20 mulai solver ke-9.");
    expect(screen.getByText("Member dari sasaran bisa mengirim flag sampai tenggat.")).toBeTruthy();
    for (const name of ["Penilai tugas ini", "Kiriman", "Siapa yang belum"]) expect(screen.queryByRole("heading", { name })).toBeNull();
    const list = screen.getByRole("region", { name: "Yang sudah memecahkan" });
    expect(list.textContent).toContain("2 solve · 9 flag salah dari 4 member");
    expect(screen.getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      "1Rania PutriFirst blood · 2 flag salah sebelumnya11 Nov 2026, 10.42 WIB10011 Nov 2026, 10.42 WIB",
      "2Bima SaktiNonaktifTanpa flag salah11 Nov 2026, 11.05 WIB9011 Nov 2026, 11.05 WIB",
    ]);
  });
});

describe("a flag task for members", () => {
  const fresh: Challenge = { maxPoints: 100, minPoints: 20, decrement: 10, pointsNow: 100, solves: 0, firstBlood: null, mine: null, nextTryAt: null };
  const member = (challenge: Challenge, onSubmit: SubmitFlag = vi.fn(), open = true) => render(<MemberFlag challenge={challenge} open={open} closedText="Tenggatnya sudah lewat." onSubmit={onSubmit} />);
  const stat = (name: string) => screen.getByText(name).parentElement!.textContent;

  it("shows the next solver's points, the solves and first blood, and keeps a wrong flag to fix", async () => {
    const onSubmit = vi.fn<SubmitFlag>(async () => ({ ok: false as const, code: "WRONG" as const, message: "Flag belum tepat.", triesLeft: 4 }));
    const { container } = member(fresh, onSubmit);
    expect(stat("Poin sekarang")).toBe("Poin sekarang100Untuk solver ke-1.");
    expect(stat("First blood")).toBe("First blood—Belum ada. Jadilah yang pertama.");
    await userEvent.click(screen.getByRole("button", { name: "Kirim flag" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Tulis flag yang kamu temukan.");
    await userEvent.type(screen.getByRole("textbox", { name: "Flag" }), "GDGOC{{tebak}");
    await userEvent.click(screen.getByRole("button", { name: "Kirim flag" }));
    expect(onSubmit).toHaveBeenCalledWith("GDGOC{tebak}");
    expect(screen.getByRole("alert").textContent).toBe("Flag belum tepat. Sisa 4 percobaan sebelum harus menunggu.");
    expect((screen.getByRole("textbox", { name: "Flag" }) as HTMLInputElement).value).toBe("GDGOC{tebak}");
    await accessible(container);
  });

  it("holds the form while the member is out of tries, then opens it on time", () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-11T10:00:00+07:00") });
    member({ ...fresh, pointsNow: 90, solves: 1, firstBlood: { name: "Rania P.", you: false }, nextTryAt: Date.now() + 30000 });
    expect(stat("First blood")).toBe("First bloodRania P.Solver pertama.");
    expect(screen.getByRole("button", { name: "Kirim flag" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Percobaan berikutnya pukul 10\.00\.30 WIB/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(30100); });
    expect(screen.getByRole("button", { name: "Kirim flag" }).hasAttribute("disabled")).toBe(false);
  });

  it("shows a solve with its locked points and first blood, and moves focus to it", async () => {
    const onSubmit = vi.fn<SubmitFlag>(async () => ({ ok: true as const, points: 100, place: 1, solvedAt: Date.parse("2026-11-11T10:42:00+07:00") }));
    const { rerender } = member(fresh, onSubmit);
    await userEvent.type(screen.getByRole("textbox", { name: "Flag" }), "GDGOC{{join-discord}");
    await userEvent.click(screen.getByRole("button", { name: "Kirim flag" }));
    const solved: Challenge = { ...fresh, pointsNow: 90, solves: 1, firstBlood: { name: "Saya S.", you: true }, mine: { points: 100, order: 1, solvedAt: Date.parse("2026-11-11T10:42:00+07:00") } };
    rerender(<MemberFlag challenge={solved} open closedText="" onSubmit={onSubmit} />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Flag-mu tepat!" }));
    const result = screen.getByRole("region", { name: "Flag-mu tepat!" });
    expect(result.textContent).toContain("100poin");
    expect(result.textContent).toContain("Solver ke-1 · first blood · 11 Nov 2026");
    expect(stat("First blood")).toBe("First bloodSaya S.Itu kamu!");
    expect(screen.queryByRole("textbox", { name: "Flag" })).toBeNull();
  });

  it("says when a task no longer takes flags", () => {
    member({ ...fresh, pointsNow: 20, solves: 12 }, vi.fn(), false);
    expect(stat("Poin sekarang")).toBe("Poin sekarang20Untuk solver ke-13, sudah minimum.");
    expect(screen.getByRole("region", { name: "Flag tidak diterima lagi." }).textContent).toContain("Tenggatnya sudah lewat.");
    expect(screen.queryByRole("button", { name: "Kirim flag" })).toBeNull();
  });
});
