import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";

import { useDeviceId } from "@/unpredictable/device";
import { api } from "../../convex/_generated/api";

export function useMe() {
  const deviceId = useDeviceId();
  const ensure = useMutation(api.platform.profile.ensure);
  useEffect(() => {
    if (deviceId) void ensure({ deviceId });
  }, [deviceId, ensure]);
  const me = useQuery(api.platform.profile.me, deviceId ? { deviceId } : "skip");
  return { deviceId, me };
}
