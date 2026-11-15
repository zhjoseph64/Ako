import { weekday } from "./text";

export type Memory = { prompt: string; answer: string; day: string };

const BASE = "https://api.supermemory.ai";

function headers() {
  const key = process.env.SUPERMEMORY_API_KEY;
  if (!key) return null;
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function recall(playerId: string, query: string): Promise<Memory[]> {
  const h = headers();
  if (!h) return [];
  try {
    const res = await fetch(`${BASE}/ns/unp_${playerId}/search`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ query, searchMode: "chunks", limit: 3, threshold: 0.5 }),
    });
    if (!res.ok) {
      console.error("supermemory search failed", res.status);
      return [];
    }
    const body: { results?: { metadata?: Record<string, unknown> }[] } = await res.json();
    const memories: Memory[] = [];
    for (const result of body.results ?? []) {
      const { prompt, answer, day } = result.metadata ?? {};
      if (typeof prompt === "string" && typeof answer === "string" && typeof day === "string") {
        memories.push({ prompt, answer, day });
      }
    }
    return memories;
  } catch (error) {
    console.error("supermemory search failed", error);
    return [];
  }
}

export async function remember(playerId: string, roundId: string, memory: Memory): Promise<void> {
  const h = headers();
  if (!h) return;
  try {
    const res = await fetch(`${BASE}/ns/unp_${playerId}/document`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        id: roundId,
        content: `Asked "${memory.prompt}", the player answered "${memory.answer}" on ${memory.day} (${weekday(memory.day)}).`,
        metadata: memory,
      }),
    });
    if (!res.ok) console.error("supermemory add failed", res.status);
  } catch (error) {
    console.error("supermemory add failed", error);
  }
}
