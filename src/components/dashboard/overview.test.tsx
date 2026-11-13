import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { DashboardOverview } from "./overview";
import { ViewerContext, type DashboardViewer } from "./viewer";

// The member overview against a fake Convex: `cohorts.mine` is what the signed-in member's enrolment returns (#106).
const day = 86400000;
const now = Date.now();
const task = (id: string, title: string, dueAt: number | null, extra: object = {}) => ({ _id: id, slug: id, title, dueAt, submittedAt: null, late: false, revisionRequestedAt: null, ...extra });
const hacker = {
  _id: "e1", cohort: { name: "GDGoC Catalyst 2026/27", slug: "catalyst-2026" }, role: { key: "hacker", name: "Hacker" },
  team: { name: "Tim Kopi", teammates: [{ name: "Citra Dewi", role: "Hipster" }, { name: "Fina Rahma", role: "Hustler" }] },
  tasks: [task("tugas-sesi-1", "Tugas sesi 1", now + 2 * day, { submittedAt: now - day }), task("tugas-hacker", "Setup repositori", now + 5 * day)],
};
let mine: unknown[] = [];
let assignments: unknown[] = [];
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) => ({ "cohorts:mine": mine, "assignments:list": assignments } as Record<string, unknown>)[getFunctionName(ref)],
  usePaginatedQuery: () => ({ status: "Exhausted", results: [], loadMore: () => {} }),
}));

const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Budi Santoso", email: "budi@example.com", role: "member", active: true, onboarded: true, reviewer: false, memberType: "member", division: null, tagConfirmed: false, campus: "", studyProgram: "", instagram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false };
const show = (programs: unknown[], list: unknown[] = []) => { mine = programs; assignments = list; return render(<ViewerContext.Provider value={viewer}><DashboardOverview /></ViewerContext.Provider>); };
const card = () => screen.getByRole("region", { name: "GDGoC Catalyst 2026/27" });

afterEach(cleanup);

describe("program card on the overview", () => {
  it("shows the cohort, role, team and teammates, and the open tasks for the role with due dates and status", async () => {
    const { container } = show([hacker]);
    const section = within(card());
    expect(section.getByText("Hacker").tagName).toBe("STRONG");
    expect(section.getByText("Tim Kopi")).toBeTruthy();
    expect(section.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Citra Dewi · Hipster", "Fina Rahma · Hustler", expect.stringContaining("Tugas sesi 1"), expect.stringContaining("Setup repositori"),
    ]);
    expect(section.getByRole("link", { name: "Tugas sesi 1" }).getAttribute("href")).toBe("/dashboard/tugas/tugas-sesi-1");
    expect(section.getByRole("link", { name: "Setup repositori" }).getAttribute("href")).toBe("/dashboard/tugas/tugas-hacker");
    expect(section.getAllByText(/^Tenggat /)).toHaveLength(2);
    expect(section.getByText("Terkumpul")).toBeTruthy();
    expect(section.getByText("Belum dikumpulkan")).toBeTruthy();
    // No next session until sessions exist (#109), and no placeholder in its place.
    expect(card().textContent).not.toMatch(/sesi berikutnya|segera/i);
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("says the team is not formed yet, and shows a revision request and an empty task list", () => {
    show([{ ...hacker, team: null, tasks: [task("t1", "Tugas sesi 1", now + day, { submittedAt: now, revisionRequestedAt: now })] }]);
    expect(within(card()).getByText("Tim belum dibentuk. Timmu muncul di sini setelah panitia membentuknya.")).toBeTruthy();
    expect(within(card()).getByText("Revisi diminta")).toBeTruthy();
    cleanup();
    show([{ ...hacker, tasks: [] }]);
    expect(within(card()).getByText("Belum ada tugas yang dibuka untuk peranmu.")).toBeTruthy();
  });

  it("shows nothing for a member who is not enrolled", () => {
    show([]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Halo, Budi.");
    expect(screen.queryByText("PROGRAM")).toBeNull();
    expect(screen.queryByText(/Catalyst/)).toBeNull();
    // Only the member overview's own section remains.
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby"))).toEqual(["next-title"]);
  });
});

describe("tasks without a deadline (#276)", () => {
  const open = (id: string, title: string, dueAt: number | null) => ({ ...task(id, title, dueAt), status: "published", kind: null, points: null });
  const next = () => within(screen.getByRole("region", { name: "Tenggat terdekat" }));

  it("leaves them out of the nearest deadlines and the overdue notice, and says how many wait", () => {
    show([], [open("besok", "Besok", now + day), open("kapan-saja", "Kapan saja", null)]);
    expect(next().getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Besok"]);
    cleanup();
    show([], [open("kapan-saja", "Kapan saja", null)]);
    expect(next().getByText("Tidak ada tenggat yang menunggu.")).toBeTruthy();
    expect(next().getByText("1 tugas yang belum kamu kumpulkan tidak punya tenggat. Kerjakan kapan saja selama tugasnya masih dibuka.")).toBeTruthy();
    expect(screen.queryByText(/sudah lewat tenggat/)).toBeNull();
  });

  it("says a program task has no deadline instead of a date", () => {
    show([{ ...hacker, tasks: [task("kapan-saja", "Kapan saja", null)] }]);
    expect(within(card()).getByText("Tanpa tenggat")).toBeTruthy();
    expect(within(card()).queryByText(/^Tenggat /)).toBeNull();
  });
});
