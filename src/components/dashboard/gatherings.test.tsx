import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { GatheringDetail, GatheringsPage } from "./gatherings";
import { ViewerContext, type DashboardViewer } from "./viewer";

// The gathering pages against a fake Convex that serves one open gathering.
const at = (value: string) => Date.parse(`${value}+07:00`);
const gathering = {
  _id: "g1", title: "Kumpul member November", startsAt: at("2026-11-21T09:00:00"), endsAt: at("2026-11-21T13:00:00"), venue: "Javano Coffee, Private Room 2",
  audience: ["member", "core", "bod"], status: "open", staff: true, helpers: [{ ownerId: "h1", name: "Sari Sekben" }],
  checkIns: [
    { _id: "c2", ownerId: "u2", name: "Tamu", campus: "", studyProgram: "", memberType: "member", division: null, checkedInAt: at("2026-11-21T09:20:00"), method: "manual", by: "Sari Sekben", outsideAudience: true },
    { _id: "c1", ownerId: "u1", name: "Rania Putri", campus: "IPB University", studyProgram: "Ilmu Komputer", memberType: "core", division: "Technical", checkedInAt: at("2026-11-21T09:05:00"), method: "scan", by: "Pemilik", outsideAudience: false },
  ],
  absent: [{ ownerId: "u3", name: "Bima Sakti", campus: "IPB University", memberType: "member", division: null }],
};
const row = { _id: "g1", title: gathering.title, startsAt: gathering.startsAt, endsAt: gathering.endsAt, venue: gathering.venue, audience: gathering.audience, status: "open", checkIns: 2, audienceSize: 3 };
const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  "gatherings:checkIn": vi.fn(async () => ({ result: "checkedIn", name: "Bima Sakti", checkedInAt: 1 })),
  "gatherings:setStatus": vi.fn(async () => null),
};
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : ({ "gatherings:list": [row], "gatherings:get": gathering } as Record<string, unknown>)[getFunctionName(ref)],
  useMutation: (ref: FunctionReference<"mutation">) => mutations[getFunctionName(ref)] ?? vi.fn(async () => null),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role: "admin", active: true, onboarded: true, reviewer: true, memberType: null, division: null, tagConfirmed: false, campus: "", studyProgram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false };
const show = (node: React.ReactNode, extra: Partial<DashboardViewer> = {}) => render(<ViewerContext.Provider value={{ ...viewer, ...extra }}>{node}</ViewerContext.Provider>);
const accessible = async (container: HTMLElement) => {
  const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
};

afterEach(() => { cleanup(); Object.values(mutations).forEach((fn) => fn.mockClear()); });

describe("gatherings", () => {
  it("lists gatherings with their time, venue and turnout, and lets staff create one", async () => {
    const { container } = show(<GatheringsPage />);
    const card = screen.getByRole("link", { name: /Kumpul member November/ });
    expect(card.getAttribute("href")).toBe("/dashboard/kehadiran/g1");
    expect(card.textContent).toContain("Sab, 21 Nov 2026 · 09.00–13.00 WIB · Javano Coffee, Private Room 2");
    expect(card.textContent).toContain("2 hadir dari 3 anggota sasaran");
    expect(screen.getByRole("button", { name: "Buat kegiatan" })).toBeTruthy();
    await accessible(container);
  });

  it("is closed to members who run no door", () => {
    show(<GatheringsPage />, { role: "member" });
    expect(screen.getByText("Khusus admin.")).toBeTruthy();
  });

  it("shows who came and who has not, and checks someone in by hand", async () => {
    const { container } = show(<GatheringDetail id="g1" />);
    const came = screen.getByRole("region", { name: "Daftar hadir" });
    expect(within(came).getAllByRole("row").slice(1).map((tr) => tr.textContent)).toEqual([
      expect.stringContaining("Tamu · di luar sasaran"), expect.stringContaining("Rania Putri"),
    ]);
    expect(within(came).getAllByRole("row")[2].textContent).toContain("09.05 WIB");
    await userEvent.click(screen.getByRole("button", { name: "Catat hadir" }));
    expect(mutations["gatherings:checkIn"]).toHaveBeenCalledWith({ id: "g1", ownerId: "u3" });
    expect((await screen.findByRole("status")).textContent).toBe("Bima Sakti tercatat hadir.");
    expect(screen.getByRole("heading", { name: "Penjaga pintu" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Tutup check-in" }));
    expect(mutations["gatherings:setStatus"]).toHaveBeenCalledWith({ id: "g1", status: "closed" });
    await accessible(container);
  });

  it("gives a door helper the lists and manual check-in, but not the controls, helpers or CSV", () => {
    show(<GatheringDetail id="g1" />, { role: "member", doorHelper: true });
    expect(screen.getByRole("button", { name: "Catat hadir" })).toBeTruthy();
    for (const name of ["Tutup check-in", "Unduh CSV", "Batalkan kehadiran Rania Putri"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Penjaga pintu" })).toBeNull();
  });
});
