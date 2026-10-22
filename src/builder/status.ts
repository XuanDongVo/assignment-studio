import type { Assignment, AssignmentStatus } from "./types";

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const STATUS_HINT: Record<AssignmentStatus, string> = {
  draft: "Only you can see it. Keep editing freely.",
  published: "Assigned classes can see and do it.",
  archived: "Hidden from students. Kept for your records.",
};

/** Older saved assignments have no status: treat them as drafts. */
export const statusOf = (a: Pick<Assignment, "status">): AssignmentStatus => a.status ?? "draft";

/** Publishing needs zero validation errors; draft and archived are always allowed. */
export function canMoveTo(to: AssignmentStatus, errorCount: number): { ok: true } | { ok: false; reason: string } {
  if (to === "published" && errorCount > 0) return { ok: false, reason: `Fix ${errorCount} error(s) before publishing.` };
  return { ok: true };
}

/** Returns a copy with the new status; publishedAt is set the first time it goes live and kept afterwards. */
export function withStatus(a: Assignment, to: AssignmentStatus, now = new Date().toISOString()): Assignment {
  return { ...a, status: to, publishedAt: to === "published" ? (a.publishedAt ?? now) : (a.publishedAt ?? null) };
}
