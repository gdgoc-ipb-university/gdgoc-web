"use client";

import Link from "next/link";
import { useState } from "react";
import { Arrow } from "./icons";
import { CampusEnvironment, type SceneStatus } from "./campus-environment";
import { ScenePreloader } from "./scene-preloader";

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
