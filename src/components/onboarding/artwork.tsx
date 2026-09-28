import { PixelDino, PixelSpark } from "../icons";
import type { OnboardingStep } from "@/lib/onboarding";

const captions = ["Teman belajarmu, mulai di sini.", "Beda jurusan. Bisa bikin bareng.", "Member atau pengurus, semua belajar.", "Ada teman buat tanya & cerita.", "Satu komunitas, banyak kesempatan."];

export function OnboardingArtwork({ step }: { step: OnboardingStep }) {
  return <aside className="onboard-art" data-step={step} aria-hidden="true">
    <div className="onboard-art-top"><span>GDGOC IPB</span><span>BELAJAR & BERKARYA</span></div>
    <div className="onboard-art-scene">
      <div className="onboard-pixel-cloud cloud-one" /><div className="onboard-pixel-cloud cloud-two" />
      <PixelSpark className="onboard-art-spark spark-one" /><PixelSpark className="onboard-art-spark spark-two" />
      <div className="onboard-art-card">
        {step === 1 ? <><span className="art-card-kicker">HELLO, WORLD!</span><span className="art-card-name">Halo, kamu.</span><span className="art-card-line" /><span className="art-card-line short" /></> :
          step === 2 ? <><svg viewBox="0 0 180 100" className="art-campus" shapeRendering="crispEdges"><path fill="#c96943" d="m90 4 76 39H14z"/><path fill="#fff9e7" d="M20 44h140v11H20zM12 65h156v11H12zM4 86h172v12H4z"/><path fill="#254c61" d="M25 55h130v10H25zM20 76h140v10H20z"/><path fill="#9e5039" d="M80 37h20v61H80z"/><path fill="#ffeab3" d="M87 44h6v23h-6z"/></svg><span className="art-card-kicker">KAMPUSMU, CERITAMU.</span></> :
          step === 3 ? <><span className="art-card-kicker">MEMBER · CORE TEAM</span><span className="art-card-name">Satu tim,<br />banyak peran.</span><span className="art-role-chips"><i>Program</i><i>Media</i><i>Technical</i><i>Community</i><i>Secretary</i></span></> :
          step === 4 ? <><span className="art-card-kicker">GDGOC IPB · WHATSAPP</span><span className="art-chat-bubble">Halo, teman-teman! <span>✦</span></span><span className="art-chat-bubble reply">Yuk, belajar bareng.</span><span className="art-chat-dots">▪ ▪ ▪</span></> :
          <><span className="art-card-kicker">GOOGLE DEVELOPER GROUPS</span><span className="art-card-name">Let’s build<br />together.</span><div className="art-google-blocks"><i/><i/><i/><i/></div></>}
      </div>
      <div className="onboard-art-dino"><PixelDino /></div>
      <div className="onboard-art-block block-blue" /><div className="onboard-art-block block-yellow" /><div className="onboard-art-block block-green" />
      <div className="onboard-art-ground" />
    </div>
    <p>{captions[step - 1]}</p><span className="onboard-art-bottom">KOMUNITAS MAHASISWA BOGOR <span>✳</span></span>
  </aside>;
}
