"use client";

import { useEffect, useRef } from "react";

const colors = ["blue", "red", "yellow", "green"] as const;

export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fills = Array.from(bar.current?.querySelectorAll<HTMLElement>(".scroll-progress-fill") ?? []);
    let frame = 0;
    const paint = () => {
      frame = 0;
      const range = document.documentElement.scrollHeight - window.innerHeight;
      const progress = range > 0 ? window.scrollY / range : 0;
      // Each quarter of the page fills one segment; the styles are written directly so scrolling never re-renders.
      fills.forEach((fill, index) => {
        fill.style.transform = `scaleX(${Math.min(1, Math.max(0, progress * colors.length - index))})`;
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, []);

  return (
    <div ref={bar} className="scroll-progress" aria-hidden="true">
      {colors.map((color) => (
        <span key={color} className="scroll-progress-segment" data-color={color}>
          <span className="scroll-progress-fill" />
        </span>
      ))}
    </div>
  );
}
