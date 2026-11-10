import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { communityLinks } from "@/lib/community";
import { memberIntake } from "@/lib/member-intake";

// Each test is a new page load: the popup remembers, per load, that it has been shown.
async function pageLoad() {
  vi.resetModules();
  return (await import("./member-intake-popup")).MemberIntakePopup;
}
/** Long enough for the popup to decide and load its dialog, if it were going to. */
const settle = () => act(async () => {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  await new Promise((resolve) => setTimeout(resolve, 300));
});
const findDialog = () => screen.findByRole("dialog", { name: "Open recruitment member 2026/27" }, { timeout: 3000 });
const blocked = () => { throw new DOMException("Storage is blocked", "SecurityError"); };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T09:00:00+07:00"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("member intake popup", () => {
  it("opens during the intake with who can join, the dates, the steps and the links, over an inert page", async () => {
    const MemberIntakePopup = await pageLoad();
    const { container } = render(<><main><a href="/dashboard">Gabung member</a></main><MemberIntakePopup /></>);
    const dialog = await findDialog();

    expect(dialog.textContent).toContain("Terbuka untuk mahasiswa dari kampus mana pun dan siswa SMA/SMK, dari jurusan apa pun. Tanpa seleksi.");
    expect(dialog.textContent).toContain("10–30 November 2026");
    const steps = within(dialog).getAllByRole("listitem").map((step) => step.textContent);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain("Follow Instagram @gdgoc.ipb");
    expect(steps[1]).toContain("gdgocipb.com/twibbon");
    expect(steps[1]).toContain("dua slide di feed, bukan story, tag @gdgoc.ipb dan 3 teman");
    expect(steps[1]).toContain("#OprecMemberGDGOCIPB2627");
    expect(steps[1]).toContain("sampai 30 November 2026 berakhir");
    expect(steps[2]).toContain("akun Google, isi username Instagram, dan lengkapi perkenalan");
    expect(dialog.textContent).toContain("Core team akan mengecek follow dan twibbon-mu.");

    const link = (name: string) => within(dialog).getByRole("link", { name });
    expect(link("Daftar member").getAttribute("href")).toBe("/dashboard");
    expect(link("Buat twibbon").getAttribute("href")).toBe("/twibbon");
    expect(link("Baca guidebook").getAttribute("href")).toBe("/gb-member");
    expect(link("Baca guidebook").getAttribute("target")).toBe("_blank");
    expect(link("@gdgoc.ipb").getAttribute("href")).toBe(communityLinks.instagram);
    expect(within(dialog).getByRole("button", { name: "Tutup" })).toBeTruthy();

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(container.inert || container.getAttribute("aria-hidden") === "true").toBe(true);
    const result = await axe.run(document.body, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("closes with Tutup, gives focus back, and stays closed in this browser", async () => {
    const user = userEvent.setup();
    const MemberIntakePopup = await pageLoad();
    const { container, unmount } = render(<><button type="button">Sebelumnya</button><MemberIntakePopup /></>);
    const before = screen.getByRole("button", { name: "Sebelumnya" });
    before.focus();
    await user.click(within(await findDialog()).getByRole("button", { name: "Tutup" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(before));
    expect(container.inert || container.getAttribute("aria-hidden") === "true").toBe(false);
    expect(localStorage.getItem(memberIntake.seenKey)).not.toBeNull();
    unmount();

    const NextVisit = await pageLoad();
    render(<NextVisit />);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes with Escape and remembers it", async () => {
    const user = userEvent.setup();
    const MemberIntakePopup = await pageLoad();
    render(<MemberIntakePopup />);
    await findDialog();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(memberIntake.seenKey)).not.toBeNull();
  });

  it("closes and remembers it when the visitor goes to register", async () => {
    const user = userEvent.setup();
    const MemberIntakePopup = await pageLoad();
    render(<MemberIntakePopup />);
    const dialog = await findDialog();
    const stay = (event: Event) => event.preventDefault(); // jsdom cannot navigate; the link's own click handler still runs
    document.addEventListener("click", stay, { capture: true });
    await user.click(within(dialog).getByRole("link", { name: "Daftar member" }));
    document.removeEventListener("click", stay, { capture: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(memberIntake.seenKey)).not.toBeNull();
  });

  it("opens from 00:00 WIB on 10 November to the end of 30 November WIB, and not outside it", async () => {
    for (const [at, opens] of [["2026-11-09T23:59:59+07:00", false], ["2026-11-10T00:00:00+07:00", true], ["2026-11-30T23:59:59+07:00", true], ["2026-12-01T00:00:00+07:00", false]] as const) {
      vi.setSystemTime(new Date(at));
      const MemberIntakePopup = await pageLoad();
      render(<MemberIntakePopup />);
      if (opens) await findDialog();
      else await settle();
      expect(screen.queryByRole("dialog") !== null, at).toBe(opens);
      cleanup();
    }
  });

  it("waits until it is ready", async () => {
    const MemberIntakePopup = await pageLoad();
    const { rerender } = render(<MemberIntakePopup ready={false} />);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<MemberIntakePopup ready />);
    await findDialog();
  });

  it("shows once per page load when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    const user = userEvent.setup();
    const MemberIntakePopup = await pageLoad();
    const { unmount } = render(<MemberIntakePopup />);
    await user.click(within(await findDialog()).getByRole("button", { name: "Tutup" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    unmount();

    render(<MemberIntakePopup />); // back on the landing without a reload
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();

    const Reloaded = await pageLoad();
    render(<Reloaded />);
    await findDialog();
  });
});
