"use client";

import { animate, inView } from "motion";
import { useEffect, useRef } from "react";
import { useExperience } from "./experience-provider";

export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { animated } = useExperience();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!animated) {
      node.getAnimations().forEach((animation) => animation.cancel());
      node.style.removeProperty("opacity");
      node.style.removeProperty("transform");
      return;
    }
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.style.opacity = "0";
    node.style.transform = "translateY(22px)";
    let animation: ReturnType<typeof animate> | undefined;
    const stop = inView(
      node,
      () => {
        animation = animate(
          node,
          { opacity: 1, transform: "translateY(0px)" },
          { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
        );
      },
      { margin: "0px 0px -40px 0px" },
    );
    return () => {
      stop();
      animation?.cancel();
      node.style.removeProperty("opacity");
      node.style.removeProperty("transform");
    };
  }, [animated]);
  return (
    <div ref={ref} className={className} data-reveal>
      {children}
    </div>
  );
}
