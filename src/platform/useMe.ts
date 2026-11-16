import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { useJailbreakIdentity } from "@/jailbreak/identity";
import { api } from "../../convex/_generated/api";
import { useMinute } from "./useNow";

export function useMe() {
  const identity = useJailbreakIdentity();
  const deviceId = identity?.playerId ?? null;
  const secret = identity?.secret ?? null;
  const now = useMinute();
  const ensure = useMutation(api.platform.profile.ensure);
  useEffect(() => {
    if (deviceId && secret) void ensure({ deviceId, secret });
  }, [deviceId, secret, ensure]);
  const fresh = useQuery(api.platform.profile.me, deviceId ? { deviceId, now } : "skip");
  const [me, setMe] = useState(fresh);
  if (fresh !== undefined && fresh !== me) setMe(fresh);
  return { deviceId, secret, now, me };
}
