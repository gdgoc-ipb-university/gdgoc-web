import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { instagramChangedLabel } from "@/lib/profile-edit";
import { MemberDetail } from "./member-detail";
import { ViewerContext, type DashboardViewer } from "./viewer";

type Member = NonNullable<FunctionReturnType<typeof api.dashboard.member>>;
const instagramChangedAt = Date.UTC(2026, 10, 12, 3);
const member: Member = {
  ownerId: "u1", fullName: "Rania Putri", campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "rania", instagramChangedAt, institutionKind: "campus", revision: 4,
  email: "rania@example.com", role: "member", active: true, joinedAt: Date.UTC(2026, 8, 1), memberType: "member", division: null, reviewer: false, techSupportHandler: false,
  tagConfirmed: false, reviewsByTag: false, card: null, photo: null, photoUploaded: false, accessUpdatedBy: null, submissions: [], appreciations: [], drafts: 0, reviewing: [], discord: null,
};
const mocks = vi.hoisted(() => ({ member: null as unknown, correct: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (query: FunctionReference<"query">) => getFunctionName(query) === "dashboard:member" ? mocks.member : undefined,
  useMutation: (mutation: FunctionReference<"mutation">) => getFunctionName(mutation) === "dashboard:correctProfile" ? mocks.correct : vi.fn(async () => null),
  usePaginatedQuery: () => ({ status: "Exhausted", results: [], loadMore: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/dashboard/anggota/u1", useSearchParams: () => new URLSearchParams() }));
beforeEach(() => {
  mocks.member = member;
  mocks.correct = vi.fn(async ({ revision }: { revision: number }) => ({ revision: revision + 1 }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const viewer = (role: DashboardViewer["role"], id = "me"): DashboardViewer => ({
  id: id as DashboardViewer["id"], name: "Saya", email: "me@example.com", role, active: true, onboarded: true, reviewer: true, memberType: null, division: null, tagConfirmed: false,
  campus: "", studyProgram: "", instagram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false,
});
const show = (role: DashboardViewer["role"] = "admin", id = "me") => render(<ViewerContext.Provider value={viewer(role, id)}><MemberDetail ownerId="u1" /></ViewerContext.Provider>);
const correction = () => screen.queryByRole("region", { name: "Koreksi profil" });

describe("Koreksi profil on the member page (#235)", () => {
  it("lets an admin correct a member's answers with the profile form, then closes it with a note", async () => {
    const user = userEvent.setup();
    const { container } = show();
    await user.click(within(correction()!).getByRole("button", { name: "Koreksi profil" }));
    const form = within(correction()!);
    const name = form.getByRole("textbox", { name: /^Nama/ }) as HTMLInputElement;
    expect(name.value).toBe("Rania Putri");
    expect(form.getByText(/Nama ini dicetak di kartu anggota/)).toBeTruthy();
    expect((form.getByRole("radio", { name: "Mahasiswa" }) as HTMLInputElement).checked).toBe(true);
    expect((form.getByRole("combobox", { name: /^Kampus/ }) as HTMLInputElement).value).toBe("IPB University");
    const audit = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(audit.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
    await user.clear(name);
    await user.type(name, "Rania  Putri Lestari");
    await user.click(form.getByRole("button", { name: "Simpan koreksi" }));
    await waitFor(() => expect(within(correction()!).getByRole("status").textContent).toBe("Profil Rania Putri sudah dikoreksi."));
    expect(mocks.correct).toHaveBeenCalledWith({ ownerId: "u1", revision: 4, values: { fullName: "Rania Putri Lestari", institutionKind: "campus", campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "rania" } });
    expect(within(correction()!).queryByRole("textbox")).toBeNull();
  });

  it("keeps the form open with the reason when the server refuses, and closes on Batal", async () => {
    mocks.correct = vi.fn(async () => { throw Object.assign(new Error("refused"), { data: "Hanya pemilik yang bisa mengelola akun admin." }); });
    const user = userEvent.setup();
    show();
    await user.click(within(correction()!).getByRole("button", { name: "Koreksi profil" }));
    await user.click(within(correction()!).getByRole("button", { name: "Simpan koreksi" }));
    expect((await within(correction()!).findByRole("alert")).textContent).toBe("Hanya pemilik yang bisa mengelola akun admin.");
    await user.click(within(correction()!).getByRole("button", { name: "Batal" }));
    expect(within(correction()!).queryByRole("textbox")).toBeNull();
    expect(within(correction()!).getByRole("status").textContent).toBe("");
  });

  it("is offered only where the server allows it: members for admins, admins too for owners, never owners or oneself", () => {
    show("admin");
    expect(correction()).not.toBeNull();
    cleanup();
    mocks.member = { ...member, role: "admin" };
    show("admin");
    expect(correction()).toBeNull();
    cleanup();
    show("owner");
    expect(correction()).not.toBeNull();
    cleanup();
    mocks.member = { ...member, role: "owner" };
    show("owner");
    expect(correction()).toBeNull();
    cleanup();
    mocks.member = member;
    show("admin", "u1");
    expect(correction()).toBeNull();
  });

  it("says when the member last changed their Instagram username", () => {
    show();
    const label = screen.getByText(instagramChangedLabel(instagramChangedAt));
    expect(label.closest("dd")?.textContent).toBe(`@rania${instagramChangedLabel(instagramChangedAt)}`);
    cleanup();
    mocks.member = { ...member, instagramChangedAt: null };
    show();
    expect(screen.queryByText(/^Instagram diubah/)).toBeNull();
  });
});

describe("Discord on the member page (#242)", () => {
  const fact = () => screen.getByText("Discord", { selector: "dt" }).parentElement!;
  it("says when a member hasn't linked Discord", () => {
    show();
    expect(within(fact()).getByRole("definition").textContent).toBe("Belum terhubung");
  });

  it("shows the username, the link date and the server join, with why it failed", () => {
    mocks.member = { ...member, discord: { username: "raniaputri", linkedAt: Date.UTC(2026, 10, 12, 3), joinStatus: "failed", lastError: "Akun Discord ini diblokir dari server GDGoC IPB. Hubungi pengurus." } };
    show();
    expect(within(fact()).getByText("raniaputri")).toBeTruthy();
    expect(within(fact()).getByText("Terhubung 12 November 2026")).toBeTruthy();
    expect(within(fact()).getByText("Belum masuk server")).toBeTruthy();
    expect(within(fact()).getByText(/diblokir dari server/)).toBeTruthy();
  });
});
