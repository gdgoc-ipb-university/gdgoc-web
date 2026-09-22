"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Arrow, PixelSpark } from "./icons";
import { useExperience } from "./experience-provider";
import type { Direction } from "@/lib/directions";
import { CampusEnvironment } from "./campus-environment";

export function Hero({ direction }: { direction: Direction }) {
  const { animated, toggleMotion } = useExperience();
  return (
    <section
      className={`hero ${direction.dark ? "hero-night" : ""}`}
      aria-labelledby="hero-heading"
    >
      <div className="hero-art">
        {direction.id === "hello-campus" ? (
          <CampusEnvironment />
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
          <span className="status-dot" /> GDG ON CAMPUS · IPB UNIVERSITY
        </p>
        <h1 id="hero-heading">
          Small pixels.
          <br />
          <span>Big possibilities.</span>
          <PixelSpark className="hero-spark" />
        </h1>
        <p className="hero-description">
          Berawal dari rasa ingin tahu.
          <br className="mobile-only" /> Bertumbuh lewat karya dan teman baru.
        </p>
        <motion.a
          className="button button-blue"
          href="#explore"
          whileHover={animated ? { y: -3 } : undefined}
          whileTap={animated ? { y: 0 } : undefined}
        >
          Find your people <Arrow diagonal />
        </motion.a>
      </div>
      <div className="hero-caption">
        <span className="pixel-square" /> BOGOR, INDONESIA{" "}
        <span className="caption-separator">/</span> BUILT ON CURIOSITY
      </div>
      <a href="#community" className="hero-scroll" aria-label="Jelajahi komunitas">
        <Arrow down />
      </a>
      <button
        className="motion-toggle"
        type="button"
        aria-pressed={!animated}
        onClick={toggleMotion}
        aria-label={
          animated ? "Jeda animasi" : "Aktifkan animasi jika pengaturan perangkat mengizinkan"
        }
      >
        <span aria-hidden="true">{animated ? "Ⅱ" : "▷"}</span>
        <span>{animated ? "Pause motion" : "Motion off"}</span>
      </button>
    </section>
  );
}
