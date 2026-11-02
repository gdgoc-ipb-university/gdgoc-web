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
  it("opens the card on load and shows both sides, with the facts as text and a labelled QR, accessibly", async () => {
    const { container } = render(<MemberCardPage />);
    await waitFor(() => expect(ensure).toHaveBeenCalledTimes(1));
    const card = screen.getByRole("group", { name: "Kartu anggota Rania Putri" });
    const front = within(card).getByRole("figure", { name: "Bagian depan" }), back = within(card).getByRole("figure", { name: "Bagian belakang" });
    expect(front.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const text of ["Rania Putri", "Core Team · Technical", "Terverifikasi", "2627-0042", "2026/27"]) expect(within(front).getByText(text)).toBeTruthy();
    for (const text of ["IPB University · Ilmu Komputer", "2627-0042", "1 Juli 2026 – 1 Juli 2027", "Tunjukkan QR ini di pintu masuk"]) expect(within(back).getByText(text)).toBeTruthy();
    expect(within(back).getByRole("img", { name: /QR kartu anggota Rania Putri/ })).toBeTruthy();
    expect(within(front).queryByRole("img", { name: /QR/ })).toBeNull();
    // No photo: the pixel initial stands in.
    expect(front.querySelector(".account-avatar")?.textContent).toBe("R");
    // No strap any more: the punch slot is drawn on both sides and stays empty.
    expect(container.querySelector("img[src*='lanyard']")).toBeNull();
    expect([...card.querySelectorAll(".cr80-slot")].map((slot) => slot.childNodes.length)).toEqual([0, 0]);
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("keeps the QR plain black on white on an opaque plate that the landmark strip stays clear of", () => {
    render(<MemberCardPage />);
    const front = screen.getByRole("figure", { name: "Bagian depan" }), back = screen.getByRole("figure", { name: "Bagian belakang" });
    expect((front.querySelector(".cr80") as HTMLElement).style.getPropertyValue("--accent")).toBe("#1967d2");
    const qr = within(back).getByRole("img", { name: /QR kartu anggota/ });
    expect(qr.getAttribute("class")).toBe("member-card-qr");
    expect(qr.getAttribute("style")).toBeNull();
    expect([...qr.querySelectorAll("rect, path")].map((shape) => shape.getAttribute("fill"))).toEqual(["#fff", "#000"]);
    // The strip comes after the plate's column, never inside it or around it.
    const plate = qr.parentElement as HTMLElement, town = back.querySelector(".cr80-town") as HTMLElement;
    expect(plate.className).toBe("cr80-plate");
    expect(plate.compareDocumentPosition(town) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(plate.contains(town) || town.contains(plate)).toBe(false);
    const css = readFileSync("src/components/member-card.css", "utf8");
    const rules = css.match(/[^{}]*(member-card-qr|cr80-plate)[^{}]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(1);
    for (const rule of rules) expect(rule).not.toMatch(/gradient|url\(|opacity|filter|mix-blend/);
    expect(rules.some((rule) => /^\s*\.member-card-qr \{[^}]*background: #fff;/.test(rule))).toBe(true);
    expect(rules.some((rule) => /^\s*\.cr80-plate \{[^}]*background: #fff;/.test(rule))).toBe(true);
    // The column, plate included, sits above the strip; the back's strip starts below the column's 856 px.
    expect(css).toMatch(/\.cr80-column \{ position: relative; z-index: 1;/);
  });

  it("draws each side at CR80 proportions, scaled from the Figma trim of 638 px", () => {
    const css = readFileSync("src/components/member-card.css", "utf8");
    expect(css).toMatch(/\.cr80 \{[^}]*--u: calc\(100cqi \/ 638\);[^}]*aspect-ratio: 638 \/ 1011;/);
    // The QR plate is 392 trim px with its border and padding, so the code with its quiet zone is 370 px: 31 mm printed.
    expect(css).toMatch(/\.cr80-plate \{[^}]*width: calc\(392 \* var\(--u\)\); padding: calc\(8 \* var\(--u\)\);[^}]*border: calc\(3 \* var\(--u\)\)/);
  });

  it("shows the back full screen for the door, with the name, number and chapter year", async () => {
    render(<MemberCardPage />);
    await userEvent.click(screen.getByRole("button", { name: "Tampilkan QR" }));
    const dialog = screen.getByRole("dialog", { name: "QR kartu anggota" });
    expect(within(dialog).getByRole("img", { name: "QR kartu anggota Rania Putri" }).parentElement?.className).toBe("member-qr-plate");
    for (const text of ["Rania Putri", "2627-0042", "GDGoC IPB University", "2026/27"]) expect(within(dialog).getByText(text)).toBeTruthy();
    expect(dialog.querySelector(".cr80-town[data-side='back']")).toBeTruthy();
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
    expect(within(screen.getByRole("figure", { name: "Bagian belakang" })).getByText("Kartu diblokir")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /QR/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tampilkan QR" })).toBeNull();
  });

  it("waits for the card while it is being issued", () => {
    mine = null;
    render(<MemberCardPage />);
    expect(screen.getByRole("status").textContent).toContain("Menyiapkan kartu");
  });
});
