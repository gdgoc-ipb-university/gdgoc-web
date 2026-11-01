import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MemberCardPage } from "./member-card";

// The card page against a fake Convex that serves one card.
const card = {
  status: "valid", ownerId: "u1", number: "2627-0042", token: "abcdefghijklmnopqrst_-", period: "2026/27", issuedAt: 1, revokedAt: null,
  name: "Rania Putri", photo: null, campus: "IPB University", studyProgram: "Ilmu Komputer", memberType: "core", division: "Technical", tagConfirmed: true,
};
let mine: object | null = card;
const ensure = vi.fn(async () => null);
const reissue = vi.fn(async () => null);
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) => getFunctionName(ref) === "cards:mine" ? mine : undefined,
  useMutation: (ref: FunctionReference<"mutation">) => ({ "cards:ensure": ensure, "cards:reissue": reissue })[getFunctionName(ref)] ?? vi.fn(),
}));

afterEach(() => { cleanup(); mine = card; ensure.mockClear(); reissue.mockClear(); });

describe("member card page", () => {
  it("opens the card on load and shows its facts as text, with a labelled QR, accessibly", async () => {
    const { container } = render(<MemberCardPage />);
    await waitFor(() => expect(ensure).toHaveBeenCalledTimes(1));
    const face = screen.getByRole("article", { name: "Kartu anggota Rania Putri" });
    for (const text of ["Rania Putri", "IPB University · Ilmu Komputer", "Core Team · Technical", "Terverifikasi", "2627-0042", "1 Juli 2026 – 1 Juli 2027"]) {
      expect(within(face).getByText(text)).toBeTruthy();
    }
    expect(within(face).getByRole("img", { name: /QR kartu anggota Rania Putri/ })).toBeTruthy();
    // No photo: the pixel initial stands in.
    expect(face.querySelector(".account-avatar")?.textContent).toBe("R");
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("shows the QR alone, full screen, with the name underneath", async () => {
    render(<MemberCardPage />);
    await userEvent.click(screen.getByRole("button", { name: "Tampilkan QR" }));
    const dialog = screen.getByRole("dialog", { name: "QR kartu anggota" });
    expect(within(dialog).getByRole("img", { name: "QR kartu anggota Rania Putri" })).toBeTruthy();
    expect(within(dialog).getByText("Rania Putri")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Tutup" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("replaces the QR only after a confirmation that says saved images stop working", async () => {
    render(<MemberCardPage />);
    await userEvent.click(screen.getByRole("button", { name: "Ganti QR" }));
    const dialog = screen.getByRole("alertdialog", { name: "Ganti QR kartu?" });
    expect(dialog.textContent).toContain("gambar kartu yang sudah disimpan");
    expect(reissue).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Ganti QR" }));
    expect(reissue).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole("status")).textContent).toContain("QR baru sudah aktif");
  });

  it("shows a blocked card without its QR or actions", () => {
    mine = { ...card, status: "revoked", revokedAt: 2 };
    render(<MemberCardPage />);
    expect(screen.getByText("Kartu diblokir")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /QR/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tampilkan QR" })).toBeNull();
  });

  it("waits for the card while it is being issued", () => {
    mine = null;
    render(<MemberCardPage />);
    expect(screen.getByRole("status").textContent).toContain("Menyiapkan kartu");
  });
});
