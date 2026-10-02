"use client";

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
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        animation = node.animate(
          { opacity: [0, 1], transform: ["translateY(22px)", "translateY(0)"] },
          { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
      },
      { rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
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
