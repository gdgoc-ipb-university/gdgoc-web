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
    expect(text).toMatch(/ID pengguna Discord hanya disimpan di server Gogo sendiri, paling lama 24 jam, supaya Gogo tahu siapa mengatakan apa, dan tidak pernah dikirim ke OpenRouter, Baidu, atau Google/);
    expect(text).not.toMatch(/tidak pernah menyimpan[^.]*ID pengguna/);
    expect(text).toMatch(/Nama tampilan diambil dari Discord setiap kali Gogo menjawab dan tidak disimpan/);
    expect(text).toMatch(/tidak pernah menyimpan atau mengirim username, peran, atau profil Discord/);
    expect(text).toMatch(/Email, nomor telepon, kode undangan Tech League, dan teks yang mirip flag disamarkan, termasuk di nama tampilan/);
  });

  it("names OpenRouter, what reaches it and when, and the models it goes to in order (gdgoc-bot ADR 0008)", () => {
    const text = gogoSection().textContent!;
    expect(text).toMatch(/Jawaban Gogo dibuat lewat OpenRouter, layanan di Amerika Serikat/);
    expect(text).toMatch(/Setiap kali Gogo menjawab, atau menimbang apakah pesan yang tidak me-mention-nya perlu dijawab, Gogo mengirim ke OpenRouter instruksinya, info publik dari website, dan obrolan terbaru/);
    expect(text).toMatch(/beserta nama tampilan penulisnya: nickname di server, nama tampilan Discord, atau label seperti Orang 1/);
    expect(text).toMatch(/hingga 12 tanya jawab terakhir dengan Gogo, dan di channel yang dibacanya juga hingga 30 pesan terakhir, semuanya dari 24 jam terakhir/);
    expect(text).toMatch(/Pesan dari orang yang belum pernah mengobrol dengan Gogo ikut terkirim/);
    expect(text).toMatch(/lebih dulu meneruskannya ke ERNIE 5\.5 Flash milik Baidu di Tiongkok, lalu ke Gemma 4 milik Google jika ERNIE tidak menjawab/);
  });

  it("says what OpenRouter, Baidu and Google keep, and that neither provider trains on it", () => {
    const text = gogoSection().textContent!;
    expect(text).toMatch(/OpenRouter tidak menyimpan isi pesan yang diteruskannya, melainkan data permintaan seperti waktu, model, dan jumlah token/);
    expect(text).toMatch(/materi pelecehan seksual anak dan dapat menyimpan isi yang ditandai, serta dapat menyimpan isi permintaan hanya untuk mencegah penyalahgunaan/);
    expect(text).toMatch(/Baidu menyimpan pesan yang diterimanya tanpa menyebut berapa lama, dan Google menyimpan yang diterimanya paling lama 55 hari/);
    expect(text).toMatch(/Menurut keterangan OpenRouter tentang kedua penyedia itu, keduanya tidak memakai pesan tersebut untuk melatih model/);
    expect(text).toMatch(/jangan tulis data pribadi atau hal rahasia di channel Gogo maupun di DM dengannya/);
    expect(text).toMatch(/\/event dan \/tugas dijawab langsung dari info publik itu, tanpa lewat OpenRouter/);
  });

  it("no longer describes the Gemini free tier (#300)", () => {
    const text = gogoSection().textContent!;
    expect(text).not.toMatch(/Gemini/);
    expect(text).not.toMatch(/Google dapat memakai/);
    expect(text).not.toMatch(/paket gratis/);
    expect(text).not.toMatch(/peninjau manusia/);
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
