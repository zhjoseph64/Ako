import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";

const KEY = "unpredictable.deviceId";
const SECRET_KEY = "jailbreakBoss.secret";

let secretPromise: Promise<string> | null = null;

export function loadDeviceSecret() {
  secretPromise ??= AsyncStorage.getItem(SECRET_KEY).then(async (stored) => {
    if (stored) return stored;
    const secret = Array.from(Crypto.getRandomBytes(24), (b) => b.toString(16).padStart(2, "0")).join("");
    await AsyncStorage.setItem(SECRET_KEY, secret);
    return secret;
  });
  return secretPromise;
}

export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(async (stored) => {
      const id =
        stored ??
        `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      if (!stored) await AsyncStorage.setItem(KEY, id);
      setDeviceId(id);
    });
  }, []);
  return deviceId;
}
