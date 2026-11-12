import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { OnboardingFlow } from "./flow";
import { EducationCombobox } from "./education-combobox";
import { campusOptions } from "@/lib/education-options";
import { communityLinks } from "@/lib/community";
import { onboardingDestination, stepAfter, techSupportRequestPath, type OnboardingStep, type OnboardingValues } from "@/lib/onboarding";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
const viewer = { name: "Nama Google", email: "onboarding@example.com" };
const base: Doc<"memberProfiles"> = { _id: "member-test" as Id<"memberProfiles">, _creationTime: 1, ownerId: "test-user", fullName: "Nama Baru", campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "teman.uji", nextStep: 2, revision: 1, updatedAt: 1 };
function gateway() {
  return vi.fn(async ({ step, revision, values }: { step: OnboardingStep; revision: number; values: OnboardingValues }) => ({
    ...base, ...values, nextStep: stepAfter(step), revision: revision + 1, ...(step === 6 ? { completedAt: 100, memberType: "member" as const } : {}),
  }));
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("accessible member onboarding", () => {
  it.each([1, 2, 3, 4, 5, 6] as const)("has accessible form and navigation semantics on screen %i", async (step) => {
    const { container } = render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: step }} save={gateway()} onComplete={vi.fn()} />);
    const audit = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
      // JSDOM has no rendered pixels; color contrast is checked separately from CSS colors.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(audit.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("greets an accepted program participant on the first screen", () => {
    const invitation = { cohort: "GDGoC Catalyst 2026/27", role: "Hustler" };
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 1 }} save={gateway()} invitation={invitation} onComplete={vi.fn()} />);
    expect(screen.getByText(/Kamu terdaftar sebagai peserta GDGoC Catalyst 2026\/27, peran Hustler\./)).toBeTruthy();
  });

  it("asks campus or school first, then names the fields and clears answers when the choice changes", async () => {
    const save = gateway(); const user = userEvent.setup();
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 2, campus: "", studyProgram: "" }} save={save} onComplete={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Dari sekolah atau\nkampus mana?");
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(screen.getByText("Pilih kamu mahasiswa atau siswa SMA/SMK.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /Mahasiswa/ }));
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: /Siswa SMA\/SMK/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /^Sekolah/ }), { target: { value: "SMK Uji Coba" } });
    fireEvent.change(screen.getByRole("combobox", { name: /^Jurusan/ }), { target: { value: "Rekayasa Perangkat Lunak" } });
    await user.click(screen.getByRole("radio", { name: /Mahasiswa/ }));
    expect((screen.getByRole("combobox", { name: /^Kampus/ }) as HTMLInputElement).value).toBe("");
    await user.click(screen.getByRole("radio", { name: /Siswa SMA\/SMK/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /^Sekolah/ }), { target: { value: "SMK Uji Coba" } });
    fireEvent.change(screen.getByRole("combobox", { name: /^Jurusan/ }), { target: { value: "Rekayasa Perangkat Lunak" } });
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].values).toEqual({ fullName: base.fullName, campus: "SMK Uji Coba", studyProgram: "Rekayasa Perangkat Lunak", institutionKind: "school", instagram: "teman.uji" });
  });

  it("suggests SMK majors by their old short names", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 2, campus: "", studyProgram: "" }} save={gateway()} onComplete={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: /Siswa SMA\/SMK/ }));
    const program = screen.getByRole("combobox", { name: /^Jurusan/ });
    await user.click(program); await user.type(program, "TKJ");
    expect(await screen.findByRole("option", { name: "Teknik Komputer dan Jaringan" })).toBeTruthy();
    await user.clear(program); await user.type(program, "IPA");
    expect(await screen.findByRole("option", { name: "MIPA" })).toBeTruthy();
  });

  it("keeps blank-name errors tied to the input and retains edits after a failed save", async () => {
    const save = gateway(); save.mockRejectedValueOnce(new Error("Koneksi terputus"));
    render(<OnboardingFlow viewer={viewer} profile={null} save={save} onComplete={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /Nama kamu/ });
    fireEvent.change(input, { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("name-error");
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Nama Pilihan" } });
    await userEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("Nama Pilihan");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Kenalan dulu, yuk.");
  });

  it("completes six screens, requires Instagram, and makes the invitations and Tech Support optional", async () => {
    const save = gateway(); const complete = vi.fn(); const user = userEvent.setup();
    render(<OnboardingFlow viewer={viewer} profile={null} save={save} onComplete={complete} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["01 Kenalan", "02 Sekolah/kampus", "03 Instagram", "04 Komunitas", "05 Jadi member", "06 Tech Support"]);
    expect(screen.getByText(/LANGKAH 01 DARI 06/)).toBeTruthy();
    expect(screen.getByText("6 langkah singkat.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    await waitFor(() => expect(document.activeElement?.id).toBe("onboard-title"));
    await user.click(screen.getByRole("radio", { name: /Mahasiswa/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /Kampus/ }), { target: { value: "Kampus Baru" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Program studi/ }), { target: { value: "Prodi Baru" } });
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    // Screen 3: the username is required, with the follow and twibbon requirements and the warning beside it.
    const username = await screen.findByRole("textbox", { name: /Username Instagram/ });
    expect(screen.getByText(/LANGKAH 03 DARI 06/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Follow @gdgoc.ipb/ }).getAttribute("href")).toBe(communityLinks.instagram);
    expect(screen.getByRole("link", { name: /Buat twibbon/ }).getAttribute("href")).toBe("/twibbon");
    expect(screen.getByText(/Core team akan mengecek akun ini/).textContent).toMatch(/30 November/);
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(screen.getByText("Isi username Instagram-mu.")).toBeTruthy();
    expect(document.activeElement).toBe(username);
    await user.type(username, "@Teman.Uji");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    expect(await screen.findByRole("link", { name: /Gabung grup WhatsApp/ })).toHaveProperty("href", communityLinks.whatsapp);
    expect(screen.getByText(/LANGKAH 04 DARI 06/)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Kembali/ }));
    expect((screen.getByRole("textbox", { name: /Username Instagram/ }) as HTMLInputElement).value).toBe("teman.uji");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    await user.click(await screen.findByRole("button", { name: "Lanjut" }));
    const link = await screen.findByRole("link", { name: /Gabung di GDG Community/ });
    expect(link.getAttribute("href")).toBe(communityLinks.membership);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByText(/LANGKAH 05 DARI 06/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(await screen.findByText(/LANGKAH 06 DARI 06/)).toBeTruthy();
    expect((screen.getByRole("radio", { name: /Nanti saja/ }) as HTMLInputElement).checked).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Selesai, ke Dashboard/ }));
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(complete).toHaveBeenCalledWith(undefined);
    expect(save.mock.calls.map(([args]) => args.step)).toEqual([1, 2, 3, 3, 4, 5, 6]);
    expect(save.mock.calls[2][0].values).toMatchObject({ instagram: "teman.uji" });
    for (const [args] of save.mock.calls.slice(1)) expect(args.values).toMatchObject({ institutionKind: "campus" });
  });

  it("shows WhatsApp and Discord side by side on the community screen, both skippable (#242)", async () => {
    const save = gateway(); const user = userEvent.setup();
    const discord = <div className="onboard-invitation"><strong>Server Discord GDGoC IPB</strong><button type="button">Hubungkan Discord</button></div>;
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 4, revision: 3 }} save={save} onComplete={vi.fn()} discord={discord} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Gabung ke\nkomunitas.");
    expect(screen.getByText(/WhatsApp dan server Discord GDGoC IPB dipakai bersama/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gabung grup WhatsApp/ })).toBeTruthy();
    // Connecting Discord leaves for Discord; it never submits the screen.
    await user.click(screen.getByRole("button", { name: "Hubungkan Discord" }));
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(await screen.findByText(/LANGKAH 05 DARI 06/)).toBeTruthy();
    expect(save.mock.calls[0][0]).toMatchObject({ step: 4 });
  });

  it("opens the community screen again when Discord sends a member back, even past it", () => {
    const { unmount } = render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 6, revision: 5 }} save={gateway()} onComplete={vi.fn()} startOnCommunity />);
    expect(screen.getByText(/LANGKAH 04 DARI 06/)).toBeTruthy();
    unmount();
    // A member who hasn't reached it yet stays where they were.
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 2, revision: 1 }} save={gateway()} onComplete={vi.fn()} startOnCommunity />);
    expect(screen.getByText(/LANGKAH 02 DARI 06/)).toBeTruthy();
  });

  it("sends a member who asks for Tech Support straight to the request form", async () => {
    const complete = vi.fn(); const user = userEvent.setup();
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 6, revision: 5 }} save={gateway()} onComplete={complete} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Punya target\nlomba?");
    expect(screen.getByText("Review pitch deck")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /Ya, ajukan setelah ini/ }));
    await user.click(screen.getByRole("button", { name: /Selesai, ajukan Tech Support/ }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(techSupportRequestPath));
    expect(techSupportRequestPath).toBe("/dashboard/tech-support?ajukan=1");
  });

  it("sends a profile past screen 3 without Instagram back to it, and reads a pasted profile link", async () => {
    const save = gateway(); const user = userEvent.setup();
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, instagram: undefined, nextStep: 5, revision: 4 }} save={save} onComplete={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Follow & pasang\ntwibbon.");
    expect(screen.getByText(/LANGKAH 03 DARI 06/)).toBeTruthy();
    const username = screen.getByRole("textbox", { name: /Username Instagram/ });
    await user.type(username, "nama kamu");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(screen.getByText(/hanya berisi huruf, angka, titik, dan garis bawah/)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    await user.clear(username); await user.type(username, "https://www.instagram.com/Nama_Kamu/");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(await screen.findByRole("link", { name: /Gabung grup WhatsApp/ })).toBeTruthy();
    expect(save.mock.calls[0][0]).toMatchObject({ step: 3, revision: 4, values: { instagram: "nama_kamu" } });
  });

  it("supports keyboard search, selection, Escape and custom campus input without submitting", async () => {
    const submitted = vi.fn();
    function Field() { const [value, setValue] = useState(""); return <form onSubmit={(event) => { event.preventDefault(); submitted(); }}><EducationCombobox id="campus" label="Kampus" options={campusOptions} value={value} onChange={setValue} enterKeyHint="next"/><button>Berikutnya</button></form>; }
    render(<Field />); const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: /Kampus/ });
    await user.click(input); await user.type(input, "IPB");
    expect(await screen.findByRole("option", { name: "IPB University" })).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");
    expect((input as HTMLInputElement).value).toBe("IPB University");
    expect(submitted).not.toHaveBeenCalled();
    await user.clear(input); await user.type(input, "Kampus Tidak Terdaftar"); await user.keyboard("{Escape}{Tab}");
    expect((input as HTMLInputElement).value).toBe("Kampus Tidak Terdaftar");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.getAttribute("enterkeyhint")).toBe("next");
  });

  it("resumes a saved invitation and restricts completion redirects to local destinations", () => {
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 5, revision: 4 }} save={gateway()} onComplete={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Gabung di GDG Community/ })).toBeTruthy();
    expect(onboardingDestination("review")).toBe("/dashboard/apresiasi/tinjau");
    expect(onboardingDestination(null)).toBe("/dashboard");
    expect(onboardingDestination("league")).toBe("/league/daftar");
    expect(onboardingDestination("league", "abcd-2345")).toBe("/league/daftar?undangan=ABCD2345");
    expect(onboardingDestination("league", "abcdefghijABCDEFGHIJ_-")).toBe("/league/daftar");
    expect(onboardingDestination("league", "x&next=https://malicious.example/")).toBe("/league/daftar");
    expect(onboardingDestination("league", "ABCD2345&next=https://malicious.example/")).toBe("/league/daftar");
    expect(onboardingDestination(null, "ABCD2345")).toBe("/dashboard");
    expect(onboardingDestination("https://malicious.example/")).toBe("/dashboard");
    expect(onboardingDestination("javascript:alert(1)")).toBe("/dashboard");
  });

  it("moves to the program field with Next but permits a pointer submit while campus keeps focus", async () => {
    const save = gateway(); const user = userEvent.setup();
    render(<OnboardingFlow viewer={viewer} profile={base} save={save} onComplete={vi.fn()} />);
    const campus = screen.getByRole("combobox", { name: /Kampus/ });
    const program = screen.getByRole("combobox", { name: /Program studi/ });
    await user.click(campus); await user.keyboard("{Escape}{Enter}");
    expect(document.activeElement).toBe(program);
    expect(save).not.toHaveBeenCalled();
    await user.click(campus); await user.keyboard("{Escape}");
    // Unlike userEvent, fireEvent.click does not focus the button, matching iOS.
    fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(await screen.findByRole("textbox", { name: /Username Instagram/ })).toBeTruthy();
    expect(save).toHaveBeenCalledOnce();
  });
});
