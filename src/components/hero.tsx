"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Arrow } from "./icons";
import { CampusEnvironment, type SceneStatus } from "./campus-environment";
import { MemberIntakePopup } from "./member-intake-popup";
import { ScenePreloader } from "./scene-preloader";

export function Hero() {
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("loading");
  // The member intake popup opens only once the loading screen, a native modal dialog of its own, has closed.
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);
  return (
    <>
      <ScenePreloader status={sceneStatus} onFinish={reveal} />
      <MemberIntakePopup ready={revealed} />
      <section
        className="hero"
        aria-labelledby="hero-heading"
        data-campus-interactive
      >
        <div className="hero-art">
          <CampusEnvironment onStatusChange={setSceneStatus} />
        </div>
        <div className="hero-wash" />
        <div className="hero-copy">
          <h1 id="hero-heading">
            Belajar teknologi
            <br />
            <span>bareng GDGoC IPB</span>
          </h1>
          <p className="hero-description">
            Komunitas mahasiswa Bogor untuk belajar coding, UI/UX, dan AI lewat sesi praktik,
            proyek tim, dan diskusi bersama mentor
          </p>
          <Link className="button button-blue" href="/dashboard">
            Gabung member <Arrow />
          </Link>
        </div>
        <a href="#community" className="hero-scroll" aria-label="Jelajahi komunitas">
          <Arrow down />
        </a>
      </section>
    </>
  );
}
