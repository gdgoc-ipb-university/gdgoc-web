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
  Reflect.deleteProperty(navigator, "share"); Reflect.deleteProperty(navigator, "canShare");
});

describe("twibbon maker", () => {
  it("asks for a photo first, offers the second slide, and is accessible", async () => {
    const { container } = render(<TwibbonMaker />);
    expect((screen.getByRole("button", { name: /Unduh twibbon/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("slider", { name: "Ukuran foto" }) as HTMLInputElement).disabled).toBe(true);
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
    expect(screen.getByRole("slider", { name: "Ukuran foto" }).getAttribute("aria-valuetext")).toBe("110%");
    // Zoomed out below filling the frame, the photo sits on white.
    await user.keyboard("------");
    expect(screen.getByRole("slider", { name: "Ukuran foto" }).getAttribute("aria-valuetext")).toBe("50%");
    const [width, height] = lastPhotoDraw()!.slice(3) as number[];
    expect(width).toBeCloseTo(960); expect(height).toBeCloseTo(720);
    expect(context.fillStyle).toBe("#ffffff");

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

// A phone: a coarse pointer and the Web Share API, whose share() the test decides.
function phone(share: () => Promise<void>, canShare = true) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: coarse)" }));
  const mocks = { share: vi.fn(share), canShare: vi.fn(() => canShare) };
  Object.defineProperty(navigator, "share", { value: mocks.share, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: mocks.canShare, configurable: true });
  return mocks;
}
async function makeTwibbon() {
  const user = userEvent.setup();
  const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const view = render(<TwibbonMaker />);
  choose(view.container);
  await waitFor(() => expect(lastPhotoDraw()).toBeTruthy());
  await user.click(screen.getByRole("button", { name: /Unduh twibbon/ }));
  return { user, download, ...view };
}

describe("saving on a phone (#219)", () => {
  it("hands the JPEG to the share sheet instead of downloading it, and shows it to long-press", async () => {
    const { share, canShare } = phone(async () => {});
    const { download } = await makeTwibbon();
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [file] = (canShare.mock.calls[0] as unknown as [ShareData])[0].files!;
    expect([file.name, file.type]).toEqual([twibbon.fileName, "image/jpeg"]);
    expect(share).toHaveBeenCalledWith({ files: [file] });
    expect(download).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Twibbon kamu" }).getAttribute("src")).toBe("blob:twibbon");
    expect(screen.getByText("Belum tersimpan? Tekan lama gambar, lalu Simpan.")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: /Unduh twibbon/ }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("takes a closed share sheet as the member's choice", async () => {
    const { share } = phone(() => Promise.reject(new DOMException("Share canceled", "AbortError")));
    const { download } = await makeTwibbon();
    await waitFor(() => expect(share).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: /Unduh twibbon/ }).textContent).toMatch(/Unduh twibbon/));
    expect(download).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("img", { name: "Twibbon kamu" })).toBeTruthy();
  });

  it("downloads when sharing fails", async () => {
    phone(() => Promise.reject(new DOMException("No user activation", "NotAllowedError")));
    const { download } = await makeTwibbon();
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect((download.mock.contexts[0] as HTMLAnchorElement).download).toBe(twibbon.fileName);
    expect(screen.getByRole("img", { name: "Twibbon kamu" })).toBeTruthy();
  });

  it("downloads when the browser cannot share the file", async () => {
    const { share } = phone(async () => {}, false);
    const { download } = await makeTwibbon();
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(share).not.toHaveBeenCalled();
  });

  it("keeps the plain download on a desktop, with its own hint", async () => {
    const { share } = phone(async () => {});
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { download } = await makeTwibbon();
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(share).not.toHaveBeenCalled();
    expect(screen.getByText("Belum terunduh? Klik kanan gambar, lalu Simpan gambar.")).toBeTruthy();
  });

  it("lets go of the shown twibbon once the photo moves or changes", async () => {
    const revoke = vi.fn();
    Object.assign(URL, { revokeObjectURL: revoke });
    const { user, container } = await makeTwibbon();
    expect(screen.getByRole("img", { name: "Twibbon kamu" })).toBeTruthy();
    screen.getByRole("group", { name: "Pratinjau twibbon" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.queryByRole("img", { name: "Twibbon kamu" })).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:twibbon");

    revoke.mockClear();
    await user.click(screen.getByRole("button", { name: /Unduh twibbon/ }));
    choose(container);
    await waitFor(() => expect(screen.queryByRole("img", { name: "Twibbon kamu" })).toBeNull());
    expect(revoke).toHaveBeenCalledWith("blob:twibbon");
  });

  it("shares the second slide too, and shows it", async () => {
    const { share } = phone(async () => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["slide"], { type: "image/jpeg" }))));
    const user = userEvent.setup();
    render(<TwibbonMaker />);
    await user.click(screen.getByRole("link", { name: /Unduh slide 2/ }));
    expect(fetch).toHaveBeenCalledWith(twibbon.slide);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect((share.mock.calls[0] as unknown as [ShareData])[0].files![0].name).toBe(twibbon.slideFileName);
    expect(screen.getByRole("img", { name: "Slide 2" }).getAttribute("src")).toBe(twibbon.slide);
  });

  it("suggests leaving an in-app browser", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) Mobile/15E148 Instagram 400.0.0.25.88");
    render(<TwibbonMaker />);
    expect(screen.getByRole("note").textContent).toMatch(/buka di Chrome atau Safari/);
  });
});
