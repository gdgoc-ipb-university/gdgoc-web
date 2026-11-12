import { Arrow } from "./icons";
import { Reveal } from "./reveal";
import { communityLinks } from "@/lib/community";
import { team } from "@/lib/team";
import { techLeague } from "@/lib/tech-league";
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
            <Link className="button button-blue" href="/dashboard">
              Gabung member <Arrow />
            </Link>
            <p className="join-note">Daftar dengan akun Google · <Link href="/bergabung">Cara lain untuk bergabung</Link></p>
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
              <Link href="/tentang">Tentang komunitas</Link>
              <Link href={team.path}>Tim {team.year}</Link>
              <Link href="/bergabung">Cara bergabung</Link>
              <Link href="/program">Program kami</Link>
              <Link href={techLeague.href}>Tech League</Link>
              <Link href="/dashboard/apresiasi">Apresiasi prestasi</Link>
              <Link href="/dashboard">Dashboard member</Link>
            </nav>
            <nav aria-label="Kanal komunitas">
              <p className="eyebrow">KABAR & KOLABORASI</p>
              <a href={communityLinks.instagram} target="_blank" rel="noreferrer">
                Instagram <Arrow external />
              </a>
              <a href={communityLinks.discord} target="_blank" rel="noreferrer">
                Discord <Arrow external />
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
