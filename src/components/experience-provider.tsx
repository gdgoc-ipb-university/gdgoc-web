"use client";

import Lenis from "lenis";
import { MotionConfig } from "motion/react";
import { createContext, useContext, useEffect, useState } from "react";

const Experience = createContext({ animated: false });
export const useExperience = () => useContext(Experience);

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [systemReduced, setSystemReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  const animated = !systemReduced && !paused;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    const forcedOff = new URLSearchParams(window.location.search).get("motion") === "off";
    // Delay client preferences until after hydration; SSR content remains visible.
    const id = requestAnimationFrame(() => setPaused(forcedOff));
    return () => {
      cancelAnimationFrame(id);
      query.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!animated) return;
    const pointer = window.matchMedia("(pointer: fine)");
    let scroll: Lenis | undefined;
    const sync = () => {
      scroll?.destroy();
      scroll = pointer.matches
        ? new Lenis({ autoRaf: true, anchors: true, duration: 0.9 })
        : undefined;
    };
    const visibility = () => (document.hidden ? scroll?.stop() : scroll?.start());
    sync();
    pointer.addEventListener("change", sync);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      scroll?.destroy();
      pointer.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [animated]);

  return (
    <Experience.Provider value={{ animated }}>
      <MotionConfig reducedMotion="user">
        <div data-motion={animated ? "on" : "off"}>{children}</div>
      </MotionConfig>
    </Experience.Provider>
  );
}
