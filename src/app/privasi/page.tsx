import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { communityLinks } from "@/lib/community";

export const metadata: Metadata = { title: "Privasi apresiasi" };

export default function PrivacyPage() {
  return <><Header /><main id="main" className="privacy-page section-width"><p className="eyebrow">GDGOC IPB · APRESIASI</p><h1>Data untuk merayakan prestasi.</h1><p>Halaman ini menjelaskan penggunaan data saat kamu memakai form Apresiasi GDGoC IPB.</p>
    <section><h2>Akun dan isian form</h2><p>Login Google memberikan informasi profil dasar, termasuk nama, email, dan foto profil jika tersedia. Nama dan email dipakai untuk mengenali pemilik draft dan kiriman. Form meminta informasi prestasi, identitas yang akan dicantumkan, akun Instagram, cerita, dan link dokumentasi.</p></section>
    <section><h2>Siapa yang bisa melihat?</h2><p>Draft hanya bisa diakses pemilik akun melalui aplikasi. Setelah dikirim, informasi tersedia bagi admin yang ditunjuk untuk meninjau dan menyiapkan apresiasi. Pengelola teknis memiliki akses ke penyimpanan layanan untuk menjalankan aplikasi. Data tidak ditampilkan sebagai daftar publik di website.</p></section>
    <section><h2>Materi untuk Instagram</h2><p>Dengan memberikan persetujuan saat mengirim form, kamu mengizinkan penggunaan nama, akun Instagram, cerita, dan dokumentasi untuk materi apresiasi GDGoC IPB. Email login tidak termasuk materi publikasi. Tim meninjau kiriman sebelum menyiapkan collab post; mengirim form tidak menjamin waktu publikasi.</p></section>
    <section><h2>Penyimpanan dan layanan</h2><p>Akun, sesi, draft, dan kiriman disimpan menggunakan Convex. Website dihosting di Vercel dan login diproses melalui Google. Browser memakai cookie sesi untuk login serta cadangan lokal per akun untuk memulihkan perubahan draft yang belum tersinkron. Cadangan lokal dihapus setelah perubahan berhasil tersimpan ke akun.</p><p>Link dokumentasi tetap berada di layanan asal, misalnya Google Drive. Atur akses link agar materi yang dibagikan sesuai kebutuhan dan hindari memasukkan data sensitif yang tidak diperlukan.</p></section>
    <section><h2>Mengubah atau menghapus data</h2><p>Kamu bisa mengubah dan menghapus draft yang belum dikirim dari halaman Apresiasi. Untuk koreksi kiriman, penarikan persetujuan publikasi, atau permintaan penghapusan data akun dan kiriman, hubungi <a href={communityLinks.instagram} target="_blank" rel="noreferrer">@gdgoc.ipb</a> dengan menyebutkan email akun dan prestasi yang dimaksud.</p></section>
    <Link className="button button-blue" href="/apresiasi">Kembali ke Apresiasi</Link>
  </main></>;
}
