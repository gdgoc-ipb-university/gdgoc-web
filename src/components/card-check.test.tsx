import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const checkIn = vi.fn();
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: authLoading, isAuthenticated: false }),
  useQuery: (_ref: unknown, args: unknown) => { query(args); return args === "skip" ? undefined : answer; },
  useMutation: () => checkIn,
}));

afterEach(() => { cleanup(); authLoading = false; query.mockClear(); checkIn.mockReset(); });
const door = (id: string, title: string, checkedInAt: number | null = null) => ({ _id: id, title, venue: "Javano Coffee", checkedInAt, inAudience: true });
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
    // The pass carries only what decision 5 allows, and the stamp.
    const pass = screen.getByRole("article", { name: "Kartu anggota Rania Putri" });
    expect(pass.querySelector(".member-pass-avatar, .member-pass-number, .member-pass-code")).toBeNull();
    expect(pass.querySelector(".member-pass-stamp")?.getAttribute("data-stamp")).toBe("valid");
    expect(screen.queryByRole("link")).toBeNull();
    await accessible(container);
  });

  it("tells a guest only that the card is not valid", () => {
    answer = { viewer: "guest", status: "invalid", card: null };
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Kartu tidak berlaku");
    expect(screen.queryByText(/Rania/)).toBeNull();
    const pass = screen.getByRole("article", { name: "Kartu anggota" });
    expect(pass.querySelector("h2, .member-pass-role, .member-pass-facts")).toBeNull();
    expect(pass.querySelector(".member-pass-stamp")?.getAttribute("data-stamp")).toBe("invalid");
  });

  it("shows staff the whole card, why it is not valid, and a link to the member's page", async () => {
    answer = { viewer: "staff", status: "revoked", card: { ...full, status: "revoked", revokedAt: 2 }, gatherings: [] };
    const { container } = show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Kartu tidak berlaku");
    expect(screen.getByText("Kartu diblokir pengurus.")).toBeTruthy();
    const pass = screen.getByRole("article", { name: "Kartu anggota Rania Putri" });
    expect(pass.textContent).toContain("2627-0042");
    expect(pass.querySelector(".member-pass-stamp")?.getAttribute("data-stamp")).toBe("invalid");
    expect(screen.getByRole("link", { name: "Buka halaman anggota" }).getAttribute("href")).toBe("/dashboard/anggota/u1");
    await accessible(container);
  });

  it("tells staff a token matches no card", () => {
    answer = { viewer: "staff", status: "unknown", card: null, gatherings: [] };
    show();
    expect(screen.getByText("Kartu tidak dikenal atau QR sudah diganti.")).toBeTruthy();
  });

  it("lets a door helper check the holder in to today's only gathering, without a member link", async () => {
    answer = { viewer: "helper", status: "valid", card: full, gatherings: [door("g1", "Rapat Core Team")] };
    checkIn.mockResolvedValue({ result: "checkedIn", name: "Rania Putri", checkedInAt: 1 });
    const { container } = show();
    const panel = screen.getByRole("region", { name: "Catat kehadiran" });
    expect(panel.textContent).toContain("Rapat Core Team");
    await userEvent.click(within(panel).getByRole("button", { name: "Catat hadir" }));
    expect(checkIn).toHaveBeenCalledWith({ id: "g1", token: full.token, allowOutside: false });
    expect(screen.queryByRole("link")).toBeNull();
    await accessible(container);
  });

  it("asks before checking in someone outside the audience", async () => {
    answer = { viewer: "staff", status: "valid", card: full, gatherings: [door("g1", "Rapat Core Team")] };
    checkIn.mockResolvedValueOnce({ result: "outside", name: "Rania Putri", memberType: "member", division: null }).mockResolvedValueOnce({ result: "checkedIn", name: "Rania Putri", checkedInAt: 1 });
    show();
    await userEvent.click(screen.getByRole("button", { name: "Catat hadir" }));
    expect((await screen.findByRole("alert")).textContent).toContain("tidak termasuk sasaran");
    await userEvent.click(screen.getByRole("button", { name: "Tetap catat hadir" }));
    expect(checkIn).toHaveBeenLastCalledWith({ id: "g1", token: full.token, allowOutside: true });
  });

  it("has the door choose between gatherings, and shows who is already in", async () => {
    answer = { viewer: "staff", status: "valid", card: full, gatherings: [door("g1", "Rapat Core Team", Date.parse("2026-11-21T09:05:00+07:00")), door("g2", "Kumpul member")] };
    show();
    expect(screen.queryByRole("button", { name: "Catat hadir" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: /Rapat Core Team/ }));
    expect(screen.getByRole("status").textContent).toBe("Rania Putri sudah tercatat hadir pukul 09.05 WIB.");
    await userEvent.click(screen.getByRole("radio", { name: /Kumpul member/ }));
    expect(screen.getByRole("button", { name: "Catat hadir" })).toBeTruthy();
  });

  it("offers no check-in on a card that is not valid", () => {
    answer = { viewer: "staff", status: "revoked", card: { ...full, status: "revoked" }, gatherings: [door("g1", "Rapat Core Team")] };
    show();
    expect(screen.queryByRole("region", { name: "Catat kehadiran" })).toBeNull();
  });

  it("shows the holder their own card and the way back to it", () => {
    answer = { viewer: "self", status: "valid", card: full };
    show();
    expect(screen.getByText(/Ini kartumu/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buka kartumu di dashboard" }).getAttribute("href")).toBe("/dashboard/kartu");
  });
});
