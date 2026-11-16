// Weekly leaderboard prize split shown on the Ranks tab. Display only: nothing in
// the backend pays these out yet, so keep this in step with whatever does.
export const PRIZE_ZONE = 50;

export const WEEKLY_PRIZES = [
  { place: "1st", cents: 10_000 },
  { place: "2nd", cents: 6_000 },
  { place: "3rd", cents: 4_000 },
  { place: `4–${PRIZE_ZONE}`, cents: 638 },
];

export const WEEKLY_POOL_CENTS =
  WEEKLY_PRIZES[0].cents + WEEKLY_PRIZES[1].cents + WEEKLY_PRIZES[2].cents + WEEKLY_PRIZES[3].cents * (PRIZE_ZONE - 3);

const WEEK_MS = 7 * 86_400_000;

// Matches convex/platform/award.ts weekStart: weeks start Monday 00:00 UTC.
export function weekEndsIn(now: number) {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const left = Math.max(0, date.getTime() + WEEK_MS - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
