import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { JoinFooter } from "@/components/join-footer";
import { DariIpbUntukBogor } from "@/components/journey/bogor";
import { Journey } from "@/components/journey/journey";
import { Kenalan, StartLine } from "@/components/journey/kenalan";
import { TigaMisi } from "@/components/journey/missions";
import { PilihJalurmu } from "@/components/journey/programs";
import "@/components/journey/journey.css";

/**
 * The landing page: the hero, then the member journey (#165), a road through five chapters, then the footer.
 * The header's scrollspy follows `#community`, `#explore` and `#join`.
 */
export function Landing() {
  return (
    <>
      <a className="skip-link" href="#community">
        Lewati ke konten
      </a>
      <Header />
      <main>
        <Hero />
        <Journey>
          <StartLine />
          <Kenalan />
          <TigaMisi />
          <PilihJalurmu />
          <DariIpbUntukBogor />
        </Journey>
      </main>
      <JoinFooter />
    </>
  );
}
