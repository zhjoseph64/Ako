import { Platform } from "react-native";

const ID_KEY = "jailbreakBoss.playerId";
const NAME_KEY = "jailbreakBoss.name";

let memoryId: string | undefined;
let memoryName = "";

function randomId() {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function webStorage(kind: "sessionStorage" | "localStorage"): Storage | undefined {
  if (Platform.OS !== "web") return undefined;
  return (globalThis as { [key: string]: unknown })[kind] as Storage | undefined;
}

export function getPlayerId() {
  const session = webStorage("sessionStorage");
  if (!session) return (memoryId ??= randomId());
  let id = session.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    session.setItem(ID_KEY, id);
  }
  return id;
}

export function getSavedName() {
  return webStorage("localStorage")?.getItem(NAME_KEY) ?? memoryName;
}

export function saveName(name: string) {
  memoryName = name;
  webStorage("localStorage")?.setItem(NAME_KEY, name);
}

export function newAttackId() {
  return randomId();
}
