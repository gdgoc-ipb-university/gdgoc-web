"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

const colors = ["blue", "red", "yellow", "green"] as const;

function ProgressSegment({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const scaleX = useTransform(progress, [index / 4, (index + 1) / 4], [0, 1]);

  return (
    <span className="scroll-progress-segment" data-color={colors[index]}>
      <motion.span className="scroll-progress-fill" style={{ scaleX }} />
    </span>
  );
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  return (
    <div className="scroll-progress" aria-hidden="true">
      {colors.map((color, index) => <ProgressSegment key={color} progress={scrollYProgress} index={index} />)}
    </div>
  );
}
