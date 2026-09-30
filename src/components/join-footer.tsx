import { Arrow } from "./icons";
import { Reveal } from "./reveal";
import { communityLinks } from "@/lib/community";
import Link from "next/link";
import { BogorRun } from "./bogor-run";

export function JoinFooter() {
  return (
    <footer id="join" className="join-footer" aria-labelledby="join-heading">
      <BogorRun
        invitation={
          <Reveal className="join-copy">
            <p className="eyebrow">JADI MEMBER GDGOC IPB</p>
            <h2 id="join-heading">
              Jadi bagian dari
              <br />
              <span>GDGoC IPB</span>
            </h2>
            <p className="join-description">
              Temukan teman belajar, ikuti kegiatan teknologi, dan kembangkan proyekmu
              bersama komunitas mahasiswa Bogor
            </p>
            <a
              className="button button-blue"
              href={communityLinks.membership}
              target="_blank"
              rel="noreferrer"
            >
              Gabung member <Arrow external />
            </a>
            <p className="join-note">Lewat halaman resmi Google Developer Groups</p>
          </Reveal>
        }
      >
        <div className="section-width">
          <div className="footer-directory">
            <div className="footer-identity">
              <p className="eyebrow">DARI KAMPUS, BUAT BOGOR</p>
              <p className="footer-wordmark">GDGoC <span>IPB</span></p>
              <p>Google Developer Group on Campus<br />IPB University</p>
            </div>
            <nav aria-label="Jelajahi komunitas">
              <p className="eyebrow">KENALI KAMI</p>
              <a href="#community">Tentang komunitas</a>
              <a href="#explore">Program kami</a>
              <Link href="/dashboard/apresiasi">Apresiasi prestasi</Link>
              <Link href="/dashboard">Dashboard member</Link>
              <a href={communityLinks.membership} target="_blank" rel="noreferrer">
                Halaman GDG <Arrow external />
              </a>
            </nav>
            <nav aria-label="Kanal komunitas">
              <p className="eyebrow">KABAR & KOLABORASI</p>
              <a href={communityLinks.instagram} target="_blank" rel="noreferrer">
                Instagram <Arrow external />
              </a>
              <Link href="/privasi">Privasi</Link>
              <p className="footer-contact">Punya ide kolaborasi?<br />Hubungi @gdgoc.ipb</p>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>© 2026 GDGoC IPB University</span>
            <span>Terbuka untuk berbagai jurusan, disatukan oleh teknologi</span>
          </div>
        </div>
      </BogorRun>
    </footer>
  );
}
