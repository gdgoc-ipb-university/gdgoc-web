"use client";

import { useEffect, useRef } from "react";
import { useExperience } from "./experience-provider";
import { PixelDino } from "./icons";
import type { mountDino } from "@/lib/dino-scene";

export function DinoPlayground() {
  const { animated } = useExperience();
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof mountDino> | null>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let disposed = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        void import("@/lib/dino-scene")
          .then(({ mountDino }) => {
            if (!disposed) controller.current = mountDino(node, animated);
          })
          .catch(() => {
            node.dataset.ready = "false";
          });
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => {
      disposed = true;
      observer.disconnect();
      controller.current?.dispose();
      controller.current = null;
    };
  }, [animated]);
  return (
    <div className="dino-playground">
      <p className="dino-speech">Baru belajar? Yuk, mulai bareng!</p>
      <div className="dino-display" role="img" aria-label="Diorama 3D Chrome Dino di taman pixel">
        <div ref={host} className="dino-canvas">
          <span className="dino-fallback">
            <PixelDino />
          </span>
        </div>
      </div>
    </div>
  );
}
