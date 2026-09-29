// Author: Khadim Gueye

export const LOW_SAMPLES = 20;

export function wilson(p: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1];
  const q = Math.max(0, Math.min(1, p));
  const z2 = z * z;
  const centre = (q + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((q * (1 - q)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function ciText(p: number, n: number) {
  const [lo, hi] = wilson(p, n);
  return `${pct(lo)} to ${pct(hi)}`;
}
