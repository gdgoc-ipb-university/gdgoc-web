import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BogorRun } from "./bogor-run";
import type { Snapshot } from "@/lib/bogor-run/runtime";

const game = vi.hoisted(() => ({ mount: vi.fn(), action: vi.fn(), togglePause: vi.fn(), pause: vi.fn(), dispose: vi.fn(), setReduced: vi.fn() }));
vi.mock("@/lib/bogor-run/runtime", () => ({ mountRunner: game.mount }));
vi.mock("./experience-provider", () => ({ useExperience: () => ({ animated: false }) }));
let publish: (snapshot: Snapshot) => void;
let visibility: IntersectionObserverCallback;
const running: Snapshot = { phase: "running", score: 12, best: 20, message: "" };

beforeEach(() => {
  vi.clearAllMocks();
  game.mount.mockImplementation(async (_canvas, callback) => { publish = callback; return game; });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { visibility = callback; }
    observe() { queueMicrotask(() => visibility([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], this as unknown as IntersectionObserver)); }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function ready() {
  const button = screen.getByRole("button", { name: "Mulai main: Bogor Run" });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  return button;
}

describe("footer game controls", () => {
  it("starts explicitly and scopes jump keys to the game, without repeated-key jumps", async () => {
    render(<><BogorRun/><button>Di luar game</button></>);
    const user = userEvent.setup(); const stage = await ready();
    expect(game.action).not.toHaveBeenCalled();
    await user.click(stage); expect(game.action).toHaveBeenCalledOnce();
    act(() => publish(running));
    await user.keyboard(" "); expect(game.action).toHaveBeenCalledTimes(2);
    await user.keyboard("{ArrowUp}"); expect(game.action).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(stage, { key: " ", repeat: true }); expect(game.action).toHaveBeenCalledTimes(3);
    await user.keyboard("p"); expect(game.togglePause).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Di luar game" }));
    expect(game.pause).toHaveBeenCalledOnce();
    await user.keyboard(" "); expect(game.action).toHaveBeenCalledTimes(3);
  });

  it("keeps score changes out of live announcements and exposes pause/retry controls", async () => {
    render(<BogorRun/>); await ready();
    act(() => publish(running));
    const announcement = screen.getByRole("status").textContent;
    act(() => publish({ ...running, score: 13 }));
    expect(screen.getByRole("status").textContent).toBe(announcement);
    act(() => publish({ ...running, phase: "paused" }));
    await userEvent.click(screen.getByRole("button", { name: "Lanjutkan permainan" }));
    expect(game.togglePause).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lanjut main: Bogor Run" }));
    act(() => publish({ ...running, phase: "over", score: 42, best: 42, message: "Angkot duluan!" }));
    expect(screen.getByRole("status").textContent).toContain("Skor 42. Rekor 42.");
    await userEvent.click(screen.getByRole("button", { name: "Main lagi: Bogor Run" }));
    expect(game.action).toHaveBeenCalledOnce();
  });

  it("pauses outside the viewport and disposes on unmount", async () => {
    const { unmount } = render(<BogorRun/>); await ready();
    act(() => visibility([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(game.pause).toHaveBeenCalledOnce();
    unmount(); expect(game.dispose).toHaveBeenCalledOnce();
  });

  it("offers a recoverable asset-load failure", async () => {
    game.mount.mockRejectedValueOnce(new Error("offline"));
    render(<BogorRun/>);
    await userEvent.click(await screen.findByRole("button", { name: "Muat ulang game" }));
    await ready(); expect(game.mount).toHaveBeenCalledTimes(2);
  });

  it("has named controls and accessible region semantics", async () => {
    const { container } = render(<main><BogorRun/></main>); await ready();
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id }) => id)).toEqual([]);
  });
});
