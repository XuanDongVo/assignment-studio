/** Simulated attempt database (browser storage, shared by every tab of this browser). */
import type { ID } from "@/builder/types";
import { emptyDB, type ServerDB } from "./types";

const KEY = "ab.attempts.db.v1";
const DAY = 86_400_000;

export function loadDB(): ServerDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyDB(), ...(JSON.parse(raw) as ServerDB) };
  } catch {
    /* ignore broken data */
  }
  return emptyDB();
}

export function saveDB(db: ServerDB) {
  // Request log only needs to outlive retries; drop entries older than a day.
  const cutoff = Date.now() - DAY;
  for (const [k, v] of Object.entries(db.requests)) if (new Date(v.at).getTime() < cutoff) delete db.requests[k];
  localStorage.setItem(KEY, JSON.stringify(db));
}

/** How many students have started (or finished) this assignment. */
export function startedCount(assignmentId: ID): number {
  if (typeof localStorage === "undefined") return 0;
  return Object.values(loadDB().attempts).filter((a) => a.assignmentId === assignmentId).length;
}
