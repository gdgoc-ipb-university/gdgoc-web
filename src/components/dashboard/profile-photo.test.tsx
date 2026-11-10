import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { ProfilePhotoPanel } from "./profile-photo";
import { ViewerContext, type DashboardViewer } from "./viewer";

// The photo panel against a fake Convex and a browser that decodes images to the size each test asks for.
const uploadUrl = vi.fn(async () => "https://example.convex.cloud/upload");
const attach = vi.fn(async (): Promise<{ error?: string }> => ({}));
const remove = vi.fn(async () => null);
const sendFile = vi.fn(async (_url: string, _file: Blob, onProgress: (fraction: number) => void) => { onProgress(.5); return "storage1"; });
vi.mock("next/font/local", () => ({ default: () => ({ className: "font-vcr", variable: "font-vcr", style: { fontFamily: "'vcr'" } }) }));
vi.mock("@/lib/upload", () => ({ sendFile: (...args: Parameters<typeof sendFile>) => sendFile(...args) }));
vi.mock("convex/react", () => ({
  useMutation: (ref: FunctionReference<"mutation">) => ({ "photos:uploadUrl": uploadUrl, "photos:remove": remove })[getFunctionName(ref)] ?? vi.fn(),
  useAction: (ref: FunctionReference<"action">) => getFunctionName(ref) === "photos:set" ? attach : vi.fn(),
}));

const base: DashboardViewer = {
  id: "me" as DashboardViewer["id"], name: "Rania Putri", email: "rania@example.com", role: "member", active: true, onboarded: true, reviewer: false,
  memberType: "core", division: "Technical", tagConfirmed: false, campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "", doorHelper: false, techSupportHandler: false,
  photo: "https://lh3.googleusercontent.com/a/example=s96-c", photoUploaded: false,
};
const show = (viewer: Partial<DashboardViewer> = {}) => render(<ViewerContext.Provider value={{ ...base, ...viewer }}><ProfilePhotoPanel /></ViewerContext.Provider>);
const input = (container: HTMLElement) => container.querySelector("input[type=file]") as HTMLInputElement;
const choose = (container: HTMLElement, file: File) => fireEvent.change(input(container), { target: { files: [file] } });
const photo = (type = "image/jpeg") => new File([new Uint8Array(64)], "foto.jpg", { type });

let decoded = { width: 1200, height: 900 };
const blob = vi.fn();
beforeEach(() => {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ ...decoded, close: vi.fn() })));
  Object.assign(URL, { createObjectURL: () => "blob:chosen", revokeObjectURL: () => {} });
  const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "", imageSmoothingQuality: "" };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AAAA");
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, done, type, quality) {
    blob({ width: this.width, height: this.height, type, quality });
    done(new Blob(["x"], { type: "image/jpeg" }));
  });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); decoded = { width: 1200, height: 900 };
  for (const fn of [uploadUrl, attach, remove, sendFile, blob]) fn.mockClear();
  Reflect.deleteProperty(URL, "createObjectURL"); Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("profile photo panel", () => {
  it("says the photo is printed on the card and shows where the current one comes from, accessibly", async () => {
    const { container } = show();
    const panel = screen.getByRole("region", { name: "Foto profil" });
    expect(within(panel).getByText(/dicetak di kartu anggota/)).toBeTruthy();
    expect(within(panel).getByText("Foto dari akun Google-mu.")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Pilih foto" })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Hapus foto" })).toBeNull();
    expect(input(container).accept).toBe("image/jpeg,image/png,image/webp");
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
    cleanup();
    show({ photo: null });
    expect(screen.getByText("Belum ada foto, jadi kartu memakai inisial namamu.")).toBeTruthy();
  });

  it("refuses other formats and images smaller than 400 × 400 before cropping", async () => {
    const { container } = show();
    choose(container, photo("image/gif"));
    expect((await screen.findByRole("alert")).textContent).toBe("Gunakan foto JPG, PNG, atau WebP.");
    decoded = { width: 640, height: 360 };
    choose(container, photo());
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Foto terlalu kecil (640 × 360 piksel). Pakai foto minimal 400 × 400 piksel agar tetap tajam saat kartu dicetak."));
    expect(screen.queryByRole("group", { name: "Posisi foto" })).toBeNull();
  });

  it("crops with the keyboard and the zoom slider, then uploads an 800 × 800 JPEG with progress", async () => {
    const user = userEvent.setup();
    const { container } = show();
    choose(container, photo());
    const area = await screen.findByRole("group", { name: "Posisi foto" });
    const image = area.querySelector("img") as HTMLImageElement;
    const start = image.style.transform;
    area.focus();
    await user.keyboard("{ArrowLeft}");
    expect(image.style.transform).not.toBe(start);
    const zoom = screen.getByRole("slider", { name: "Perbesar" }) as HTMLInputElement;
    // 900 px tall: zooming stops at 2.25×, where 400 source pixels still fill the square.
    expect(zoom.max).toBe("2.25");
    fireEvent.change(zoom, { target: { value: "2" } });
    expect(zoom.getAttribute("aria-valuetext")).toBe("200%");
    expect(screen.getByText("Di kartu")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Simpan foto/ }));
    await waitFor(() => expect(attach).toHaveBeenCalledWith({ storageId: "storage1" }));
    expect(blob).toHaveBeenCalledWith({ width: 800, height: 800, type: "image/jpeg", quality: .88 });
    expect(sendFile.mock.calls[0][0]).toBe("https://example.convex.cloud/upload");
    expect((await screen.findByRole("status")).textContent).toContain("Foto profil tersimpan");
    expect(screen.queryByRole("group", { name: "Posisi foto" })).toBeNull();
  });

  it("keeps the crop open with the server's reason when it refuses the photo", async () => {
    attach.mockResolvedValueOnce({ error: "Ukuran foto maksimal 5 MB." });
    const user = userEvent.setup();
    const { container } = show();
    choose(container, photo());
    await user.click(await screen.findByRole("button", { name: /Simpan foto/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Ukuran foto maksimal 5 MB.");
    expect(screen.getByRole("group", { name: "Posisi foto" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.getByRole("button", { name: "Pilih foto" })).toBeTruthy();
  });

  it("removes an uploaded photo after confirming", async () => {
    const user = userEvent.setup();
    show({ photo: "https://example.convex.cloud/api/storage/photo", photoUploaded: true });
    expect(screen.getByText("Foto yang kamu unggah.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ganti foto" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hapus foto" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/dihapus permanen/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Hapus foto" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith({}));
  });
});
