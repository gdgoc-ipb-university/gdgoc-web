import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Arrow } from "@/components/icons";
import { JoinFooter } from "@/components/join-footer";
import { JsonLd } from "@/components/json-ld";
import { TwibbonMaker } from "@/components/twibbon/twibbon-maker";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { canonical } from "@/lib/site";
import { twibbon } from "@/lib/twibbon";
import "../dashboard/apresiasi.css";
import "./twibbon.css";

export const metadata: Metadata = {
  title: "Twibbon member 2026/27",
  description: "Buat twibbon member GDGoC IPB 2026/27 langsung di browser: pilih foto, atur posisinya, unduh dua slide, dan salin caption untuk Instagram.",
  ...canonical(twibbon.path),
};

/** The posting rules from the member intake guidebook and the intake posts. */
const steps = [
  { title: "Unggah dua slide di feed", text: "Twibbon di slide pertama, slide 2 di belakangnya, dalam satu postingan. Bukan story." },
  { title: "Tempel caption", text: "Tag @gdgoc.ipb dan 3 teman di caption." },
  { title: "Biarkan akunmu publik", text: "Supaya postinganmu bisa dicek sampai pendaftaran selesai." },
  { title: "Isi form pendaftaran", text: "Masuk dengan akun Google di website ini dan lengkapi perkenalan. Cukup daftar sekali." },
];

export default function TwibbonPage() {
  return <>
    <JsonLd data={breadcrumbJsonLd([{ name: "Bergabung", path: "/bergabung" }, { name: "Twibbon", path: twibbon.path }])} />
    <Header />
    <main id="main" className="league-page twibbon-page section-width">
      <p className="eyebrow">GDGOC IPB · OPEN RECRUITMENT MEMBER 2026/27</p>
      <h1>Twibbon member.</h1>
      <p className="league-lead">Pasang fotomu di bingkai member GDGoC IPB, unduh, lalu unggah ke feed Instagram bersama slide kedua.</p>

      <TwibbonMaker />

      <section aria-labelledby="twibbon-steps">
        <h2 id="twibbon-steps">Cara posting</h2>
        <ol className="support-steps">{steps.map((step, index) => <li key={step.title}>
          <span className="support-step-number">{String(index + 1).padStart(2, "0")}</span>
          <div><strong>{step.title}</strong><p>{step.text}</p></div>
        </li>)}</ol>
        <div className="league-actions">
          <Link className="button button-blue" href="/dashboard">Daftar member <Arrow /></Link>
          <a className="text-button" href="/gb-member" target="_blank" rel="noreferrer">Baca guidebook <Arrow external /></a>
        </div>
      </section>
    </main>
    <JoinFooter />
  </>;
}
