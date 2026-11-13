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
  it("says where Gogo reads, and when it answers without a mention (gdgoc-bot ADR 0007)", () => {
    const text = gogoSection().textContent!;
    expect(text).toMatch(/channel yang dipilih GDGoC IPB untuknya beserta thread di dalamnya/);
    expect(text).toMatch(/DM jika fitur itu dinyalakan/);
    expect(text).toMatch(/membaca semua pesan, termasuk yang tidak me-mention atau membalasnya/);
    expect(text).toMatch(/dalam 10 menit setelah terakhir bicara di channel itu atau saat ada yang menulis namanya/);
    expect(text).toMatch(/bisa mematikan fitur membaca channel ini/);
  });

  it("says what it keeps, where and for how long", () => {
    const text = gogoSection().textContent!;
    expect(text).toMatch(/30 pesan terakhir dari 24 jam terakhir di setiap channel atau thread/);
    expect(text).toMatch(/hanya ada di memori Gogo/);
    expect(text).toMatch(/Tanya jawab dengan Gogo di channel, thread, dan DM disimpan di server Gogo paling lama 24 jam/);
  });

  it("keeps the Discord user ID on Gogo's server only, never sends it, and never keeps usernames, roles or profiles", () => {
    const text = gogoSection().textContent!;
    expect(text).toMatch(/ID pengguna Discord hanya disimpan di server Gogo sendiri, paling lama 24 jam, supaya Gogo tahu siapa mengatakan apa, dan tidak pernah dikirim ke Google/);
    expect(text).not.toMatch(/tidak pernah menyimpan[^.]*ID pengguna/);
    expect(text).toMatch(/Nama tampilan diambil dari Discord setiap kali Gogo menjawab dan tidak disimpan/);
    expect(text).toMatch(/tidak pernah menyimpan atau mengirim username, peran, atau profil Discord/);
    expect(text).toMatch(/Email, nomor telepon, kode undangan Tech League, dan teks yang mirip flag disamarkan, termasuk di nama tampilan/);
  });

  it("names Gemini's free tier, what reaches Google and when, and that Google may use and review it", () => {
    const text = gogoSection().textContent!;
    expect(text).toMatch(/Gemini API dari Google, pada paket gratis/);
    expect(text).toMatch(/atau menimbang perlu menjawab atau tidak, obrolan yang diingatnya di situ dikirim ke Google beserta nama tampilan penulisnya/);
    expect(text).toMatch(/Pesan dari orang yang belum pernah mengobrol dengan Gogo ikut terkirim/);
    expect(text).toMatch(/meningkatkan, dan mengembangkan produknya/);
    expect(text).toMatch(/peninjau manusia dapat membacanya/);
  });

  it("points questions and deletion requests to the page's Instagram contact, without offering an opt-out", () => {
    const section = gogoSection();
    const text = section.textContent!;
    expect(text).toMatch(/Punya pertanyaan soal Gogo, atau ingin obrolan yang disimpannya dihapus sebelum 24 jam\? Hubungi @gdgoc\.ipb/);
    expect(text).toMatch(/Kalau tidak ingin pesanmu dibaca Gogo, ngobrol saja di channel lain, yang tidak dibaca Gogo/);
    expect(text).not.toMatch(/tidak ingin pesanmu ikut dibaca/);
    const link = within(section).getByRole("link", { name: "@gdgoc.ipb" });
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
