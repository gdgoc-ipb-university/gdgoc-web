"use client";

import { useEffect, useRef, useState } from "react";
import { useExperience } from "./experience-provider";
import { PixelDino } from "./icons";
import type { mountDino } from "@/lib/dino-scene";

const greetings = [
  "Small steps count, too.",
  "Hello, fellow builder!",
  "Keep being curious.",
  "Let’s make something cool.",
];

export function DinoPlayground() {
  const { animated } = useExperience();
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof mountDino> | null>(null);
  const [greeting, setGreeting] = useState(0);
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
      <p className="dino-speech" aria-live="polite">
        {greetings[greeting % greetings.length]}
      </p>
      <button
        className="dino-button"
        type="button"
        aria-label="Sapa Dino"
        onClick={() => {
          setGreeting(greeting + 1);
          controller.current?.jump();
        }}
      >
        <div ref={host} className="dino-canvas">
          <span className="dino-fallback">
            <PixelDino />
          </span>
        </div>
      </button>
      <span className="dino-hint">
        CLICK TO SAY HELLO <span aria-hidden="true">↗</span>
      </span>
    </div>
  );
}
