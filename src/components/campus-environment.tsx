"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useExperience } from "./experience-provider";
import type { mountCampus } from "@/lib/campus/runtime";

export type SceneStatus = "loading" | "ready" | "fallback";

export function CampusEnvironment({
  onStatusChange,
}: {
  onStatusChange?: (status: SceneStatus) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof mountCampus> | null>(null);
  const { animated } = useExperience();
  const motion = useRef(animated);
  const fallbackLoaded = useRef(false);
  const fallbackRequested = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    motion.current = animated;
    controller.current?.setAnimated(animated);
  }, [animated]);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let disposed = false;
    let abandoned = false;
    const fallback = () => {
      if (disposed) return;
      fallbackRequested.current = true;
      setReady(false);
      if (fallbackLoaded.current) onStatusChange?.("fallback");
    };
    // A stalled import/GPU must still leave the community profile usable.
    const watchdog = window.setTimeout(() => {
      abandoned = true;
      controller.current?.dispose();
      controller.current = null;
      fallback();
      onStatusChange?.("fallback");
    }, 12_000);
    if (new URLSearchParams(window.location.search).get("webgl") === "off") {
      fallback();
    } else {
      // Eager first frame also handles a reload at an anchor below the hero.
      void import("@/lib/campus/runtime")
        .then(({ mountCampus }) => {
          if (disposed || abandoned) return;
          controller.current = mountCampus(node, {
            animated: motion.current,
            onReady: () => {
              if (disposed) return;
              clearTimeout(watchdog);
              fallbackRequested.current = false;
              setReady(true);
              onStatusChange?.("ready");
            },
            onFailure: fallback,
          });
        })
        .catch(fallback);
    }
    return () => {
      disposed = true;
      clearTimeout(watchdog);
      controller.current?.dispose();
      controller.current = null;
    };
  }, [onStatusChange]);
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
        onLoad={() => {
          fallbackLoaded.current = true;
          if (fallbackRequested.current) onStatusChange?.("fallback");
        }}
        onError={() => {
          fallbackLoaded.current = true;
          if (fallbackRequested.current) onStatusChange?.("fallback");
        }}
      />
      <div
        ref={host}
        className="campus-canvas"
        role="img"
        aria-hidden={!ready}
        aria-label="Environment 3D AHN IPB, Chrome Dino berkedip, burung voxel di langit, taman pixel, Gunung Salak berkabut di kiri, dan tanaman foreground."
      />
    </div>
  );
}
