import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { CardCheck } from "./card-check";

// The scan page against a fake Convex: each test sets what `cards.verify` answers.
const full = {
  status: "valid", ownerId: "u1", number: "2627-0042", token: "abcdefghijklmnopqrst_-", period: "2026/27", issuedAt: 1, revokedAt: null,
  name: "Rania Putri", photo: null, campus: "IPB University", studyProgram: "Ilmu Komputer", memberType: "core", division: "Technical", tagConfirmed: true,
};
let answer: unknown;
let authLoading = false;
const query = vi.fn();
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: authLoading, isAuthenticated: false }),
  useQuery: (_ref: unknown, args: unknown) => { query(args); return args === "skip" ? undefined : answer; },
}));

afterEach(() => { cleanup(); authLoading = false; query.mockClear(); });
const show = () => render(<CardCheck token="abcdefghijklmnopqrst_-" />);
const accessible = async (container: HTMLElement) => {
  const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
};

describe("member card check", () => {
  it("waits for sign-in to settle before asking, so staff never see the guest view first", () => {
    authLoading = true;
    show();
    expect(query).toHaveBeenLastCalledWith("skip");
    expect(screen.getByRole("status").textContent).toBe("Memeriksa kartu…");
  });

  it("shows a guest the verdict, name, community tag and chapter year, with the time of the check", async () => {
    answer = { viewer: "guest", status: "valid", card: { name: "Rania Putri", memberType: "core", division: "Technical", tagConfirmed: true, period: "2026/27" } };
    const { container } = show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Kartu anggota aktif");
    for (const text of ["Rania Putri", "Core Team · Technical", "Terverifikasi", "1 Juli 2026 – 1 Juli 2027"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText(/^Diperiksa .+ WIB$/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/IPB University ·|2627-|Buka/);
    expect(screen.queryByRole("link")).toBeNull();
    await accessible(container);
  });

  it("tells a guest only that the card is not valid", () => {
    answer = { viewer: "guest", status: "invalid", card: null };
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Kartu tidak berlaku");
    expect(screen.queryByText(/Rania/)).toBeNull();
  });

  it("shows staff the whole card, why it is not valid, and a link to the member's page", async () => {
    answer = { viewer: "staff", status: "revoked", card: { ...full, status: "revoked", revokedAt: 2 } };
    const { container } = show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Kartu tidak berlaku");
    expect(screen.getByText("Kartu diblokir pengurus.")).toBeTruthy();
    expect(screen.getByRole("article", { name: "Kartu anggota Rania Putri" }).textContent).toContain("2627-0042");
    expect(screen.getByRole("link", { name: "Buka halaman anggota" }).getAttribute("href")).toBe("/dashboard/anggota/u1");
    await accessible(container);
  });

  it("tells staff a token matches no card", () => {
    answer = { viewer: "staff", status: "unknown", card: null };
    show();
    expect(screen.getByText("Kartu tidak dikenal atau QR sudah diganti.")).toBeTruthy();
  });

  it("shows the holder their own card and the way back to it", () => {
    answer = { viewer: "self", status: "valid", card: full };
    show();
    expect(screen.getByText(/Ini kartumu/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buka kartumu di dashboard" }).getAttribute("href")).toBe("/dashboard/kartu");
  });
});
