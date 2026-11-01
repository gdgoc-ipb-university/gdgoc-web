import { readFileSync } from "node:fs";
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
// next/font runs at build time; in tests it only has to name the font.
vi.mock("next/font/local", () => ({ default: () => ({ className: "font-vcr", variable: "font-vcr", style: { fontFamily: "'vcr'" } }) }));
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

  it("keeps the QR plain black on white on an opaque plate that the landmark strip stays under", () => {
    render(<MemberCardPage />);
    const face = screen.getByRole("article", { name: "Kartu anggota Rania Putri" });
    expect((face.parentElement as HTMLElement).style.getPropertyValue("--accent")).toBe("#1967d2");
    const qr = within(face).getByRole("img", { name: /QR kartu anggota/ });
    expect(qr.getAttribute("class")).toBe("member-card-qr");
    expect(qr.getAttribute("style")).toBeNull();
    expect([...qr.querySelectorAll("rect, path")].map((shape) => shape.getAttribute("fill"))).toEqual(["#fff", "#000"]);
    // The strip comes after the plate and may rise behind it, never inside it or over it.
    const plate = qr.parentElement as HTMLElement, town = face.querySelector(".member-pass-town") as HTMLElement;
    expect(plate.className).toBe("member-pass-code");
    expect(plate.compareDocumentPosition(town) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(plate.contains(town) || town.contains(plate)).toBe(false);
    const rules = readFileSync("src/components/member-card.css", "utf8").match(/[^{}]*(member-card-qr|member-pass-code)[^{}]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(1);
    for (const rule of rules) expect(rule).not.toMatch(/gradient|url\(|opacity|filter|mix-blend/);
    expect(rules.some((rule) => /^\s*\.member-card-qr \{[^}]*background: #fff;/.test(rule))).toBe(true);
    expect(rules.some((rule) => /^\s*\.member-pass-code \{[^}]*position: relative; z-index: 1;/.test(rule))).toBe(true);
  });

  it("shows the QR full screen, with the name, number and chapter year", async () => {
    render(<MemberCardPage />);
    await userEvent.click(screen.getByRole("button", { name: "Tampilkan QR" }));
    const dialog = screen.getByRole("dialog", { name: "QR kartu anggota" });
    expect(within(dialog).getByRole("img", { name: "QR kartu anggota Rania Putri" })).toBeTruthy();
    expect(within(dialog).getByText("Rania Putri")).toBeTruthy();
    expect(within(dialog).getByText("2627-0042")).toBeTruthy();
    expect(within(dialog).getByText("Kartu anggota · 2026/27")).toBeTruthy();
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
