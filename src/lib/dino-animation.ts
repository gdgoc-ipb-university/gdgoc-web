/** Short, asymmetric blinks with an occasional double blink. Time is scene-local. */
export function dinoEyeOpenness(elapsed: number) {
  const time = elapsed % 14;
  for (const start of [2.8, 7.1, 7.48, 12.3]) {
    const phase = time - start;
    if (phase < 0 || phase > 0.28) continue;
    if (phase < 0.07) return 1 - (phase / 0.07) * 0.9;
    if (phase < 0.15) return 0.1;
    const opening = (phase - 0.15) / 0.13;
    return 0.1 + opening * opening * (3 - 2 * opening) * 0.9;
  }
  return 1;
}
