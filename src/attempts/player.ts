// @ts-nocheck -- prototype: strict index-access checks relaxed
/**
 * Student screen state + sync engine. Answers are saved one question at a time with the version
 * they are based on; a request is retried with the same request id so a lost reply never
 * creates a duplicate. "Đã lưu" is shown only after the server confirmed.
 */
import { create } from "zustand";
import type { RawAnswer } from "@/analytics/types";
import type { PaperAnswers } from "@/builder/components/StudentPaper";
import { attemptApi, NetworkError } from "./api";
import type { ApiError, ClientAttempt, OpenResult, ResultData } from "./types";
import { isFinal } from "./types";

export type Phase = "loading" | "intro" | "elsewhere" | "active" | "finished" | "error";
export type SyncState = "saved" | "pending" | "saving" | "failed";
interface QSync {
  serverVersion: number;
  localRev: number;
  savedRev: number;
  state: SyncState;
  /** Request id reused when the same edit is retried. */
  req: { rev: number; id: string } | null;
  error?: string;
}

interface PlayerState {
  assignmentId: string | null;
  sessionId: string;
  phase: Phase;
  info: OpenResult["assignment"] | null;
  canStart: boolean;
  reason: string | null;
  attempt: ClientAttempt | null;
  values: PaperAnswers;
  sync: Record<string, QSync>;
  /** serverNow − Date.now(), learnt from replies. */
  clockOffset: number;
  message: string | null;
  busy: boolean;
  submitting: boolean;
  result: ResultData | null;
  notice: string | null;

  init: (assignmentId: string) => Promise<void>;
  start: () => Promise<void>;
  reclaim: () => Promise<void>;
  setAnswer: (id: string, raw: RawAnswer) => void;
  retryFailed: () => void;
  flush: (timeoutMs?: number) => Promise<number>;
  submit: () => Promise<void>;
  checkTime: () => Promise<void>;
  teardown: () => void;
}

const rid = () => `req_${Math.random().toString(36).slice(2, 12)}`;
const sid = () => `ses_${Math.random().toString(36).slice(2, 12)}`;
const TAB_ID = sid();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Set<string>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let submitReq: string | null = null;
let channel: BroadcastChannel | null = null;

/**
 * One session id per tab (kept across reloads). If another open tab already uses the same id
 * (e.g. "Duplicate tab" copies it), take a new one so the server can tell the two screens apart.
 */
async function ensureSession(assignmentId: string): Promise<string> {
  const key = `ab.session.${assignmentId}`;
  let id = sessionStorage.getItem(key) ?? sid();
  if (typeof BroadcastChannel !== "undefined") {
    channel?.close();
    channel = new BroadcastChannel("ab-attempt-tabs");
    let taken = false;
    channel.onmessage = (e) => {
      const m = e.data as { type: string; sid: string; tab: string };
      if (m.tab === TAB_ID) return;
      if (m.type === "who" && m.sid === usePlayer.getState().sessionId) channel?.postMessage({ type: "mine", sid: m.sid, tab: TAB_ID });
      if (m.type === "mine" && m.sid === id) taken = true;
    };
    channel.postMessage({ type: "who", sid: id, tab: TAB_ID });
    await new Promise((r) => setTimeout(r, 200));
    if (taken) id = sid();
  }
  sessionStorage.setItem(key, id);
  return id;
}

export const usePlayer = create<PlayerState>((set, get) => {
  const patchSync = (id: string, p: Partial<QSync>) => set((s) => ({ sync: { ...s.sync, [id]: { ...s.sync[id]!, ...p } } }));
  const learnClock = (serverNow?: string) => serverNow && set({ clockOffset: new Date(serverNow).getTime() - Date.now() });

  function loadAttempt(att: ClientAttempt) {
    const values: PaperAnswers = {};
    const sync: Record<string, QSync> = {};
    for (const [k, v] of Object.entries(att.answers)) {
      values[k] = v.raw;
      sync[k] = { serverVersion: v.version, localRev: 0, savedRev: 0, state: "saved", req: null };
    }
    set({ attempt: att, values, sync });
  }

  async function finish(att: ClientAttempt) {
    stopTimers();
    set({ attempt: att, phase: "finished", submitting: false });
    try {
      const r = await attemptApi.result(att.id);
      if (r.ok) set({ result: r.data });
    } catch {
      set({ message: "Chưa tải được kết quả — kiểm tra mạng rồi tải lại trang." });
    }
  }

  function stopTimers() {
    timers.forEach(clearTimeout);
    timers.clear();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      const { attempt, sessionId, phase } = get();
      if (!attempt || phase !== "active") return;
      try {
        const r = await attemptApi.heartbeat(attempt.id, sessionId);
        if (r.ok) learnClock(r.data.serverNow);
        else await onError(r);
      } catch {
        /* offline: the server will expire the session if this lasts too long */
      }
    }, 10_000);
  }

  async function refresh() {
    const { attempt } = get();
    if (!attempt) return;
    try {
      const r = await attemptApi.getAttempt(attempt.id);
      if (!r.ok) return;
      learnClock(r.data.serverNow);
      if (isFinal(r.data.attempt.status)) await finish(r.data.attempt);
      else set({ attempt: r.data.attempt });
    } catch {
      /* try again later */
    }
  }

  /** Shared reaction to server refusals. Returns true when the caller may retry. */
  async function onError(e: ApiError): Promise<boolean> {
    if (e.code === "SESSION_LOST") {
      // Ask the server to confirm this screen again; works only if nobody else took over.
      const { attempt, sessionId } = get();
      try {
        const c = await attemptApi.claim(attempt!.id, sessionId);
        if (c.ok) return true;
        if (c.code === "SESSION_CONFLICT") set({ phase: "elsewhere" });
        else await refresh();
      } catch {
        /* offline */
      }
      return false;
    }
    if (e.code === "TIME_UP" || e.code === "ALREADY_FINISHED" || e.code === "FINALIZING") await refresh();
    return false;
  }

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      get().retryFailed();
    }, 3000);
  }

  async function send(id: string) {
    const st = get();
    const s = st.sync[id];
    if (!s || !st.attempt || inflight.has(id) || s.savedRev === s.localRev || st.phase !== "active") return;
    inflight.add(id);
    const rev = s.localRev;
    const req = s.req?.rev === rev ? s.req : { rev, id: rid() };
    patchSync(id, { state: "saving", req, error: undefined });
    let res;
    try {
      res = await attemptApi.saveAnswer({ attemptId: st.attempt.id, sessionId: st.sessionId, questionId: id, raw: st.values[id] ?? null, baseVersion: s.serverVersion, requestId: req.id });
    } catch (e) {
      inflight.delete(id);
      patchSync(id, { state: "failed", error: e instanceof NetworkError ? e.message : "Lỗi không xác định" });
      scheduleRetry();
      return;
    }
    inflight.delete(id);
    if (res.ok) {
      const latest = get().sync[id]!;
      patchSync(id, { serverVersion: res.data.version, savedRev: rev, req: null, state: latest.localRev === rev ? "saved" : "pending" });
      if (latest.localRev !== rev) void send(id);
      return;
    }
    if (res.code === "VERSION_CONFLICT" && res.current) {
      // Never overwrite the newer server copy silently: load it and tell the student.
      set((x) => ({ values: { ...x.values, [id]: res.current.raw }, notice: "Một câu trả lời đã được cập nhật từ màn hình khác — đã tải bản mới nhất từ máy chủ." }));
      patchSync(id, { serverVersion: res.current.version, savedRev: get().sync[id]!.localRev, state: "saved", req: null });
      return;
    }
    if (res.code === "INVALID_ANSWER") {
      patchSync(id, { state: "failed", error: res.message });
      return;
    }
    patchSync(id, { state: "failed", error: res.message });
    if (await onError(res)) void send(id);
  }

  return {
    assignmentId: null,
    sessionId: "",
    phase: "loading",
    info: null,
    canStart: false,
    reason: null,
    attempt: null,
    values: {},
    sync: {},
    clockOffset: 0,
    message: null,
    busy: false,
    submitting: false,
    result: null,
    notice: null,

    init: async (assignmentId) => {
      get().teardown();
      submitReq = null;
      set({ assignmentId, phase: "loading", attempt: null, values: {}, sync: {}, result: null, message: null, notice: null });
      const sessionId = await ensureSession(assignmentId);
      set({ sessionId });
      let r;
      try {
        r = await attemptApi.open(assignmentId, sessionId);
      } catch (e) {
        set({ phase: "error", message: (e as Error).message + ". Kiểm tra mạng rồi thử lại." });
        return;
      }
      if (!r.ok) return set({ phase: "error", message: r.message });
      const d = r.data;
      learnClock(d.serverNow);
      set({ info: d.assignment, canStart: d.canStart, reason: d.reason });
      if (!d.attempt) return set({ phase: "intro" });
      loadAttempt(d.attempt);
      if (isFinal(d.attempt.status)) return void finish(d.attempt);
      if (d.attempt.finalizing) {
        set({ phase: "active" });
        return void get().submit();
      }
      if (d.control === "elsewhere") return set({ phase: "elsewhere" });
      set({ phase: "intro" }); // in progress: ask to continue (needs a click to go full screen)
    },

    start: async () => {
      const { assignmentId, sessionId, attempt } = get();
      set({ busy: true, message: null });
      try {
        const r = attempt ? await attemptApi.claim(attempt.id, sessionId) : await attemptApi.start(assignmentId!, sessionId);
        if (!r.ok) {
          if (r.code === "SESSION_CONFLICT") set({ phase: "elsewhere" });
          else if (r.code === "ALREADY_FINISHED" || r.code === "TIME_UP") await refresh().then(() => attempt ?? get().init(assignmentId!));
          else set({ message: r.message });
          return;
        }
        if ("control" in r.data && r.data.control === "elsewhere") return set({ phase: "elsewhere", attempt: r.data.attempt });
        if (!attempt) loadAttempt(r.data.attempt);
        else set({ attempt: r.data.attempt });
        set({ phase: "active" });
        startHeartbeat();
        await refresh();
      } catch (e) {
        set({ message: (e as Error).message + ". Thử lại khi có mạng." });
      } finally {
        set({ busy: false });
      }
    },

    reclaim: async () => {
      const { attempt, sessionId, assignmentId } = get();
      if (!attempt) return get().init(assignmentId!);
      set({ busy: true, message: null });
      try {
        const r = await attemptApi.claim(attempt.id, sessionId);
        if (r.ok) {
          // Re-read what the server holds: the other screen may have saved newer answers.
          loadAttempt(r.data.attempt);
          set({ phase: "intro" });
        } else if (r.code === "SESSION_CONFLICT") set({ message: "Màn hình kia vẫn đang giữ bài làm. Hãy đóng màn hình đó hoặc chờ khoảng 30 giây rồi thử lại." });
        else await get().init(assignmentId!);
      } catch (e) {
        set({ message: (e as Error).message });
      } finally {
        set({ busy: false });
      }
    },

    setAnswer: (id, raw) => {
      const { phase, attempt, sync } = get();
      if (phase !== "active" || !attempt || attempt.finalizing) return;
      const cur = sync[id] ?? { serverVersion: 0, localRev: 0, savedRev: 0, state: "saved" as SyncState, req: null };
      set((s) => ({ values: { ...s.values, [id]: raw }, sync: { ...s.sync, [id]: { ...cur, localRev: cur.localRev + 1, state: "pending" } } }));
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => void send(id), 700));
    },

    retryFailed: () => {
      for (const [id, s] of Object.entries(get().sync)) if (s.state === "failed" || s.state === "pending") void send(id);
    },

    flush: async (timeoutMs = 8000) => {
      timers.forEach(clearTimeout);
      timers.clear();
      get().retryFailed();
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const left = Object.values(get().sync).filter((s) => s.state !== "saved");
        if (!left.length) return 0;
        if (left.every((s) => s.state === "failed") && !inflight.size) {
          await new Promise((r) => setTimeout(r, 400));
          if (Object.values(get().sync).every((s) => s.state === "saved" || s.state === "failed") && !inflight.size) break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      return Object.values(get().sync).filter((s) => s.state !== "saved").length;
    },

    submit: async () => {
      const { attempt, sessionId } = get();
      if (!attempt) return;
      submitReq ??= rid();
      set({ submitting: true, message: null });
      try {
        let r = await attemptApi.submit({ attemptId: attempt.id, sessionId, requestId: submitReq });
        if (!r.ok && r.code === "SESSION_LOST" && (await onError(r))) r = await attemptApi.submit({ attemptId: attempt.id, sessionId, requestId: submitReq });
        if (r.ok) return void finish(r.data.attempt);
        if (r.code === "GRADING_FAILED") {
          set({ attempt: { ...attempt, finalizing: true }, message: r.message });
          setTimeout(() => get().phase === "active" && void get().submit(), 3000);
          return;
        }
        if (r.code === "SESSION_CONFLICT" || r.code === "SESSION_LOST") set({ phase: "elsewhere" });
        set({ message: r.message, submitting: false });
      } catch (e) {
        set({ message: `${(e as Error).message}. Bài chưa được nộp — bấm Nộp bài lại khi có mạng.`, submitting: false });
      }
    },

    checkTime: async () => {
      await get().flush(2000);
      await refresh();
    },

    teardown: () => {
      const { attempt, sessionId, phase } = get();
      if (attempt && phase === "active") attemptApi.releaseNow(attempt.id, sessionId);
      stopTimers();
    },
  };
});

/** Overall save state shown in the top bar. */
export function overallSync(sync: Record<string, QSync>): { state: SyncState | "none"; count: number } {
  const all = Object.values(sync);
  const failed = all.filter((s) => s.state === "failed").length;
  if (failed) return { state: "failed", count: failed };
  if (all.some((s) => s.state === "saving")) return { state: "saving", count: all.filter((s) => s.state === "saving").length };
  const pending = all.filter((s) => s.state === "pending").length;
  if (pending) return { state: "pending", count: pending };
  return { state: all.length ? "saved" : "none", count: 0 };
}
