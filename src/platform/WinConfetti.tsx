import { useQuery } from "convex/react";
import { useState } from "react";

import { Confetti } from "@/motion";
import { api } from "../../convex/_generated/api";
import { useMe } from "./useMe";
import { startOfDay, startOfMonth } from "./when";

export function WinConfetti() {
  const { deviceId, now } = useMe();
  const activity = useQuery(
    api.platform.profile.activity,
    deviceId ? { deviceId, dayStart: startOfDay(now), monthStart: startOfMonth(now) } : "skip",
  );
  const run = useQuery(api.unpredictable.game.summary, deviceId ? { deviceId } : "skip");
  const [seen, setSeen] = useState<{ boss: number; run: boolean } | null>(null);
  const [burst, setBurst] = useState(0);

  if (activity && run !== undefined) {
    const defeat = activity.entries.find((entry) => entry.game === "jailbreak");
    const boss = defeat?.note.startsWith("Defeated ") ? defeat.at : 0;
    const survived = !!run && run.finished && !run.over;
    if (!seen) {
      setSeen({ boss, run: survived });
    } else if (boss !== seen.boss || survived !== seen.run) {
      setSeen({ boss, run: survived });
      if (boss > seen.boss || (survived && !seen.run)) setBurst(burst + 1);
    }
  }

  return <Confetti burst={burst} />;
}
