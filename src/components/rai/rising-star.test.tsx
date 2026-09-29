import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKIN_KEY } from "@/lib/bogor-run/skin";
import { RisingStar } from "./rising-star";

const sound = vi.hoisted(() => ({ play: vi.fn(), unlock: vi.fn(), dispose: vi.fn(), setEnabled: vi.fn(), enabled: true }));
const experience = vi.hoisted(() => ({ animated: false }));
vi.mock("@/lib/bogor-run/sound", () => ({ createSound: () => sound, readSoundEnabled: () => true }));
vi.mock("@/components/experience-provider", () => ({ useExperience: () => experience }));

async function audit(container: HTMLElement) {
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map((violation) => violation.id)).toEqual([]);
}
async function reveal() {
  fireEvent.click(screen.getByRole("button", { name: "Buka rahasianya" }));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); experience.animated = false; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("the /rai easter egg", () => {
  it("starts sealed behind one star, with the badge out of the accessibility tree", async () => {
    const { container } = render(<RisingStar />);
    expect(screen.getByRole("heading", { level: 1, name: /jalan rahasia/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Rising Star." })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lompatkan dino biru" })).toBeNull();
    await audit(container);
  });

  it("opens straight to the badge without motion, plays the fanfare and moves focus to the title", async () => {
    const { container } = render(<RisingStar />);
    await reveal();
    const title = screen.getByRole("heading", { level: 1, name: "Rising Star." });
    expect(document.activeElement).toBe(title);
    expect(screen.queryByRole("button", { name: "Buka rahasianya" })).toBeNull();
    expect(sound.unlock).toHaveBeenCalled();
    expect(sound.play).toHaveBeenCalledWith("fanfare");
    expect(screen.getByRole("status").textContent).toMatch(/Rahasia terbuka/);
    expect(screen.getByRole("img", { name: /Lencana Rising Star/ })).toBeTruthy();
    await audit(container);
  });

  it("runs the reveal animation before settling when motion is on", async () => {
    experience.animated = true;
    vi.useFakeTimers();
    const { container } = render(<RisingStar />);
    fireEvent.click(screen.getByRole("button", { name: "Buka rahasianya" }));
    expect(container.querySelector("main")?.dataset.stage).toBe("opening");
    act(() => { vi.advanceTimersByTime(400); });
    expect(sound.play).toHaveBeenCalledWith("fanfare");
    act(() => { vi.advanceTimersByTime(1400); });
    expect(container.querySelector("main")?.dataset.stage).toBe("open");
    expect(screen.getByRole("heading", { level: 1, name: "Rising Star." })).toBeTruthy();
  });

  it("equips and removes the blue dino for Bogor Run", async () => {
    render(<RisingStar />);
    await reveal();
    const user = userEvent.setup();
    const equip = screen.getByRole("button", { name: "Pakai dino biru di Bogor Run" });
    expect(equip.getAttribute("aria-pressed")).toBe("false");
    await user.click(equip);
    expect(localStorage.getItem(SKIN_KEY)).toBe("rising-star");
    expect(equip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toMatch(/Dino biru dipasang/);
    await user.click(equip);
    expect(localStorage.getItem(SKIN_KEY)).toBeNull();
    expect(screen.getByRole("link", { name: /Main Bogor Run/ }).getAttribute("href")).toBe("/#join");
  });

  it("jumps the dino from its button or Space, but not from keys meant for a focused control", async () => {
    render(<RisingStar />);
    await reveal();
    fireEvent.click(screen.getByRole("button", { name: "Lompatkan dino biru" }));
    expect(sound.play).toHaveBeenLastCalledWith("jump");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    sound.play.mockClear();
    fireEvent.keyDown(document.body, { key: " " });
    expect(sound.play).toHaveBeenCalledWith("jump");
    sound.play.mockClear();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    fireEvent.keyDown(screen.getByRole("button", { name: "Balik lencana" }), { key: " " });
    fireEvent.keyDown(document.body, { key: " ", repeat: true });
    expect(sound.play).not.toHaveBeenCalled();
  });

  it("flips the badge and takes the dino out of the tab order while its face is turned away", async () => {
    render(<RisingStar />);
    await reveal();
    const flip = screen.getByRole("button", { name: "Balik lencana" });
    fireEvent.click(flip);
    expect(flip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Lompatkan dino biru", hidden: true }).tabIndex).toBe(-1);
    expect(screen.getByRole("img", { name: /Sisi belakang lencana/ })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Lencana Rising Star/ })).toBeNull(); // the turned-away face is hidden
    const mute = screen.getByRole("button", { name: "Suara nyala" });
    fireEvent.click(mute);
    expect(sound.setEnabled).toHaveBeenCalledWith(false);
    expect(mute.getAttribute("aria-pressed")).toBe("false");
  });
});
