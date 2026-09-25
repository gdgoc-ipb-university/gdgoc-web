"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "motion/react";
import { Arrow } from "./icons";
import { useExperience } from "./experience-provider";
import type { Direction } from "@/lib/directions";
import { CampusEnvironment, type SceneStatus } from "./campus-environment";
import { ScenePreloader } from "./scene-preloader";
import { communityLinks } from "@/lib/community";

export function Hero({ direction }: { direction: Direction }) {
  const { animated } = useExperience();
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("loading");
  return (
    <>
      {direction.id === "hello-campus" && <ScenePreloader status={sceneStatus} />}
      <section
        className={`hero ${direction.dark ? "hero-night" : ""}`}
        aria-labelledby="hero-heading"
        data-campus-interactive
      >
        <div className="hero-art">
          {direction.id === "hello-campus" ? (
            <CampusEnvironment onStatusChange={setSceneStatus} />
          ) : (
            <Image
              src={direction.image}
              alt={direction.alt}
              fill
              preload
              sizes="100vw"
              quality={90}
            />
          )}
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
          <motion.a
            className="button button-blue"
            href={communityLinks.membership}
            target="_blank"
            rel="noreferrer"
            whileHover={animated ? { y: -3 } : undefined}
            whileTap={animated ? { y: 0 } : undefined}
          >
            Gabung member <Arrow diagonal />
          </motion.a>
        </div>
        <a href="#community" className="hero-scroll" aria-label="Jelajahi komunitas">
          <Arrow down />
        </a>
      </section>
    </>
  );
}
