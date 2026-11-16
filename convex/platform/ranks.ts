export type TierKey =
  | "echo"
  | "pattern"
  | "signal"
  | "variant"
  | "outlier"
  | "anomaly"
  | "paradox"
  | "singular";

export const TIERS: { key: TierKey; label: string; min: number; multiplier: number }[] = [
  { key: "echo", label: "Echo", min: 0, multiplier: 1 },
  { key: "pattern", label: "Pattern", min: 500, multiplier: 1.1 },
  { key: "signal", label: "Signal", min: 1000, multiplier: 1.25 },
  { key: "variant", label: "Variant", min: 1500, multiplier: 1.4 },
  { key: "outlier", label: "Outlier", min: 2000, multiplier: 1.6 },
  { key: "anomaly", label: "Anomaly", min: 2500, multiplier: 1.85 },
  { key: "paradox", label: "Paradox", min: 3000, multiplier: 2.2 },
  { key: "singular", label: "Singular", min: 3500, multiplier: 3 },
];

export const TIER_SPAN = 500;
export const START_RATING = 1000;
export const POINTS_PER_DOLLAR = 100;

export function rankFor(rating: number) {
  const index = TIERS.findLastIndex((t) => rating >= t.min);
  const tier = TIERS[Math.max(0, index)];
  const next = TIERS[index + 1] ?? null;
  const divisionSpan = TIER_SPAN / 3;
  const offset = Math.max(0, rating - tier.min);
  const division = Math.min(3, Math.floor(offset / divisionSpan) + 1);
  const rp = Math.min(100, Math.floor(((offset - (division - 1) * divisionSpan) / divisionSpan) * 100));
  return {
    tier: tier.key,
    tierLabel: tier.label,
    division,
    rp,
    multiplier: tier.multiplier,
    nextTier: next?.key ?? null,
    nextTierLabel: next?.label ?? null,
    pointsToNext: next ? next.min - rating : 0,
  };
}
