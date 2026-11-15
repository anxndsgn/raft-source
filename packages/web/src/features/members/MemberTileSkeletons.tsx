import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/** raft-design Feedback: a skeleton shows only once the wait passes 1 second, so a fast load never flashes one. */
const SKELETON_DELAY_MS = 1000;

/** Its children, once the wait passes SKELETON_DELAY_MS (ListRowSkeletonList waits the same). */
export function AfterSkeletonDelay({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return shown ? <>{children}</> : null;
}
