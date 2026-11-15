import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { useDeviceId } from "@/unpredictable/device";

const NAME_KEY = "jailbreakBoss.name";
const SECRET_KEY = "jailbreakBoss.secret";

export type JailbreakIdentity = { playerId: string; secret: string; name: string };

function randomToken(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
}

export function useJailbreakIdentity(): JailbreakIdentity | null {
  const playerId = useDeviceId();
  const [stored, setStored] = useState<{ secret: string; name: string } | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet([SECRET_KEY, NAME_KEY]).then(async ([[, secret], [, name]]) => {
      const ensured = secret ?? randomToken(24);
      if (!secret) await AsyncStorage.setItem(SECRET_KEY, ensured);
      setStored({ secret: ensured, name: name ?? "" });
    });
  }, []);

  return playerId && stored ? { playerId, ...stored } : null;
}

export async function saveName(name: string) {
  await AsyncStorage.setItem(NAME_KEY, name);
}

export function newAttackId() {
  return randomToken(8);
}
