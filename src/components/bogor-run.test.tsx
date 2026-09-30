import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BogorRun } from "./bogor-run";
import type { Board, Saved } from "@/lib/bogor-run/online";
import type { FinishedRun, RunnerOptions, Snapshot } from "@/lib/bogor-run/runtime";

const game = vi.hoisted(() => ({
  mount: vi.fn(), action: vi.fn(), duck: vi.fn(), setFocused: vi.fn(), dispose: vi.fn(), setReduced: vi.fn(), setVisible: vi.fn(),
  toggleAutoplay: vi.fn(), leave: vi.fn(), unlock: vi.fn(), setSound: vi.fn(), adopt: vi.fn(), restore: vi.fn(),
}));
const online = vi.hoisted(() => ({
  prefetchTicket: vi.fn(), takeTicket: vi.fn(), ticketPending: vi.fn(), keepTicketFresh: vi.fn(), signedIn: vi.fn(), submitRun: vi.fn(), leaderboard: vi.fn(),
  signInToSave: vi.fn(), takePendingRun: vi.fn(),
}));
const stopTickets = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bogor-run/runtime", () => ({ mountRunner: game.mount }));
vi.mock("@/lib/bogor-run/online", () => online);
vi.mock("./experience-provider", () => ({ useExperience: () => ({ animated: true }) }));

let publish: (snapshot: Snapshot) => void;
let hooks: RunnerOptions;
let visibility: IntersectionObserverCallback;
const running: Snapshot = { phase: "running", score: 12, best: 20, message: "", autoplay: false, flash: 0, sound: true, finished: false, countdown: 0 };
const over: Snapshot = { ...running, phase: "over", score: 42, best: 42, message: "Angkot duluan!" };
const finished: FinishedRun = { seed: 7, token: "signed", inputs: [120, 1], endTick: 480, score: 42 };
const week = (signedIn = false): Board => ({
  key: "2026-09-28", signedIn,
  entries: [
    { id: "a" as Board["entries"][number]["id"], rank: 1, name: "Cici L.", score: 677, you: false },
    { id: "b" as Board["entries"][number]["id"], rank: 2, name: "Bima S.", score: 57, you: signedIn },
    { id: "c" as Board["entries"][number]["id"], rank: 2, name: "Rania P.", score: 57, you: false },
  ],
  you: signedIn ? { rank: 2, score: 57, hidden: false } : null,
});
const allTime: Board = { key: "all", signedIn: true, entries: [{ id: "d" as Board["entries"][number]["id"], rank: 1, name: "Dimas W.", score: 4210, you: false }], you: { rank: 23, score: 1210, hidden: false } };
const saved: Saved = { ok: true, score: 42, week: { key: "2026-09-28", best: 42, rank: 3, improved: true }, all: { best: 1204, rank: 17, improved: false } };

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
  game.mount.mockImplementation(async (_canvas, callback, _reduced, options) => { publish = callback; hooks = options; return game; });
  game.action.mockReturnValue("start");
  online.prefetchTicket.mockResolvedValue(null);
  online.takeTicket.mockReturnValue(null);
  online.ticketPending.mockReturnValue(false);
  online.keepTicketFresh.mockReturnValue(stopTickets);
  online.signedIn.mockResolvedValue(false);
  online.leaderboard.mockImplementation(async (period: string) => period === "all" ? allTime : week());
  online.submitRun.mockResolvedValue(saved);
  online.signInToSave.mockResolvedValue({ error: "Belum bisa membuka Google login." });
  online.takePendingRun.mockReturnValue(null);
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { visibility = callback; }
    observe() { queueMicrotask(() => visibility([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], this as unknown as IntersectionObserver)); }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function ready() {
  const button = screen.getByRole("button", { name: "Ikut main: Bogor Run" });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  return button;
}
const announcements = () => screen.getAllByRole("status").map((region) => region.textContent).join(" | ");

describe("footer game controls", () => {
  it("starts explicitly and scopes jump and duck keys to the game, without repeated-key jumps or a pause key", async () => {
    render(<><BogorRun/><button>Di luar game</button></>);
    const user = userEvent.setup(); const stage = await ready();
    expect(game.action).not.toHaveBeenCalled();
    await user.click(stage); expect(game.action).toHaveBeenCalledOnce();
    expect(online.keepTicketFresh).toHaveBeenCalledOnce(); // a ticket stays ready for every run and restart
    online.ticketPending.mockReturnValue(true);
    expect(hooks.ticketPending?.()).toBe(true); // a run started without one waits a moment for it
    act(() => publish(running));
    game.action.mockReturnValue("jump");
    await user.keyboard(" "); expect(game.action).toHaveBeenCalledTimes(2);
    await user.keyboard("{ArrowUp}"); expect(game.action).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(stage, { key: " ", repeat: true }); expect(game.action).toHaveBeenCalledTimes(3);
    await user.keyboard("{ArrowDown>}");
    expect(game.duck).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(stage, { key: "ArrowDown", repeat: true }); expect(game.duck).toHaveBeenCalledOnce();
    await user.keyboard("{/ArrowDown}");
    expect(game.duck).toHaveBeenLastCalledWith(false);
    // P and Esc no longer do anything: a run can't be paused.
    expect(fireEvent.keyDown(stage, { key: "p" })).toBe(true);
    expect(fireEvent.keyDown(stage, { key: "Escape" })).toBe(true);
    expect(game.unlock).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Di luar game" }));
    expect(game.setFocused).toHaveBeenLastCalledWith(false); // focus leaving the game interrupts the run
    expect(game.duck).toHaveBeenLastCalledWith(false); // a crouch never outlives focus
    await user.keyboard(" "); expect(game.action).toHaveBeenCalledTimes(3);
  });

  it("splits the arena into a jump zone above and a hold-to-duck zone below", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: coarse)", addEventListener() {}, removeEventListener() {} }));
    render(<BogorRun/>); await ready();
    act(() => publish(running));
    const arena = screen.getByRole("button", { name: /^Arena Bogor Run/ });
    vi.spyOn(arena, "getBoundingClientRect").mockReturnValue({ top: 100, height: 400 } as DOMRect);
    game.action.mockReturnValue("jump");
    fireEvent.pointerDown(arena, { pointerId: 1, pointerType: "touch", clientY: 150 });
    fireEvent.pointerUp(arena, { pointerId: 1, pointerType: "touch", clientY: 150 });
    fireEvent.click(arena);
    expect(game.action).toHaveBeenCalledOnce(); // the press jumped; its click is not a second action
    fireEvent.pointerDown(arena, { pointerId: 2, pointerType: "touch", clientY: 450 });
    expect(game.duck).toHaveBeenLastCalledWith(true);
    expect(fireEvent.mouseDown(arena)).toBe(false); // focus stays on the game button, whose blur would end the crouch
    fireEvent.pointerCancel(arena, { pointerId: 2, pointerType: "touch" });
    expect(game.duck).toHaveBeenLastCalledWith(false);
    expect(game.unlock).toHaveBeenCalled();
    // Stopped games act on the click only, so a swipe to scroll never restarts them.
    act(() => publish(over));
    game.action.mockReturnValue("start");
    fireEvent.pointerDown(arena, { pointerId: 3, pointerType: "touch", clientY: 450 });
    expect(game.action).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 520));
    fireEvent.click(arena);
    expect(game.action).toHaveBeenCalledTimes(2);
    act(() => publish(running));
    expect(await screen.findByText(/Tahan di sini untuk menunduk/)).toBeTruthy();
  });

  it("keeps score changes out of live announcements, flashes milestones, counts interrupted runs back in, and retries", async () => {
    render(<BogorRun/>); await ready();
    act(() => publish(running));
    const announcement = announcements();
    act(() => publish({ ...running, score: 13 }));
    expect(announcements()).toBe(announcement);
    act(() => publish({ ...running, score: 503, flash: 500 }));
    expect(screen.getByText("500").hasAttribute("data-flash")).toBe(true);
    expect(screen.queryByRole("button", { name: /Jeda permainan|Lanjutkan permainan/ })).toBeNull(); // no pause control in a run
    act(() => publish({ ...running, phase: "paused" }));
    expect(screen.getByText("Tertahan sebentar.")).toBeTruthy();
    expect(announcements()).toContain("Permainan tertahan.");
    const back = screen.getByRole("button", { name: "Kembali ke game: Bogor Run" });
    act(() => publish({ ...running, phase: "paused", countdown: 3 }));
    expect(back.textContent).toContain("Lanjut dalam 3");
    expect(announcements()).toContain("Lanjut dalam 3.");
    expect(screen.queryByRole("region", { name: "Papan skor" })?.hidden ?? true).toBe(true); // an interruption never opens the board
    act(() => publish(over));
    expect(announcements()).toContain("Skor 42. Rekor 42.");
    await userEvent.click(screen.getByRole("button", { name: "Main lagi: Bogor Run" }));
    expect(game.action).toHaveBeenCalledOnce();
  });

  it("toggles sound with a pressed-state button while playing", async () => {
    render(<BogorRun/>); await ready();
    expect(screen.queryByRole("button", { name: "Suara permainan" })).toBeNull(); // the silent demo needs no mute
    act(() => publish(running));
    const mute = screen.getByRole("button", { name: "Suara permainan" });
    expect(mute.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(mute);
    expect(game.setSound).toHaveBeenCalledWith(false);
    act(() => publish({ ...running, sound: false }));
    expect(mute.getAttribute("aria-pressed")).toBe("false");
  });

  it("tells the runner when the game scrolls away, and disposes on unmount", async () => {
    const { unmount } = render(<BogorRun/>); await ready();
    act(() => visibility([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(game.setVisible).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(online.keepTicketFresh).toHaveBeenCalledOnce());
    unmount(); expect(game.dispose).toHaveBeenCalledOnce();
    expect(stopTickets).toHaveBeenCalledOnce(); // no ticket renewals once the game is gone
  });

  it("keeps game keys working after the mute button is clicked mid-run, and hides the board button during a run", async () => {
    const user = userEvent.setup();
    render(<BogorRun/>); const stage = await ready();
    await user.click(stage);
    act(() => publish(running));
    game.action.mockReturnValue("jump");
    await user.click(screen.getByRole("button", { name: "Suara permainan" }));
    expect(game.setSound).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(stage); // Space now jumps instead of toggling the sound back on
    await user.keyboard(" "); expect(game.action).toHaveBeenCalledTimes(2);
    expect(game.setSound).toHaveBeenCalledOnce();
    // Arrow keys reach the game from any game control, and never scroll the page.
    screen.getByRole("button", { name: "Kembali ke komunitas" }).focus();
    expect(fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" })).toBe(false);
    expect(game.action).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("button", { name: "Papan skor" })).toBeNull(); // the board can't stop a run
    act(() => publish({ ...running, phase: "paused" }));
    expect(screen.queryByRole("button", { name: "Papan skor" })).toBeNull();
    act(() => publish(over));
    expect(screen.getByRole("button", { name: "Papan skor" })).toBeTruthy();
  });

  it("keeps focus in the game when the scenery is pressed mid-run, so the run is not interrupted", async () => {
    render(<BogorRun invitation={<p>Gabung member</p>}/>); await ready();
    expect(fireEvent.mouseDown(screen.getByText("Gabung member"))).toBe(true); // idle copy stays selectable
    act(() => publish(running));
    const arena = screen.getByRole("region", { name: /^Bogor Run/ });
    expect(fireEvent.mouseDown(screen.getByLabelText("Skor permainan"))).toBe(false);
    expect(fireEvent.mouseDown(arena)).toBe(false);
    expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Kembali ke komunitas" }))).toBe(true);
  });

  it("stands the dino only when the last finger leaves the duck zone", async () => {
    render(<BogorRun/>); await ready();
    act(() => publish(running));
    const zone = screen.getByRole("button", { name: /^Arena Bogor Run/ });
    vi.spyOn(zone, "getBoundingClientRect").mockReturnValue({ top: 100, height: 400 } as DOMRect);
    fireEvent.pointerDown(zone, { pointerId: 1, pointerType: "touch", clientY: 450 });
    fireEvent.pointerDown(zone, { pointerId: 2, pointerType: "touch", clientY: 460 });
    fireEvent.pointerUp(zone, { pointerId: 2, pointerType: "touch", clientY: 460 });
    expect(game.duck.mock.calls).toEqual([[true], [true]]); // the first thumb still holds the crouch
    fireEvent.lostPointerCapture(zone, { pointerId: 2, pointerType: "touch" });
    fireEvent.pointerUp(zone, { pointerId: 1, pointerType: "touch", clientY: 450 });
    expect(game.duck).toHaveBeenLastCalledWith(false);
    expect(game.duck).toHaveBeenCalledTimes(3);
  });

  it("lets visitors pause autoplay and return from a personal run to the invitation", async () => {
    render(<BogorRun invitation={<a href="#join">Gabung member</a>}/>); await ready();
    act(() => publish({ ...running, phase: "idle", autoplay: true }));
    await userEvent.click(screen.getByRole("button", { name: "Jeda permainan otomatis" }));
    expect(game.toggleAutoplay).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Papan skor" })).toBeNull();
    act(() => publish(running));
    const invitation = screen.getByText("Gabung member").parentElement!;
    expect(invitation.hasAttribute("inert")).toBe(true);
    expect(invitation.getAttribute("aria-hidden")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Kembali ke komunitas" }));
    expect(game.leave).toHaveBeenCalledOnce();
    act(() => publish({ ...running, phase: "idle", autoplay: true }));
    expect(invitation.hasAttribute("inert")).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("link", { name: "Gabung member" })));
  });

  it("uses the Rising Star skin unlocked on /rai for the poster and the runner", async () => {
    localStorage.setItem("gdgoc:bogor-run:skin:v1", "rising-star");
    const { container } = render(<BogorRun/>);
    await ready();
    expect(hooks?.skin).toBe("rising-star");
    await waitFor(() => expect(container.querySelector("[data-skin]")?.getAttribute("data-skin")).toBe("rising-star"));
    cleanup(); localStorage.clear();
    render(<BogorRun/>);
    await ready();
    expect(hooks?.skin).toBe("classic");
  });

  it("offers a recoverable asset-load failure", async () => {
    game.mount.mockRejectedValueOnce(new Error("offline"));
    render(<BogorRun/>);
    await userEvent.click(await screen.findByRole("button", { name: "Muat ulang game" }));
    await ready(); expect(game.mount).toHaveBeenCalledTimes(2);
  });
});

describe("leaderboard panel", () => {
  it("opens at game over with weekly and all-time tabs, and closes from its toggle", async () => {
    const user = userEvent.setup();
    render(<BogorRun/>); await ready();
    act(() => publish(running));
    expect(screen.queryByRole("button", { name: "Papan skor" })).toBeNull();
    act(() => publish(over));
    const toggle = screen.getByRole("button", { name: "Papan skor" });
    const panel = screen.getByRole("region", { name: "Papan skor" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const list = await within(panel).findByRole("tabpanel");
    await within(list).findByText("Cici L.");
    expect(within(list).getAllByText("02")).toHaveLength(2); // ties share a rank
    expect(online.leaderboard).toHaveBeenCalledWith("week");
    expect(within(panel).getByText("28 Sep – 4 Okt")).toBeTruthy();
    expect(within(panel).getByRole("link", { name: /Lihat 100 besar/ }).getAttribute("href")).toBe("/dashboard/papan-skor");

    const [weekTab, allTab] = within(panel).getAllByRole("tab");
    expect(weekTab.getAttribute("aria-selected")).toBe("true");
    weekTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(allTab);
    expect(allTab.getAttribute("aria-selected")).toBe("true");
    expect(online.leaderboard).toHaveBeenLastCalledWith("all");
    await within(panel).findByText("Dimas W.");
    expect(within(panel).getByText("peringkat #23")).toBeTruthy(); // your rank outside the top 10

    await user.click(toggle);
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    act(() => publish(running)); act(() => publish(over));
    expect(panel.hidden).toBe(false); // the next game over reopens it
  });

  it("saves a signed-in player's run and announces the rank politely", async () => {
    online.signedIn.mockResolvedValue(true);
    let resolve!: (value: Saved) => void;
    online.submitRun.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<BogorRun/>); await ready();
    act(() => publish(running));
    act(() => { hooks.finish?.(finished); publish(over); });
    expect(await screen.findByText("Menyimpan skor…")).toBeTruthy();
    expect(online.submitRun).toHaveBeenCalledWith(finished);
    await act(async () => resolve(saved));
    expect(screen.getByText("Tersimpan · peringkat #3 minggu ini")).toBeTruthy();
    expect(announcements()).toContain("Tersimpan · peringkat #3 minggu ini.");
    await waitFor(() => expect(online.leaderboard).toHaveBeenCalledWith("all"));
  });

  it("offers guests the Google sign-in that carries the run, and explains unranked runs", async () => {
    render(<BogorRun/>); await ready();
    act(() => publish(running));
    act(() => { hooks.finish?.(finished); publish(over); });
    const signIn = await screen.findByRole("button", { name: /Masuk untuk simpan skor/ });
    expect(online.submitRun).not.toHaveBeenCalled();
    await userEvent.click(signIn);
    expect(online.signInToSave).toHaveBeenCalledWith(finished, expect.any(Number));
    expect(await screen.findAllByText("Belum bisa membuka Google login.")).toHaveLength(2); // on the card and announced

    game.action.mockReturnValue("start");
    act(() => publish(running));
    act(() => { hooks.finish?.({ ...finished, token: null, unranked: "ticket" }); publish(over); });
    expect(await screen.findAllByText(/tiket skornya belum sampai dari server/)).toHaveLength(2); // the real reason, shown and announced
    expect(screen.queryByRole("button", { name: /Masuk untuk simpan skor/ })).toBeNull();
    act(() => publish(running));
    act(() => { hooks.finish?.({ ...finished, token: null, unranked: "log" }); publish(over); });
    expect(await screen.findAllByText(/ditekan lebih dari 10\.000 kali/)).toHaveLength(2);
    expect(screen.queryByText(/server skor belum tersambung/)).toBeNull();
  });

  it("celebrates a run that lasted the full hour and saves it like any other", async () => {
    online.signedIn.mockResolvedValue(true);
    render(<BogorRun/>); await ready();
    act(() => publish(running));
    const hour: FinishedRun = { ...finished, endTick: 432_000, score: 137_403 };
    act(() => { hooks.finish?.(hour); publish({ ...over, message: "Selesai! 1 jam penuh", score: 137_403, best: 137_403, finished: true }); });
    expect(screen.getAllByText("Selesai! 1 jam penuh").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kamu bertahan satu jam penuh: 137403 poin/).length).toBeGreaterThan(0);
    await waitFor(() => expect(online.submitRun).toHaveBeenCalledWith(hour));
    expect(await screen.findByText("Tersimpan · peringkat #3 minggu ini")).toBeTruthy();
    expect(announcements()).toContain("Selesai! 1 jam penuh Skor 137403.");
  });

  it("says a run saved to the week it began in when that week has just ended", async () => {
    online.signedIn.mockResolvedValue(true);
    online.submitRun.mockResolvedValue({ ...saved, week: { ...saved.week, key: "2020-01-06" } });
    render(<BogorRun/>); await ready();
    act(() => { hooks.finish?.(finished); publish(over); });
    expect(await screen.findByText("Tersimpan · peringkat #3 minggu lalu")).toBeTruthy();
  });

  it("shows server rejections and lets a dropped connection retry", async () => {
    online.signedIn.mockResolvedValue(true);
    online.submitRun.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: false, code: "INVALID", message: "Skor ini tidak bisa diverifikasi." });
    render(<BogorRun/>); await ready();
    act(() => { hooks.finish?.(finished); publish(over); });
    await userEvent.click(await screen.findByRole("button", { name: "Coba simpan lagi" }));
    expect(await screen.findAllByText("Skor ini tidak bisa diverifikasi.")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Coba simpan lagi" })).toBeNull();
  });

  it("submits the pending run after Google sends the player back, and tidies the URL", async () => {
    window.history.replaceState(null, "", "/?world=kampus&skor=simpan#join");
    const pending = { ...finished, endedAt: Date.now() - 60_000 };
    online.takePendingRun.mockReturnValue(pending);
    online.signedIn.mockResolvedValue(true);
    game.restore.mockImplementation(() => { publish(over); return true; });
    render(<BogorRun/>);
    expect(window.location.search).toBe("?world=kampus");
    expect(window.location.hash).toBe("#join");
    await waitFor(() => expect(game.restore).toHaveBeenCalledWith(pending));
    expect(await screen.findByText("Tersimpan · peringkat #3 minggu ini")).toBeTruthy();
    expect(online.submitRun).toHaveBeenCalledWith(pending);
  });

  it("explains an expired pending run in a notice card that can be closed", async () => {
    window.history.replaceState(null, "", "/?skor=simpan#join");
    const scrolled = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    Element.prototype.scrollIntoView = scrolled;
    render(<BogorRun invitation={<p>Gabung member</p>}/>); await ready();
    expect(await screen.findAllByText(/sudah lewat 30 menit/)).toHaveLength(2); // on screen and announced
    expect(game.restore).not.toHaveBeenCalled();
    // Lined up on return, and again once the notice lands, so scroll anchoring cannot push it under the header.
    await waitFor(() => expect(scrolled).toHaveBeenCalledTimes(2));
    expect(scrolled.mock.contexts.every((element) => element === scrolled.mock.contexts[0])).toBe(true);
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    const notice = screen.getAllByText(/sudah lewat 30 menit/).find((node) => node.tagName === "P")!;
    // It sits above the invitation at reading size, not in the small print beside the controls.
    expect(notice.compareDocumentPosition(screen.getByText("Gabung member")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Ikut main/ }).closest("div")?.parentElement?.textContent).not.toContain("30 menit");
    await userEvent.click(screen.getByRole("button", { name: "Tutup pesan" }));
    expect(screen.queryByText(/sudah lewat 30 menit/)).toBeNull();
  });

  it("offers the run again when the player came back from Google without signing in", async () => {
    const pending = { ...finished, endedAt: Date.now() - 60_000 };
    online.takePendingRun.mockReturnValue(pending);
    game.restore.mockImplementation(() => { publish(over); return true; });
    render(<BogorRun/>);
    await waitFor(() => expect(game.restore).toHaveBeenCalledWith(pending));
    expect(await screen.findByRole("button", { name: /Masuk untuk simpan skor/ })).toBeTruthy();
    expect(screen.getAllByText("Skor tadi belum tersimpan. Masuk untuk menyimpannya.")).toHaveLength(2);
    expect(online.submitRun).not.toHaveBeenCalled();
  });

  it("re-enables the Google button when the page comes back from the back/forward cache", async () => {
    online.signInToSave.mockReturnValue(new Promise(() => { /* the page left for Google */ }));
    render(<BogorRun/>); await ready();
    act(() => { hooks.finish?.(finished); publish(over); });
    await userEvent.click(await screen.findByRole("button", { name: /Masuk untuk simpan skor/ }));
    expect(screen.getByRole("button", { name: /Membuka Google/ })).toHaveProperty("disabled", true);
    act(() => { window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })); });
    expect(screen.getByRole("button", { name: /Masuk untuk simpan skor/ })).toHaveProperty("disabled", false);
  });

  it("has named controls and accessible region semantics, including the open board", async () => {
    const { container } = render(<main><BogorRun/></main>); await ready();
    const rules = { runOnly: { type: "tag" as const, values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } };
    expect((await axe.run(container, rules)).violations.map(({ id }) => id)).toEqual([]);
    act(() => publish(running));
    act(() => { hooks.finish?.(finished); publish(over); });
    await screen.findByRole("button", { name: /Masuk untuk simpan skor/ });
    await screen.findByText("Cici L.");
    expect((await axe.run(container, rules)).violations.map(({ id }) => id)).toEqual([]);
  });
});
