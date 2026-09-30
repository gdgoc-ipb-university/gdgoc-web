import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { Arrow } from "@/components/icons";

export const metadata: Metadata = {
  title: "Empat arah CTA + footer",
  robots: { index: false, follow: false },
};

const concepts = [
  {
    slug: "01-taman-kampus",
    name: "Taman kampus",
    label: "LANJUTAN DARI HERO",
    description: "Jalur taman, kolam, dan Dino membawa suasana kampus sampai ke akhir halaman. Copy di kiri, ruang komunitas di kanan, navigasi di tepi jalur",
    note: "Paling dekat dengan environment landing yang sekarang",
    alt: "Konsep CTA dan footer terang dengan taman kampus, Dino, bangku biru, dan ajakan Gabung member",
  },
  {
    slug: "02-meja-kolaborasi",
    name: "Meja kolaborasi",
    label: "RUANG UNTUK BIKIN KARYA",
    description: "Laptop, sketsa UI, dan catatan proyek berkumpul di satu meja. Permukaan meja berlanjut menjadi footer, menghubungkan ajakan bergabung dengan kegiatan komunitas",
    note: "Paling jelas menyampaikan kolaborasi Hustler, Hipster, dan Hacker",
    alt: "Konsep CTA dan footer krem dengan meja kerja cel-shaded, laptop biru, sketsa desain, buku merah, dan Dino kecil",
  },
  {
    slug: "03-gerbang-komunitas",
    name: "Gerbang komunitas",
    label: "MASUK KE KOMUNITAS",
    description: "Gerbang warna Google dan jalur taman membingkai CTA di tengah. Identitas komunitas dan navigasi ditempatkan di ujung jalur pada permukaan yang sama",
    note: "Penutup paling imersif, dengan ajakan masuk sebagai fokus",
    alt: "Konsep CTA dan footer dengan gerbang pixel berwarna Google, jalan taman, Dino, dan tombol Gabung member di tengah",
  },
  {
    slug: "04-mosaik-karya",
    name: "Mosaik karya",
    label: "IDENTITAS YANG BERANI",
    description: "Modul kode, desain, proyek, dan komunitas menjadi patung pixel. Wordmark GDGoC IPB berskala besar menutup halaman, dengan bunga yang tumbuh di sela huruf",
    note: "Paling kuat untuk penutup company profile yang berfokus pada identitas",
    alt: "Konsep CTA dan footer dengan empat modul pixel warna Google dan wordmark GDGoC IPB besar di atas latar krem",
  },
];

export default function FooterDirectionsPage() {
  return (
    <>
      <Header review />
      <main className="directions-page section-width footer-directions-page">
        <div className="directions-intro">
          <p className="eyebrow">GDGOC IPB · CTA + FOOTER · EKSPLORASI VISUAL</p>
          <h1>Empat cara<br /><span>mengajak bergabung.</span></h1>
          <p>
            Satu permukaan terang, satu CTA utama: Gabung member. Empat konsep gambar
            ini mengeksplorasi cara ajakan dan footer menyatu dengan dunia cel-shaded GDGoC IPB
          </p>
          <div className="type-chips">
            <span>Latar krem</span><span>Warna vibrant</span><span>Pixel + cel shading</span>
          </div>
        </div>
        <div className="directions-grid">
          {concepts.map((concept, index) => (
            <article className="direction-card" key={concept.slug}>
              <a className="direction-image footer-concept-image" href={`/footer-directions/${concept.slug}.png`} target="_blank" rel="noreferrer" aria-label={`Buka gambar ${concept.name} ukuran penuh`}>
                <Image src={`/footer-directions/${concept.slug}.webp`} alt={concept.alt} fill loading="eager" sizes="(max-width: 760px) 100vw, 50vw" />
              </a>
              <div className="direction-info">
                <p className="eyebrow">0{index + 1} / {concept.label}</p>
                <h2>{concept.name}</h2>
                <p>{concept.description}</p>
                <p className="footer-concept-note">{concept.note}</p>
                <div className="direction-actions">
                  <a href={`/footer-directions/${concept.slug}.png`} target="_blank" rel="noreferrer">Lihat ukuran penuh <Arrow external /></a>
                  <a href={`/footer-directions/${concept.slug}.png`} download>Download PNG <Arrow download /></a>
                </div>
              </div>
            </article>
          ))}
        </div>
        <aside className="direction-note">
          <p>Keempat gambar adalah konsep visual hasil imagegen. Footer landing saat ini tetap tersedia untuk dibandingkan</p>
          <Link href="/#join">Lihat footer saat ini <Arrow /></Link>
        </aside>
      </main>
    </>
  );
}
