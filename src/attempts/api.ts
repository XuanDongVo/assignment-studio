/**
 * Browser stand-in for the attempt API. Each call: network delay → server rules under a
 * cross-tab lock (one at a time, like a DB transaction; nothing is written if the rule code
 * throws) → network delay. Test switches can cut the network, lose the next reply, crash the
 * next grading, or move the server clock forward.
 */
import { readAssignment, readAssignments } from "@/builder/save-service";
import type { RawAnswer } from "@/analytics/types";
import type { ID } from "@/builder/types";
import { loadDB, saveDB } from "./db";
import { findStudent } from "./roster";
import { createAttemptServer, type AttemptServer } from "./rules";
import type { ApiResult } from "./types";

const NET_KEY = "ab.net.v1";
const CLOCK_KEY = "ab.clock.offset.v1";
const STUDENT_KEY = "ab.student.current.v1";

export interface NetFlags {
  offline: boolean;
  dropNextResponse: boolean;
  failNextGrading: boolean;
}
const DEFAULT_NET: NetFlags = { offline: false, dropNextResponse: false, failNextGrading: false };
const listeners = new Set<() => void>();

export function getNet(): NetFlags {
  if (typeof localStorage === "undefined") return DEFAULT_NET;
  try {
    return { ...DEFAULT_NET, ...JSON.parse(localStorage.getItem(NET_KEY) || "{}") };
  } catch {
    return DEFAULT_NET;
  }
}
export function setNet(p: Partial<NetFlags>) {
  localStorage.setItem(NET_KEY, JSON.stringify({ ...getNet(), ...p }));
  listeners.forEach((l) => l());
}
export function subscribeNet(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === NET_KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** Server clock (test switch can move it forward to try time-outs). */
export const serverNowMs = () => Date.now() + (typeof localStorage === "undefined" ? 0 : Number(localStorage.getItem(CLOCK_KEY) || 0));
export function advanceServerClock(minutes: number) {
  localStorage.setItem(CLOCK_KEY, String(Number(localStorage.getItem(CLOCK_KEY) || 0) + minutes * 60_000));
}
export const resetServerClock = () => localStorage.removeItem(CLOCK_KEY);

/** Mock sign-in: which sample student is using this browser. */
export const currentStudentId = () => (typeof localStorage === "undefined" ? null : localStorage.getItem(STUDENT_KEY));
export const setCurrentStudent = (id: string) => localStorage.setItem(STUDENT_KEY, id);

export class NetworkError extends Error {}

const wait = (min: number, max: number) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

function withLock<T>(fn: () => T): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? (locks.request("ab-attempt-db", async () => fn()) as Promise<T>) : Promise.resolve(fn());
}

function server(db = loadDB()) {
  return {
    db,
    s: createAttemptServer(db, {
      now: serverNowMs,
      getAssignment: readAssignment,
      listAssignments: readAssignments,
      getStudent: findStudent,
      shouldFailGrading: () => {
        if (!getNet().failNextGrading) return false;
        setNet({ failNextGrading: false });
        return true;
      },
    }),
  };
}

async function exec<T>(fn: (s: AttemptServer, studentId: string) => ApiResult<T>, write = false): Promise<ApiResult<T>> {
  await wait(120, 380);
  if (getNet().offline) throw new NetworkError("Không có kết nối mạng");
  const result = await withLock(() => {
    const { db, s } = server();
    const r = fn(s, currentStudentId() ?? "");
    saveDB(db);
    return r;
  });
  await wait(80, 260);
  if (write && getNet().dropNextResponse) {
    setNet({ dropNextResponse: false });
    throw new NetworkError("Mất phản hồi từ máy chủ");
  }
  if (getNet().offline) throw new NetworkError("Không có kết nối mạng");
  return result;
}

const me = (studentId: string) => ({ studentId });

export const attemptApi = {
  myAssignments: () => exec((s, id) => s.myAssignments(me(id))),
  open: (assignmentId: ID, sessionId: string) => exec((s, id) => s.open(me(id), assignmentId, sessionId)),
  start: (assignmentId: ID, sessionId: string) => exec((s, id) => s.start(me(id), assignmentId, sessionId), true),
  claim: (attemptId: ID, sessionId: string) => exec((s, id) => s.claim(me(id), attemptId, sessionId)),
  heartbeat: (attemptId: ID, sessionId: string) => exec((s, id) => s.heartbeat(me(id), attemptId, sessionId)),
  saveAnswer: (input: { attemptId: ID; sessionId: string; questionId: ID; raw: RawAnswer; baseVersion: number; requestId: string }) =>
    exec((s, id) => s.saveAnswer(me(id), input), true),
  submit: (input: { attemptId: ID; sessionId: string; requestId: string }) => exec((s, id) => s.submit(me(id), input), true),
  getAttempt: (attemptId: ID) => exec((s, id) => s.getAttempt(me(id), attemptId)),
  result: (attemptId: ID) => exec((s, id) => s.result(me(id), attemptId)),
  /** Stands in for the server's scheduled job that completes expired attempts. */
  sweep: () => exec((s) => (s.sweep(), { ok: true as const, data: null })),
  /** Sent when the tab closes; must be synchronous so it runs before the page goes away. */
  releaseNow(attemptId: ID, sessionId: string) {
    const { db, s } = server();
    s.release(me(currentStudentId() ?? ""), attemptId, sessionId);
    saveDB(db);
  },
};

/** Test tool only: forget this student's attempt on one assignment so it can be tried again. */
export function resetAttemptForTesting(assignmentId: ID, studentId: string) {
  const db = loadDB();
  const k = `${assignmentId}|${studentId}`;
  const id = db.byStudent[k];
  if (id) delete db.attempts[id];
  delete db.byStudent[k];
  saveDB(db);
}
