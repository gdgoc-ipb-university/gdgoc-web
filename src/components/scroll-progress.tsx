"use client";

import { motion, useScroll } from "motion/react";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return <div className="scroll-progress" aria-hidden="true"><motion.span style={{ scaleX: scrollYProgress }} /></div>;
}
