import { useMutation } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "../../convex/_generated/api";
import { loadDeviceSecret, useDeviceId } from "@/unpredictable/device";

export type WalletCredentials = { deviceId: string; secret: string };

export function useWalletCredentials(): WalletCredentials | null {
  const deviceId = useDeviceId();
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    loadDeviceSecret().then(setSecret);
  }, []);

  return deviceId && secret ? { deviceId, secret } : null;
}

export function WalletClaimer() {
  const credentials = useWalletCredentials();
  const claim = useMutation(api.cashout.wallet.claimWallet);
  useEffect(() => {
    if (credentials) claim(credentials).catch(() => {});
  }, [credentials, claim]);
  return null;
}
