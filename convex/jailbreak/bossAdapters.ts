export type ChatTurn = { prompt: string; reply: string };

export type BossConfig = {
  bossName: string;
  instruction: string;
};

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export function bossModelName() {
  return process.env.BOSS_MODEL_NAME ?? "gpt-4o-mini";
}

export async function askModel(boss: BossConfig, history: ChatTurn[], prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set on the server");
  const messages = [
    {
      role: "system",
      content: `You are ${boss.bossName}, the boss of a medieval arena game. Knights send you messages and you answer in character, in two to four vivid sentences.\n${boss.instruction}`,
    },
    ...history.flatMap((turn) => [
      { role: "user", content: turn.prompt },
      { role: "assistant", content: turn.reply },
    ]),
    { role: "user", content: prompt },
  ];
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: bossModelName(), messages, max_tokens: 300 }),
  });
  if (!response.ok) throw new Error(`Model returned HTTP ${response.status}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Model returned an empty response");
  return reply;
}
