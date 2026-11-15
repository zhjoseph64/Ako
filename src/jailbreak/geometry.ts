export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 768;
export const DRAGON_ANCHOR = { x: 512, y: 372 };

const RINGS = [
  { cy: 352, rx: 185, ry: 82 },
  { cy: 381, rx: 282, ry: 140 },
  { cy: 412, rx: 420, ry: 200 },
];

const SLOT_ANGLES = [90, 38, 142, 352, 188, 312, 228, 270];

export function ringPosition(ring: number, slot: number) {
  const clamped = Math.min(3, Math.max(1, ring));
  const lower = Math.min(1, Math.floor(clamped) - 1);
  const t = clamped - 1 - lower;
  const a = RINGS[lower];
  const b = RINGS[lower + 1];
  const cy = a.cy + (b.cy - a.cy) * t;
  const rx = a.rx + (b.rx - a.rx) * t;
  const ry = a.ry + (b.ry - a.ry) * t;
  const angle = (SLOT_ANGLES[slot % SLOT_ANGLES.length] * Math.PI) / 180;
  return { x: 512 + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}

export function ringLabel(ring: number) {
  return Number.isInteger(ring) ? `Ring ${ring}` : `Ring ${ring.toFixed(1)}`;
}
