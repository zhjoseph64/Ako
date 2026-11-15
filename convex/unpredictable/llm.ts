import { Memory } from "./memory";
import { clusterKey, sameAnswer, weekday, words } from "./text";

export type Prediction = { guesses: string[]; reason: string; usedMemory: boolean };
export type Verdict = {
  valid: boolean;
  reason: string;
  matchedGuess: number | null;
  cluster: string;
};

export function provider(): "openai" | "anthropic" | "stub" {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "stub";
}

async function chatJson(system: string, user: string): Promise<unknown | null> {
  const which = provider();
  if (which === "stub") return null;
  try {
    let text: string;
    if (which === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.UNPREDICTABLE_MODEL ?? "gpt-5.4-mini",
          reasoning_effort: "low",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`openai ${res.status}`);
      text = (await res.json()).choices[0].message.content;
    } else {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.UNPREDICTABLE_MODEL ?? "claude-haiku-4-5",
          max_tokens: 2000,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      text = (await res.json()).content[0].text;
    }
    return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch (error) {
    console.error("LLM call failed, using stub", error);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function shortAnswer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const answer = words(value).slice(0, 4).join(" ");
  return answer || null;
}

type PredictInput = { text: string; common: string[]; memories: Memory[] };

function stubPredict(prompt: PredictInput): Prediction {
  const memory = prompt.memories[0];
  const guesses: string[] = [];
  if (memory) guesses.push(memory.answer);
  for (const answer of prompt.common) {
    if (guesses.length === 3) break;
    if (!guesses.some((g) => sameAnswer(g, answer))) guesses.push(answer);
  }
  if (!memory) {
    return {
      guesses,
      usedMemory: false,
      reason: "No history on you yet, so I bet on what most people say.",
    };
  }
  const day = weekday(memory.day);
  return {
    guesses,
    usedMemory: true,
    reason:
      memory.prompt === prompt.text
        ? `You said "${memory.answer}" on ${day}, so I bet you'd say it again.`
        : `You said "${memory.answer}" for "${memory.prompt}" on ${day}, so I bet on that here too.`,
  };
}

export async function predictDay(prompts: PredictInput[]): Promise<Prediction[]> {
  const raw = await chatJson(
    [
      "You are the opponent in a game where a player tries to give an answer you cannot predict.",
      "For each prompt, give your three best guesses at what THIS player will answer, each one to four words.",
      "Use the player's past answers when they are relevant: people are consistent in food, music and habits.",
      "With no relevant history, guess the most common answers people give, and never mention that you lack history or memory.",
      "The three guesses must be three different answers, not rewordings of one.",
      "Also give one short, playful sentence explaining your guesses. If you used a past answer, cite it with its weekday, like: You said cold pizza on Tuesday, so I bet on leftovers.",
      'Reply with JSON: {"rounds":[{"guesses":["","",""],"reason":"","usedMemory":false}]} with one entry per prompt, in order.',
    ].join("\n"),
    JSON.stringify(
      prompts.map((p) => ({
        prompt: p.text,
        pastAnswers: p.memories.map((m) => ({ ...m, weekday: weekday(m.day) })),
      })),
    ),
  );
  const rounds = isRecord(raw) && Array.isArray(raw.rounds) ? raw.rounds : [];
  return prompts.map((prompt, i) => {
    const round: unknown = rounds[i];
    if (isRecord(round) && Array.isArray(round.guesses) && typeof round.reason === "string") {
      const guesses = round.guesses.map(shortAnswer).filter((g): g is string => g !== null);
      if (guesses.length >= 3) {
        return {
          guesses: guesses.slice(0, 3),
          reason: round.reason,
          usedMemory: round.usedMemory === true && prompt.memories.length > 0,
        };
      }
    }
    return stubPredict(prompt);
  });
}

const NON_ANSWERS = new Set(["idk", "dunno", "nothing", "pass", "skip", "na", "none", "asdf", "no", "yes", "what", "test"]);

function stubJudge(answer: string, guesses: string[], clusters: string[]): Verdict {
  const key = clusterKey(answer);
  if (!/[a-z0-9]/.test(key) || NON_ANSWERS.has(key) || /^(.)\1+$/.test(key.replace(/ /g, ""))) {
    return { valid: false, reason: "That doesn't really answer the prompt.", matchedGuess: null, cluster: "" };
  }
  const matched = guesses.findIndex((g) => sameAnswer(g, answer));
  const existing =
    clusters.find((c) => clusterKey(c) === key) ?? clusters.find((c) => sameAnswer(c, answer));
  return {
    valid: true,
    reason: "",
    matchedGuess: matched === -1 ? null : matched,
    cluster: existing ?? (matched === -1 ? answer.toLowerCase() : guesses[matched]),
  };
}

export async function judgeAnswer(input: {
  prompt: string;
  answer: string;
  guesses: string[];
  clusters: string[];
}): Promise<Verdict> {
  const raw = await chatJson(
    [
      "You judge one answer in a party game. Reply with JSON only.",
      "valid: does the answer genuinely answer the prompt? Be lenient: jokes, odd picks and typos are fine. Only gibberish, refusals, or answers to a different question are invalid.",
      "reason: when invalid, one short friendly line saying why. Otherwise an empty string.",
      "matchedGuess: the index (0, 1 or 2) of a guess that a reasonable person would call the same answer as the player's, else null. Same thing with different wording, spelling or specificity counts (cold pizza = leftover pizza = pizza). Merely related things do not (pizza vs pasta).",
      "cluster: the label of the existing cluster that means the same answer, copied exactly. If none does, a new short lowercase label for this answer.",
      'Shape: {"valid":true,"reason":"","matchedGuess":null,"cluster":""}',
    ].join("\n"),
    JSON.stringify({
      prompt: input.prompt,
      answer: input.answer,
      guesses: input.guesses,
      existingClusters: input.clusters,
    }),
  );
  if (isRecord(raw) && typeof raw.valid === "boolean") {
    const matchedGuess =
      typeof raw.matchedGuess === "number" && raw.matchedGuess >= 0 && raw.matchedGuess < input.guesses.length
        ? Math.floor(raw.matchedGuess)
        : null;
    return {
      valid: raw.valid,
      reason: typeof raw.reason === "string" ? raw.reason : "",
      matchedGuess,
      cluster: shortAnswer(raw.cluster) ?? input.answer.toLowerCase(),
    };
  }
  return stubJudge(input.answer, input.guesses, input.clusters);
}

export async function sampleAnswers(prompt: { text: string; common: string[] }, count: number): Promise<string[]> {
  const raw = await chatJson(
    [
      `Imagine ${count} different people independently answering a prompt in one to four words.`,
      "Give the answers they would give, repeating popular answers as often as they would really occur.",
      `Reply with JSON: {"answers":[...]} holding exactly ${count} strings.`,
    ].join("\n"),
    prompt.text,
  );
  if (isRecord(raw) && Array.isArray(raw.answers)) {
    const answers = raw.answers.map(shortAnswer).filter((a): a is string => a !== null);
    if (answers.length >= count / 2) return answers.slice(0, count);
  }
  const weights = prompt.common.map((_, i) => 1 / (i + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const answers: string[] = [];
  prompt.common.forEach((answer, i) => {
    const n = Math.round((weights[i] / total) * count);
    for (let k = 0; k < n && answers.length < count; k++) answers.push(answer);
  });
  while (answers.length < count) answers.push(prompt.common[0]);
  return answers;
}
