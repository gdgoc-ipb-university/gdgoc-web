import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { communityLinks } from "@/lib/community";
import PrivacyPage from "./privasi/page";

vi.mock("@/components/header", () => ({ Header: () => null }));

afterEach(cleanup);

function gogoSection() {
  render(<PrivacyPage />);
  return screen.getByRole("heading", { level: 2, name: "Bot Discord Gogo" }).closest("section")!;
}

/** The chapter's Discord bot on /privasi (#260): what it reads and keeps, who processes it, and whom to ask. */
describe("/privasi: Bot Discord Gogo", () => {
  it("says where Gogo reads, what it keeps and for how long, and what it never keeps", () => {
    const text = gogoSection().textContent!;
    expect(text).toMatch(/channel yang dipilih GDGoC IPB/);
    expect(text).toMatch(/DM jika fitur itu dinyalakan/);
    expect(text).toMatch(/membaca semua pesan, termasuk yang tidak menyebut atau membalasnya/);
    expect(text).toMatch(/nama tampilan Discord pengirimnya, waktu kirim, dan pesan yang dibalas, paling lama 24 jam/);
    expect(text).toMatch(/tidak pernah menyimpan atau mengirim ID pengguna, username, peran, atau profil Discord/);
    expect(text).toMatch(/Email, nomor telepon, kode undangan Tech League, dan teks yang mirip flag disamarkan/);
  });

  it("names Gemini's free tier, and that Google may use and review what it's sent", () => {
    const text = gogoSection().textContent!;
    expect(text).toMatch(/Gemini API dari Google, pada paket gratis/);
    expect(text).toMatch(/termasuk nama tampilan dan isi pesan, dikirim ke Google/);
    expect(text).toMatch(/meningkatkan, dan mengembangkan produknya/);
    expect(text).toMatch(/peninjau manusia dapat membacanya/);
  });

  it("points questions and requests to the page's Instagram contact", () => {
    const link = within(gogoSection()).getByRole("link", { name: "@gdgoc.ipb" });
    expect(link.getAttribute("href")).toBe(communityLinks.instagram);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("follows the copywriting rules: no em dash, and no full stop at the end of a paragraph", () => {
    const paragraphs = Array.from(gogoSection().querySelectorAll("p"), (p) => p.textContent!.trim());
    expect(paragraphs.length).toBeGreaterThan(0);
    for (const paragraph of paragraphs) {
      expect(paragraph).not.toMatch(/—/);
      expect(paragraph).not.toMatch(/\.$/);
    }
  });

  it("is mentioned in the page's intro and from the Discord section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/papan skor Bogor Run, dan bot Discord Gogo/)).toBeTruthy();
    const discord = screen.getByRole("heading", { level: 2, name: "Discord" }).closest("section")!;
    expect(discord.textContent).toMatch(/Pesan yang dibaca bot Gogo dijelaskan di bagian berikutnya/);
  });
});
