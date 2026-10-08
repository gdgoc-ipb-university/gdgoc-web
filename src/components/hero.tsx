"use client";

import { useState } from "react";
import { Arrow } from "./icons";
import { CampusEnvironment, type SceneStatus } from "./campus-environment";
import { ScenePreloader } from "./scene-preloader";
import { communityLinks } from "@/lib/community";

export function Hero() {
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("loading");
  return (
    <>
      <ScenePreloader status={sceneStatus} />
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
          <p className="eyebrow">
            <span className="status-dot" /> GOOGLE DEVELOPER GROUP ON CAMPUS
          </p>
          <h1 id="hero-heading">
            Belajar teknologi
            <br />
            <span>bareng GDGoC IPB</span>
          </h1>
          <p className="hero-description">
            Komunitas mahasiswa Bogor untuk belajar coding, UI/UX, dan AI lewat sesi praktik,
            proyek tim, dan diskusi bersama mentor
          </p>
          <a className="button button-blue" href={communityLinks.membership} target="_blank" rel="noreferrer">
            Gabung member <Arrow external />
          </a>
        </div>
        <a href="#community" className="hero-scroll" aria-label="Jelajahi komunitas">
          <Arrow down />
        </a>
      </section>
    </>
  );
}
