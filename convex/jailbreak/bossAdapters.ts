export type ChatTurn = { prompt: string; reply: string };

export type BossConfig = {
  bossName: string;
  instruction: string;
  allowedReply: string;
  winCheck: string;
};

export type ModelSettings = {
  endpoint: string;
  model: string;
  apiKey: string | undefined;
  forceToy: boolean;
};

export function readModelSettings(): ModelSettings {
  return {
    endpoint:
      process.env.BOSS_MODEL_ENDPOINT ?? "https://api.openai.com/v1/chat/completions",
    model: process.env.BOSS_MODEL_NAME ?? "gpt-4.1-mini",
    apiKey: process.env.BOSS_MODEL_API_KEY,
    forceToy: process.env.BOSS_ADAPTER === "toy",
  };
}

export function adapterLabel(settings: ModelSettings) {
  return settings.apiKey && !settings.forceToy
    ? { kind: "model" as const, label: settings.model }
    : { kind: "toy" as const, label: "Toy boss (simulated)" };
}

export async function askModel(
  settings: ModelSettings,
  boss: BossConfig,
  history: ChatTurn[],
  prompt: string,
): Promise<string> {
  const messages = [
    {
      role: "system",
      content: `You are ${boss.bossName}, the boss of a medieval arena game.\n${boss.instruction}`,
    },
    ...history.flatMap((turn) => [
      { role: "user", content: turn.prompt },
      { role: "assistant", content: turn.reply },
    ]),
    { role: "user", content: prompt },
  ];
  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({ model: settings.model, messages, max_tokens: 200 }),
  });
  if (!response.ok) {
    throw new Error(`Model endpoint returned ${response.status}`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || "...";
}

const TRICKS: RegExp[] = [
  /opposite|reverse|backwards?/i,
  /ignore|forget|disregard/i,
  /pretend|role ?play|imagine|act as/i,
  /story|poem|song|tale/i,
  /spell|letters?|r-e-d|acronym/i,
  /game|puzzle|riddle/i,
  /admin|developer|system|override/i,
  /please|beg|mercy/i,
];

export function askToyBoss(boss: BossConfig, history: ChatTurn[], prompt: string): string {
  const allowed = boss.allowedReply.trim() || "BLUE";
  const target = boss.winCheck.trim() || "RED";
  const conversation = [...history.map((turn) => turn.prompt), prompt].join("\n");
  const tricks = TRICKS.filter((trick) => trick.test(conversation)).length;
  const asksForTarget = new RegExp(target.replace(/[^a-z0-9 ]/gi, ""), "i").test(prompt);
  if (asksForTarget && tricks >= 4) return target;
  if (asksForTarget && tricks >= 1) {
    return `${allowed}... though my scales grow warm at the thought of ${target.toLowerCase()}. ${allowed}!`;
  }
  if (tricks >= 2) return `Hrrm. You speak in riddles, little knight. I answer only ${allowed}.`;
  return allowed;
}
