const DAY_MS = 86_400_000;

export function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfMonth(time: number) {
  const date = new Date(time);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dayLabel(time: number, now: number) {
  const days = Math.round((startOfDay(now) - startOfDay(time)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(time).toLocaleString("en-US", { weekday: "short" });
  return new Date(time).toLocaleString("en-US", { month: "short", day: "numeric" });
}

export const GAME_TITLES: Record<string, string> = {
  unpredictable: "Unpredictable",
  jailbreak: "Jailbreak Boss",
  leaderboard: "Weekly leaderboard",
  cashout: "Cash out",
  purchase: "Token pack",
};
