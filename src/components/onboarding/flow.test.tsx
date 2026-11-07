import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { OnboardingFlow } from "./flow";
import { EducationCombobox } from "./education-combobox";
import { campusOptions } from "@/lib/education-options";
import { communityLinks } from "@/lib/community";
import { onboardingDestination, stepAfter, type OnboardingStep, type OnboardingValues } from "@/lib/onboarding";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
const viewer = { name: "Nama Google", email: "onboarding@example.com" };
const base: Doc<"memberProfiles"> = { _id: "member-test" as Id<"memberProfiles">, _creationTime: 1, ownerId: "test-user", fullName: "Nama Baru", campus: "IPB University", studyProgram: "Ilmu Komputer", nextStep: 2, revision: 1, updatedAt: 1 };
function gateway() {
  return vi.fn(async ({ step, revision, values }: { step: OnboardingStep; revision: number; values: OnboardingValues }) => ({
    ...base, ...values, nextStep: stepAfter(step), revision: revision + 1, ...(step === 5 ? { completedAt: 100, memberType: "member" as const } : {}),
  }));
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("accessible member onboarding", () => {
  it.each([1, 2, 4, 5] as const)("has accessible form and navigation semantics on screen %i", async (step) => {
    const { container } = render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: step }} save={gateway()} onComplete={vi.fn()} />);
    const audit = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
      // JSDOM has no rendered pixels; color contrast is checked separately from CSS colors.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(audit.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("greets an accepted program participant and asks for a school or a campus", () => {
    const invitation = { cohort: "GDGoC Catalyst 2026/27", role: "Hustler" };
    const { unmount } = render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 1 }} save={gateway()} invitation={invitation} onComplete={vi.fn()} />);
    expect(screen.getByText(/Kamu terdaftar sebagai peserta GDGoC Catalyst 2026\/27, peran Hustler\./)).toBeTruthy();
    unmount();
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 2 }} save={gateway()} invitation={invitation} onComplete={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Dari sekolah atau\nkampus mana?");
    expect(screen.getByRole("combobox", { name: /Sekolah atau kampus/ })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /Jurusan atau program studi/ })).toBeTruthy();
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

  it("completes four screens without a role choice and makes both invitations optional", async () => {
    const save = gateway(); const complete = vi.fn(); const user = userEvent.setup();
    render(<OnboardingFlow viewer={viewer} profile={null} save={save} onComplete={complete} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["01 Kenalan", "02 Kampus", "03 WhatsApp", "04 Jadi member"]);
    expect(screen.getByText(/LANGKAH 01 DARI 04/)).toBeTruthy();
    expect(screen.getByText("4 langkah singkat.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    await waitFor(() => expect(document.activeElement?.id).toBe("onboard-title"));
    fireEvent.change(screen.getByRole("combobox", { name: /Kampus/ }), { target: { value: "Kampus Baru" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Program studi/ }), { target: { value: "Prodi Baru" } });
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    expect(await screen.findByRole("link", { name: /Gabung grup WhatsApp/ })).toHaveProperty("href", communityLinks.whatsapp);
    expect(screen.getByText(/LANGKAH 03 DARI 04/)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Kembali/ }));
    expect((screen.getByRole("combobox", { name: /Kampus/ }) as HTMLInputElement).value).toBe("Kampus Baru");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    await user.click(await screen.findByRole("button", { name: "Lanjut" }));
    const link = await screen.findByRole("link", { name: /Gabung di GDG Community/ });
    expect(link.getAttribute("href")).toBe(communityLinks.membership);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByText(/LANGKAH 04 DARI 04/)).toBeTruthy();
    expect(complete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Selesai, ke Dashboard/ }));
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(save.mock.calls.map(([args]) => args.step)).toEqual([1, 2, 2, 4, 5]);
    for (const [args] of save.mock.calls) expect(Object.keys(args.values).sort()).toEqual(["campus", "fullName", "studyProgram"]);
  });

  it("moves a profile saved on the removed role screen on to the WhatsApp screen", async () => {
    const save = gateway(); const user = userEvent.setup();
    render(<OnboardingFlow viewer={viewer} profile={{ ...base, nextStep: 3, revision: 2 }} save={save} onComplete={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Gabung grup WhatsApp/ })).toBeTruthy();
    expect(screen.getByText(/LANGKAH 03 DARI 04/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(await screen.findByRole("link", { name: /Gabung di GDG Community/ })).toBeTruthy();
    expect(save.mock.calls[0][0]).toMatchObject({ step: 4, revision: 2 });
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
    expect(onboardingDestination("league", "abcdefghijABCDEFGHIJ_-")).toBe("/league/daftar?undangan=abcdefghijABCDEFGHIJ_-");
    expect(onboardingDestination("league", "x&next=https://malicious.example/")).toBe("/league/daftar");
    expect(onboardingDestination(null, "abcdefghijABCDEFGHIJ_-")).toBe("/dashboard");
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
    expect(await screen.findByRole("link", { name: /Gabung grup WhatsApp/ })).toBeTruthy();
    expect(save).toHaveBeenCalledOnce();
  });
});
