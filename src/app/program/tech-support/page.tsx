import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { Header } from "@/components/header";
import { Arrow } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { PixelIcon } from "@/components/pixel-icons";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { faqJsonLd } from "@/lib/faq";
import { canonical } from "@/lib/site";
import { requestLink, techSupport, techSupportFaq, techSupportJsonLd } from "@/lib/tech-support";

export const metadata: Metadata = {
  title: "Tech Support",
  description: techSupport.description,
  ...canonical(techSupport.path),
};

function RequestStatus() {
  const request = requestLink();
  return <div className="league-status" role="status">
    <p>Untuk member GDGoC IPB. Permintaan dibalas paling lama {techSupport.responseDays} hari kerja.</p>
    <div className="league-actions">
      {request.external
        ? <a className="button button-blue" href={request.href} target="_blank" rel="noreferrer">{request.label} <Arrow external /></a>
        : <Link className="button button-blue" href={request.href}>{request.label} <Arrow /></Link>}
      <Link className="text-button" href="/bergabung">Belum member? Lihat cara bergabung <Arrow /></Link>
    </div>
  </div>;
}

export default function TechSupportPage() {
  return <>
    <JsonLd data={techSupportJsonLd()} />
    <JsonLd data={faqJsonLd(techSupportFaq)} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Program", path: "/program" }, { name: "Tech Support", path: techSupport.path }])} />
    <Header />
    <main id="main" className="league-page section-width">
      <p className="eyebrow">GDGOC IPB · COMPETITION SUPPORT HUB · SEPANJANG TAHUN</p>
      <h1>Tech Support.</h1>
      <p className="league-lead">Mau ikut lomba? Tech Support mencarikan mentor untuk member GDGoC IPB yang sedang bersiap mengikuti kompetisi eksternal, lalu memfasilitasi konsultasi pertamanya. Bukan layanan perbaikan perangkat.</p>
      <RequestStatus />

      <section aria-labelledby="support-steps">
        <h2 id="support-steps">Cara kerja</h2>
        <ol className="support-steps">{techSupport.steps.map((step, index) => <li key={step.title}>
          <span className="support-step-number">{String(index + 1).padStart(2, "0")}</span>
          <div><strong>{step.title}</strong><p>{step.text}</p></div>
        </li>)}</ol>
        <p className="league-note">Cakupan disepakati di awal supaya mentor tahu batas komitmennya dan tim tahu apa yang bisa diharapkan.</p>
      </section>

      <section aria-labelledby="support-help">
        <h2 id="support-help">Bentuk dukungan</h2>
        <ul className="league-categories support-help">{techSupport.helpKinds.map((kind) => <li key={kind}><PixelIcon name="check" size={20} /><span>{kind}</span></li>)}</ul>
      </section>

      <section aria-labelledby="support-mentors">
        <h2 id="support-mentors">Mentor</h2>
        <ul className="league-categories catalyst-roles">{techSupport.mentors.map((mentor) => <li key={mentor.name}>
          <PixelIcon name="teach" size={32} />
          <span>{mentor.name}</span>
          <small>{mentor.role}</small>
        </li>)}</ul>
        <p className="league-note">Mentor dicari sesuai kebutuhan tiap permintaan, dari mentor di atas maupun jaringan alumni, praktisi, dan komunitas partner.</p>
      </section>

      <section aria-labelledby="support-faq">
        <h2 id="support-faq">Pertanyaan umum</h2>
        <Faq items={techSupportFaq} className="league-faq" />
      </section>
    </main>
  </>;
}
