"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useExperience } from "./experience-provider";
import type { mountCampus } from "@/lib/campus/runtime";

export function CampusEnvironment() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof mountCampus> | null>(null);
  const { animated } = useExperience();
  const motion = useRef(animated);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    motion.current = animated;
    controller.current?.setAnimated(animated);
  }, [animated]);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let disposed = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (new URLSearchParams(window.location.search).get("webgl") === "off") return;
        void import("@/lib/campus/runtime")
          .then(({ mountCampus }) => {
            if (disposed) return;
            controller.current = mountCampus(node, {
              animated: motion.current,
              onReady: () => setReady(true),
              onFailure: () => setReady(false),
            });
          })
          .catch(() => setReady(false));
      },
      { rootMargin: "100px" },
    );
    observer.observe(node);
    return () => {
      disposed = true;
      observer.disconnect();
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  return (
    <div className="campus-environment" data-ready={ready}>
      <Image
        className="campus-fallback"
        src="/environments/01-hello-campus-ahn-cel-v2.webp"
        alt="Kampus cel-shaded dengan AHN bertingkat, atap limas merah, taman voxel, kolam, bangku warna Google, dan Chrome Dino."
        fill
        preload
        quality={90}
        sizes="100vw"
      />
      <div
        ref={host}
        className="campus-canvas"
        role="img"
        aria-hidden={!ready}
        aria-label="Environment 3D AHN IPB, Chrome Dino, taman pixel, Gunung Salak berkabut di kiri, dan tanaman foreground."
      />
    </div>
  );
}
