"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useExperience } from "./experience-provider";
import type { mountCampus } from "@/lib/campus/runtime";

export function CampusEnvironment({ controls = true }: { controls?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof mountCampus> | null>(null);
  const { animated } = useExperience();
  const motion = useRef(animated);
  const [ready, setReady] = useState(false);
  const [greetings, setGreetings] = useState(0);
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
              onGreet: () => setGreetings((n) => n + 1),
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
        aria-label="Environment 3D AHN IPB dan taman pixel. Dino dapat disapa lewat tombol di bawah."
      />
      {controls && ready && (
        <button
          className="campus-greet"
          onClick={() => controller.current?.greet()}
          type="button"
          aria-label="Sapa Chrome Dino di taman"
        >
          Say hello <span aria-hidden="true">↗</span>
        </button>
      )}
      <span className="campus-greeting" role="status">
        {greetings > 0
          ? greetings % 2
            ? "Hello, fellow builder!"
            : "Stay curious. Keep building."
          : ""}
      </span>
    </div>
  );
}
