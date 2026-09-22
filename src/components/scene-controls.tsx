"use client";
import { useExperience } from "./experience-provider";
export function SceneControls() {
  const { animated, toggleMotion } = useExperience();
  return (
    <button onClick={toggleMotion} aria-pressed={!animated} type="button">
      {animated ? "Pause motion" : "Motion off"}
    </button>
  );
}
