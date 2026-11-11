import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { ProfilePage } from "./profile";
import { ViewerContext, type DashboardViewer } from "./viewer";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

const profile: Doc<"memberProfiles"> = {
  _id: "profile-test" as Id<"memberProfiles">, _creationTime: 1, ownerId: "me", fullName: "Rania Putri", campus: "IPB University", studyProgram: "Ilmu Komputer",
  institutionKind: "campus", instagram: "rania.putri", nextStep: 6, revision: 6, updatedAt: 1, completedAt: 1, memberType: "member",
};
const mocks = vi.hoisted(() => ({ profile: null as unknown, updateProfile: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (query: FunctionReference<"query">) => getFunctionName(query) === "members:profile" ? mocks.profile : [],
  useMutation: (mutation: FunctionReference<"mutation">) => getFunctionName(mutation) === "members:updateProfile" ? mocks.updateProfile : vi.fn(async () => null),
}));
beforeEach(() => {
  mocks.profile = profile;
  mocks.updateProfile = vi.fn(async ({ values, revision }) => ({ ...profile, ...values, revision: revision + 1 }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const base: DashboardViewer = {
  id: "me" as DashboardViewer["id"], name: "Rania Putri", email: "rania@example.com", role: "member", active: true, onboarded: true, reviewer: false,
  memberType: "member", division: null, tagConfirmed: false, campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "", doorHelper: false, techSupportHandler: false,
  photo: null, photoUploaded: false,
};
const page = (viewer: Partial<DashboardViewer> = {}) => render(<ViewerContext.Provider value={{ ...base, ...viewer }}><ProfilePage /></ViewerContext.Provider>);
const panel = (viewer: Partial<DashboardViewer> = {}) => { page(viewer); return screen.getByRole("region", { name: "Peran komunitas" }); };
const form = () => screen.getByRole("region", { name: "Ubah profil" });
const field = (name: RegExp) => within(form()).getByRole("textbox", { name }) as HTMLInputElement;
const combo = (name: RegExp) => within(form()).getByRole("combobox", { name }) as HTMLInputElement;

describe("community tag on the profile", () => {
  it("shows a member their tag without a way to change it", () => {
    const role = panel();
    expect(within(role).getByText("Member")).toBeTruthy();
    expect(within(role).getByText("Peran dan divisi diatur oleh pengurus. Hubungi admin jika perlu diubah.")).toBeTruthy();
    expect(within(role).queryByRole("radio")).toBeNull();
    expect(within(role).queryByRole("button")).toBeNull();
    expect(within(role).queryByText(/dikonfirmasi/)).toBeNull();
  });

  it("shows a staff-assigned Core Team tag with its division as confirmed", () => {
    const role = panel({ memberType: "core", division: "Media & Creative", tagConfirmed: true });
    expect(within(role).getByText("Core Team · Media & Creative")).toBeTruthy();
    expect(within(role).getByText("Dikonfirmasi pengurus")).toBeTruthy();
  });

  it("marks a self-declared Core Team tag from before as not yet confirmed", () => {
    const role = panel({ memberType: "core", division: "Technical" });
    expect(within(role).getByText("Core Team · Technical")).toBeTruthy();
    expect(within(role).getByText("Belum dikonfirmasi pengurus")).toBeTruthy();
  });
});

describe("Ubah profil (#235)", () => {
  it("fills the form with the onboarding answers, says the name is printed on the card, and has no admin-only line", async () => {
    const { container } = page();
    expect(field(/^Nama kamu/).value).toBe("Rania Putri");
    expect((within(form()).getByRole("radio", { name: "Mahasiswa" }) as HTMLInputElement).checked).toBe(true);
    expect(combo(/^Kampus/).value).toBe("IPB University");
    expect(combo(/^Program studi/).value).toBe("Ilmu Komputer");
    expect(field(/^Username Instagram/).value).toBe("rania.putri");
    expect(field(/^Nama kamu/).getAttribute("aria-describedby")).toBe("profile-fullName-hint");
    expect(screen.getByText(/Nama ini dicetak di kartu anggota/)).toBeTruthy();
    expect(screen.queryByText(/Hubungi admin jika perlu mengoreksinya/)).toBeNull();
    // Email and access are shown, not edited.
    expect(within(form()).queryByDisplayValue("rania@example.com")).toBeNull();
    expect(screen.getByText("rania@example.com")).toBeTruthy();
    const audit = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(audit.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("saves the answers normalised, against the profile's revision, and says it saved", async () => {
    const user = userEvent.setup();
    page();
    await user.clear(field(/^Nama kamu/));
    await user.type(field(/^Nama kamu/), "  Rania   Putri Lestari ");
    await user.clear(field(/^Username Instagram/));
    await user.type(field(/^Username Instagram/), "@Rania.Lestari");
    await user.click(within(form()).getByRole("button", { name: "Simpan profil" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Profil tersimpan."));
    expect(mocks.updateProfile).toHaveBeenCalledWith({ revision: 6, values: { fullName: "Rania Putri Lestari", institutionKind: "campus", campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "rania.lestari" } });
    expect(field(/^Nama kamu/).value).toBe("Rania Putri Lestari");
    // The next save goes against the revision that came back, and typing clears the saved note.
    await user.type(field(/^Nama kamu/), "!");
    expect(screen.getByRole("status").textContent).toBe("");
    await user.click(within(form()).getByRole("button", { name: "Simpan profil" }));
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 7 })));
  });

  it("shows onboarding's field errors and focuses the first, without saving", async () => {
    const user = userEvent.setup();
    page();
    await user.clear(field(/^Nama kamu/));
    await user.clear(field(/^Username Instagram/));
    await user.type(field(/^Username Instagram/), "nama..kamu");
    await user.click(within(form()).getByRole("button", { name: "Simpan profil" }));
    expect(screen.getByText("Isi nama yang ingin kamu pakai.")).toBeTruthy();
    expect(screen.getByText(/Username Instagram hanya berisi huruf/)).toBeTruthy();
    expect(document.activeElement).toBe(field(/^Nama kamu/));
    expect(field(/^Nama kamu/).getAttribute("aria-invalid")).toBe("true");
    expect(field(/^Nama kamu/).getAttribute("aria-describedby")).toBe("profile-fullName-hint profile-fullName-error");
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("switches between campus and school with onboarding's picker, clearing the answers and restoring the saved ones", async () => {
    const user = userEvent.setup();
    page();
    await user.click(within(form()).getByRole("radio", { name: "Siswa SMA/SMK" }));
    expect(combo(/^Sekolah/).value).toBe("");
    expect(combo(/^Jurusan/).value).toBe("");
    await user.click(within(form()).getByRole("button", { name: "Simpan profil" }));
    expect(screen.getByText("Isi atau pilih nama sekolahmu.")).toBeTruthy();
    expect(document.activeElement).toBe(combo(/^Sekolah/));
    // Focus opens the list, which hides the rest of the page from assistive tech until focus moves on.
    await user.keyboard("{Escape}");
    await user.click(field(/^Nama kamu/));
    fireEvent.change(combo(/^Sekolah/), { target: { value: "SMKN 1 Bogor" } });
    fireEvent.change(combo(/^Jurusan/), { target: { value: "Rekayasa Perangkat Lunak" } });
    await user.click(within(form()).getByRole("radio", { name: "Mahasiswa" }));
    expect(combo(/^Kampus/).value).toBe("IPB University");
    await user.click(within(form()).getByRole("radio", { name: "Siswa SMA/SMK" }));
    fireEvent.change(combo(/^Sekolah/), { target: { value: "SMKN 1 Bogor" } });
    fireEvent.change(combo(/^Jurusan/), { target: { value: "Rekayasa Perangkat Lunak" } });
    await user.click(within(form()).getByRole("button", { name: "Simpan profil" }));
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ revision: 6, values: expect.objectContaining({ institutionKind: "school", campus: "SMKN 1 Bogor", studyProgram: "Rekayasa Perangkat Lunak" }) }));
  });

  it("asks a profile saved before the kind was asked to keep it as a campus, and shows a refused save", async () => {
    mocks.profile = { ...profile, institutionKind: undefined };
    mocks.updateProfile = vi.fn(async () => { throw Object.assign(new Error("refused"), { data: "Profil berubah di tab atau perangkat lain. Muat ulang halaman untuk memakai versi terbaru." }); });
    const user = userEvent.setup();
    page();
    expect((within(form()).getByRole("radio", { name: "Mahasiswa" }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(form()).getByRole("button", { name: "Simpan profil" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Profil berubah di tab atau perangkat lain. Muat ulang halaman untuk memakai versi terbaru.");
    expect(screen.getByRole("status").textContent).toBe("");
    expect(field(/^Nama kamu/).value).toBe("Rania Putri");
  });
});
