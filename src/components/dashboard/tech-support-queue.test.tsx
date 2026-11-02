import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { TechSupportQueue } from "./tech-support-queue";
import { ViewerContext, type DashboardViewer } from "./viewer";

// The handlers' queue against a fake Convex, on Thursday 5 Nov 2026 at 10.00 WIB.
const at = (value: string) => Date.parse(`${value}+07:00`);
const now = at("2026-11-05T10:00:00");
const member = { name: "Rania Putri", email: "rania@example.com", campus: "IPB University", memberType: "member", division: null };
const base = { competitionUrl: "https://example.com", deadline: "2026-11-20", participation: "solo", teamName: null, helpKinds: ["Ideasi"], progress: "Prototipe.", mentorName: null, note: null, updatedAt: 0, matchedAt: null, closedAt: null, handledBy: null, ownerId: "u1", member };
const requests = [
  // Friday 30 Oct 09.00: Fri, Mon, Tue and Wed have passed, so it is past the 3 working days.
  { ...base, _id: "late", competition: "Gemastik", status: "new", submittedAt: at("2026-10-30T09:00:00") },
  // Tuesday 3 Nov 10.00: two working days.
  { ...base, _id: "fresh", competition: "Hology", status: "new", submittedAt: at("2026-11-03T10:00:00"), member: { ...member, name: "Bima Sakti" } },
  // Matched a week ago in one working day: never overdue.
  { ...base, _id: "matched", competition: "Compfest", status: "matched", mentorName: "Dika Aprilio Wibowo", participation: "team", teamName: "Tim Dino", submittedAt: at("2026-10-26T09:00:00"), matchedAt: at("2026-10-27T09:00:00") },
  { ...base, _id: "closed", competition: "Arkavidia", status: "closed", submittedAt: at("2026-10-01T09:00:00") },
];
const queue = { requests, kpis: { facilitated: 1, teams: 1, byStatus: { new: 2, matched: 1, inProgress: 0, closed: 1 } } };
const mutations: Record<string, ReturnType<typeof vi.fn>> = { "techSupport:handle": vi.fn(async () => null) };
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : ({ "techSupport:queue": queue } as Record<string, unknown>)[getFunctionName(ref)],
  useMutation: (ref: FunctionReference<"mutation">) => mutations[getFunctionName(ref)] ?? vi.fn(async () => null),
}));

const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role: "member", active: true, onboarded: true, reviewer: false, memberType: "core", division: "Community & External", campus: "", studyProgram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: true };
const show = (extra: Partial<DashboardViewer> = {}) => render(<ViewerContext.Provider value={{ ...viewer, ...extra }}><TechSupportQueue /></ViewerContext.Provider>);
const accessible = async (container: HTMLElement) => {
  const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
};

beforeEach(() => { vi.useFakeTimers({ now, toFake: ["Date"] }); });
afterEach(() => { vi.useRealTimers(); cleanup(); mutations["techSupport:handle"].mockClear(); });

describe("Tech Support queue", () => {
  it("shows the KPI counts and marks new requests past three working days", async () => {
    const { container } = show();
    const stats = container.querySelector("dl.dash-stats")!;
    expect(stats.textContent).toContain("Permintaan difasilitasi1");
    expect(stats.textContent).toContain("Tim didampingi1");
    expect(stats.textContent).toContain("Baru, lewat target1 dari 2");

    const table = screen.getByRole("region", { name: "Antrean permintaan" });
    const rows = within(table).getAllByRole("row").slice(1);
    // Closed requests are hidden until "Semua" is chosen.
    expect(rows.map((row) => row.textContent?.match(/Gemastik|Hology|Compfest|Arkavidia/)?.[0])).toEqual(["Gemastik", "Hology", "Compfest"]);
    const [late, fresh, matched] = rows;
    expect(late.getAttribute("data-overdue")).toBe("true");
    expect(late.textContent).toContain("Lewat target · 4 hari kerja dari 3");
    expect(fresh.getAttribute("data-overdue")).toBeNull();
    expect(fresh.textContent).toContain("2 hari kerja dari 3");
    expect(matched.getAttribute("data-overdue")).toBeNull();
    expect(matched.textContent).toContain("Dicocokkan dalam 1 hari kerja");
    expect(matched.textContent).toContain("Mentor: Dika Aprilio Wibowo");
    await accessible(container);
  });

  it("records a mentor when matching, and needs one before it saves", async () => {
    vi.useRealTimers();
    show();
    await userEvent.click(screen.getByRole("button", { name: "Kelola permintaan Rania Putri untuk Gemastik" }));
    const dialog = screen.getByRole("dialog", { name: "Kelola permintaan" });
    expect(dialog.textContent).toContain("rania@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: /Status/ }));
    // Only the moves allowed from new are offered.
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Baru (sekarang)", "Mentor ditemukan", "Selesai"]);
    await userEvent.click(screen.getByRole("option", { name: "Mentor ditemukan" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(within(dialog).getByText("Tulis nama mentornya.")).toBeTruthy();
    expect(mutations["techSupport:handle"]).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: /^Mentor/ }), "Maghfira Aulia Ramadhanti");
    await userEvent.type(within(dialog).getByLabelText("Catatan pengelola"), "Dihubungi lewat WhatsApp.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(mutations["techSupport:handle"]).toHaveBeenCalledWith({ id: "late", status: "matched", mentorName: "Maghfira Aulia Ramadhanti", note: "Dihubungi lewat WhatsApp." });
  });

  it("is closed to members who do not handle the queue", () => {
    show({ techSupportHandler: false });
    expect(screen.getByText("Khusus pengelola Tech Support.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Antrean permintaan" })).toBeNull();
  });
});
