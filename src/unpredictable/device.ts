import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "unpredictable.deviceId";

export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(async (stored) => {
      const id =
        stored ?? `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      if (!stored) await AsyncStorage.setItem(KEY, id);
      setDeviceId(id);
    });
  }, []);
  return deviceId;
}
