import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { twibbon } from "@/lib/twibbon";
import { TwibbonMaker } from "./twibbon-maker";

// The maker against a browser that decodes every photo to 4000 × 3000 and records what is drawn and saved.
const input = (container: HTMLElement) => container.querySelector("input[type=file]") as HTMLInputElement;
const choose = (container: HTMLElement, type = "image/jpeg") => fireEvent.change(input(container), { target: { files: [new File([new Uint8Array(64)], "foto.jpg", { type })] } });
const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "", imageSmoothingQuality: "" };
const saved = vi.fn();
const lastPhotoDraw = () => context.drawImage.mock.calls.filter(([source]) => !(source instanceof HTMLImageElement)).at(-1);

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
  Object.assign(URL, { createObjectURL: () => "blob:twibbon", revokeObjectURL: () => {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done, type, quality) => { saved({ type, quality }); done(new Blob(["x"], { type: "image/jpeg" })); });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); context.drawImage.mockClear(); saved.mockClear();
  Reflect.deleteProperty(URL, "createObjectURL"); Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("twibbon maker", () => {
  it("asks for a photo first, offers the second slide, and is accessible", async () => {
    const { container } = render(<TwibbonMaker />);
    expect((screen.getByRole("button", { name: /Unduh twibbon/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("slider", { name: "Perbesar" }) as HTMLInputElement).disabled).toBe(true);
    const slide = screen.getByRole("link", { name: /Unduh slide 2/ });
    expect(slide.getAttribute("href")).toBe(twibbon.slide);
    expect(slide.getAttribute("download")).toBe(twibbon.slideFileName);
    expect(input(container).accept).toBe("image/jpeg,image/png,image/webp");
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("refuses other formats", async () => {
    const { container } = render(<TwibbonMaker />);
    choose(container, "image/gif");
    expect((await screen.findByRole("alert")).textContent).toBe("Gunakan foto JPG, PNG, atau WebP.");
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("covers the canvas with the photo, moves and zooms it from the keyboard, and saves a 1080 × 1440 JPEG", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { container } = render(<TwibbonMaker />);
    choose(container);
    await waitFor(() => expect(lastPhotoDraw()).toBeTruthy());
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
    expect(lastPhotoDraw()?.slice(1)).toEqual([-420, 0, 1920, 1440]);

    const stage = screen.getByRole("group", { name: "Pratinjau twibbon" });
    stage.focus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    // Right moves the photo; down does nothing, since at zoom 1 it has no height to spare.
    expect(lastPhotoDraw()?.slice(1)).toEqual([-400, 0, 1920, 1440]);
    await user.keyboard("+");
    expect(screen.getByRole("slider", { name: "Perbesar" }).getAttribute("aria-valuetext")).toBe("110%");

    await user.click(screen.getByRole("button", { name: /Unduh twibbon/ }));
    expect(saved).toHaveBeenCalledWith({ type: "image/jpeg", quality: .92 });
    const link = click.mock.contexts.at(-1) as HTMLAnchorElement;
    expect(link.download).toBe(twibbon.fileName);
    expect((screen.getByRole("button", { name: /Ganti foto/ }))).toBeTruthy();
  });

  it("builds the caption from the fields and copies it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<TwibbonMaker />);
    await user.type(screen.getByRole("textbox", { name: "Nama panggilan" }), "Teman");
    await user.type(screen.getByRole("textbox", { name: "Sekolah atau kampus" }), "SMKN 1 Bogor");
    await user.type(screen.getByRole("textbox", { name: "Tag 3 teman" }), "satu, @dua tiga");
    await user.click(screen.getByRole("button", { name: /Salin caption/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Halo, aku Teman dari SMKN 1 Bogor."));
    expect(writeText.mock.calls[0]).toEqual([expect.stringContaining("@gdgoc.ipb @satu @dua @tiga")]);
    expect(screen.getByRole("status").textContent).toBe("Caption disalin.");

    writeText.mockRejectedValueOnce(new Error("denied"));
    await user.click(screen.getByRole("button", { name: /Salin caption/ }));
    expect(screen.getByRole("status").textContent).toMatch(/Tidak bisa menyalin otomatis/);
  });
});
