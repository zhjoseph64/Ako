import { useEffect, useState } from "react";

const MINUTE = 60_000;

export function useMinute() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / MINUTE) * MINUTE);
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / MINUTE) * MINUTE), 10_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
