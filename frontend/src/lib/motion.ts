// Author: Khadim Gueye

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function animate(duration: number, onFrame: (k: number) => void, ease = easeInOut) {
  if (prefersReducedMotion() || duration <= 0) {
    onFrame(1);
    return () => {};
  }
  let start: number | null = null;
  let id = requestAnimationFrame(function step(now) {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / duration);
    onFrame(ease(t));
    if (t < 1) id = requestAnimationFrame(step);
  });
  return () => cancelAnimationFrame(id);
}
