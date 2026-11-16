const STOPWORDS = new Set(["a", "an", "the", "my", "some", "of"]);

export function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function clusterKey(text: string): string {
  const tokens = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) =>
      t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t,
    );
  return tokens.join(" ");
}

export function sameAnswer(a: string, b: string): boolean {
  const ka = clusterKey(a);
  const kb = clusterKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const ta = ka.split(" ");
  const tb = kb.split(" ");
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return small.every((t) => big.includes(t));
}

const DAY_ROLLOVER_OFFSET_MS = 8 * 3_600_000;

export function dayInfo(now: number, setCount: number) {
  const dayNumber = Math.floor((now - DAY_ROLLOVER_OFFSET_MS) / 86_400_000);
  return {
    day: new Date(dayNumber * 86_400_000).toISOString().slice(0, 10),
    set: dayNumber % setCount,
  };
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function weekday(day: string): string {
  return WEEKDAYS[new Date(day + "T00:00:00Z").getUTCDay()];
}
