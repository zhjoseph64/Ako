import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { loadDeviceSecret, useDeviceId } from "@/unpredictable/device";

const NAME_KEY = "jailbreakBoss.name";

export type JailbreakIdentity = { playerId: string; secret: string; name: string };

function randomToken(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
}

export function useJailbreakIdentity(): JailbreakIdentity | null {
  const playerId = useDeviceId();
  const [stored, setStored] = useState<{ secret: string; name: string } | null>(null);

  useEffect(() => {
    Promise.all([loadDeviceSecret(), AsyncStorage.getItem(NAME_KEY)]).then(([secret, name]) =>
      setStored({ secret, name: name ?? "" }),
    );
  }, []);

  return playerId && stored ? { playerId, ...stored } : null;
}

export async function saveName(name: string) {
  await AsyncStorage.setItem(NAME_KEY, name);
}

export function newAttackId() {
  return randomToken(8);
}
