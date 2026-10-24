// @ts-nocheck -- prototype: strict index-access checks relaxed
/**
 * Server rules for an official student attempt. Pure and synchronous: every operation receives
 * the database and the caller (taken from the login session, never from the request body),
 * checks ownership, state, time and validity, then writes. The browser simulation in `api.ts`
 * runs each operation under a cross-tab lock and only commits when it returns, which mirrors a
 * database transaction. A real backend should port these functions one-to-one.
 */
import { displayAnswer, displayKey, gradeResponse, questionStatus, snapshotAssignment } from "@/analytics/grading";
import type { QuestionSnapshot, RawAnswer, ResponseRecord } from "@/analytics/types";
import { statusOf } from "@/builder/status";
import { buildStudentView } from "@/builder/student-view";
import type { Assignment, ID } from "@/builder/types";
import {
  isFinal,
  type ApiError,
  type ApiResult,
  type ClientAttempt,
  type Control,
  type FinalStatus,
  type MyAssignment,
  type OpenResult,
  type ResultData,
  type ReviewItem,
  type ServerAttempt,
  type ServerDB,
} from "./types";

/** A screen that sends no heartbeat for this long loses control of the attempt. */
export const SESSION_TIMEOUT_MS = 30_000;
export const MAX_TEXT = 500;
export const MAX_BLANK = 200;

export interface RosterStudent {
  id: ID;
  name: string;
  classId: string;
}
export interface Caller {
  studentId: ID;
}
export interface ServerDeps {
  now: () => number;
  getAssignment: (id: ID) => Assignment | null;
  listAssignments: () => Assignment[];
  getStudent: (id: ID) => RosterStudent | null;
  newId?: () => string;
  /** Test hook: the grader crashes. */
  shouldFailGrading?: () => boolean;
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string) => new Date(s).getTime();
const round2 = (n: number) => Math.round(n * 100) / 100;
const fail = (code: ApiError["code"], message: string, extra: Partial<ApiError> = {}): ApiError => ({ ok: false, code, message, ...extra });
const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const isBlank = (v: RawAnswer) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.every((x) => !x || !String(x).trim()));
const fmt = (s: string) => new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function toClient(att: ServerAttempt): ClientAttempt {
  return {
    id: att.id,
    status: att.status,
    startedAt: att.startedAt,
    expiresAt: att.expiresAt,
    finishedAt: att.finishedAt,
    timedOut: att.timedOut,
    late: att.late,
    finalizing: !!att.finalizing,
    view: att.view,
    answers: Object.fromEntries(Object.entries(att.answers).map(([k, v]) => [k, { raw: v.raw, version: v.version }])),
    scoreEarned: att.scoreEarned,
    scoreMax: att.scoreMax,
    percent: att.percent,
    manualPendingCount: att.manualPending.length,
  };
}

/** Checks the submitted value matches the question type and only uses choices of this question. */
export function validateAnswer(q: QuestionSnapshot, raw: unknown): string | null {
  if (raw === null) return null;
  switch (q.type) {
    case "SINGLE_CHOICE":
      return typeof raw === "string" && q.options!.some((o) => o.id === raw) ? null : "Lựa chọn không thuộc câu hỏi này.";
    case "MATCHING":
      return typeof raw === "string" && (q.poolEntries ?? []).some((e) => e.id === raw) ? null : "Chữ cái không có trong kho đáp án.";
    case "MULTIPLE_CHOICE": {
      if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string")) return "Câu trả lời phải là danh sách lựa chọn.";
      if (new Set(raw).size !== raw.length) return "Lựa chọn bị trùng.";
      return raw.every((x) => q.options!.some((o) => o.id === x)) ? null : "Lựa chọn không thuộc câu hỏi này.";
    }
    case "TEXT_INPUT":
      if (typeof raw !== "string") return "Câu trả lời phải là chữ.";
      return raw.length <= MAX_TEXT ? null : `Tối đa ${MAX_TEXT} ký tự.`;
    case "MULTI_TEXT_INPUT": {
      const n = q.blanks?.length ?? 0;
      if (!Array.isArray(raw) || raw.length !== n || raw.some((x) => typeof x !== "string")) return `Câu này có đúng ${n} chỗ trống.`;
      return raw.every((x) => x.length <= MAX_BLANK) ? null : `Mỗi chỗ trống tối đa ${MAX_BLANK} ký tự.`;
    }
  }
  return "Loại câu hỏi không hỗ trợ.";
}

export function createAttemptServer(db: ServerDB, deps: ServerDeps) {
  const now = () => deps.now();
  const newId = deps.newId ?? (() => `att_${Math.random().toString(36).slice(2, 10)}`);
  const key = (assignmentId: ID, studentId: ID) => `${assignmentId}|${studentId}`;

  function access(caller: Caller, assignmentId: ID): { a: Assignment; student: RosterStudent } | ApiError {
    const student = deps.getStudent(caller.studentId);
    const a = deps.getAssignment(assignmentId);
    if (!student || !a || !a.settings.classIds.includes(student.classId)) return fail("FORBIDDEN", "Bạn không được giao bài này.");
    return { a, student };
  }

  /** Why a NEW attempt cannot be created right now (null = allowed). Due date does not block (late is accepted). */
  function startBlock(a: Assignment): ApiError | null {
    if (statusOf(a) !== "published") return fail("NOT_AVAILABLE", "Bài chưa được phát hành hoặc đã được lưu trữ.");
    if (a.settings.startAt && now() < ms(a.settings.startAt)) return fail("NOT_OPEN_YET", `Bài mở lúc ${fmt(a.settings.startAt)}.`);
    return null;
  }

  /** Same answer for "does not exist" and "belongs to someone else": the id alone proves nothing. */
  function own(caller: Caller, attemptId: ID): ServerAttempt | ApiError {
    const att = db.attempts[attemptId];
    if (!att || att.studentId !== caller.studentId) return fail("FORBIDDEN", "Không tìm thấy lượt làm của bạn.");
    return att;
  }

  /** Completes the attempt. Phase 1 (freeze answers) is kept even if grading fails; phase 2 is one write. */
  function finalize(att: ServerAttempt, as: FinalStatus, at: string): ApiError | null {
    if (isFinal(att.status)) return null;
    if (!att.finalizing) att.finalizing = { as, at };
    const f = att.finalizing;
    try {
      if (deps.shouldFailGrading?.()) throw new Error("grader crashed");
      const a = deps.getAssignment(att.assignmentId);
      const due = a?.settings.dueAt ? ms(a.settings.dueAt) : Infinity;
      const responses: ResponseRecord[] = [];
      const manualPending: ID[] = [];
      for (const q of att.questions) {
        if (q.isExample) continue;
        const raw = att.answers[q.questionId]?.raw ?? null;
        if (q.gradingMode === "MANUAL" && !isBlank(raw)) {
          manualPending.push(q.questionId);
          responses.push({ questionId: q.questionId, raw, parts: [] });
          continue;
        }
        responses.push({ questionId: q.questionId, raw, parts: gradeResponse(q, raw) });
      }
      const earned = round2(responses.reduce((s, r) => s + r.parts.reduce((x, p) => x + p.earned, 0), 0));
      db.attempts[att.id] = {
        ...att,
        status: f.as,
        finishedAt: f.at,
        timedOut: f.as === "TIMED_OUT",
        late: ms(f.at) > due,
        responses,
        manualPending,
        scoreEarned: earned,
        percent: att.scoreMax ? Math.round((earned / att.scoreMax) * 1000) / 10 : 0,
        finalizing: null,
        session: null,
      };
      return null;
    } catch {
      return fail("GRADING_FAILED", "Bài nộp đã được ghi nhận và câu trả lời đã khóa. Hệ thống đang chấm lại, vui lòng thử lại sau giây lát.");
    }
  }

  /** Server is the clock: an expired attempt is completed with only the answers it has stored. */
  function settle(att: ServerAttempt): ServerAttempt {
    if (att.status === "IN_PROGRESS") {
      if (att.finalizing) finalize(att, att.finalizing.as, att.finalizing.at);
      else if (att.expiresAt && now() >= ms(att.expiresAt)) finalize(att, "TIMED_OUT", att.expiresAt);
    }
    return db.attempts[att.id]!;
  }

  /** Background job: completes every expired attempt even if no screen is open. */
  function sweep() {
    for (const att of Object.values(db.attempts)) settle(att);
  }

  function claimInternal(att: ServerAttempt, sessionId: string): boolean {
    const s = att.session;
    if (!s || s.id === sessionId || now() - ms(s.lastSeen) > SESSION_TIMEOUT_MS) {
      att.session = { id: sessionId, lastSeen: iso(now()) };
      return true;
    }
    return false;
  }

  /** Writes are accepted only from the screen that holds a fresh session. */
  function checkSession(att: ServerAttempt, sessionId: string): ApiError | null {
    const s = att.session;
    if (!s || s.id !== sessionId || now() - ms(s.lastSeen) > SESSION_TIMEOUT_MS)
      return fail("SESSION_LOST", "Màn hình này không còn quyền làm bài. Cần xác nhận lại trước khi tiếp tục.");
    s.lastSeen = iso(now());
    return null;
  }

  const finishedError = (att: ServerAttempt) =>
    att.status === "TIMED_OUT" ? fail("TIME_UP", "Đã hết giờ. Bài đã được nộp tự động.") : fail("ALREADY_FINISHED", "Bài đã nộp, không thể sửa câu trả lời.");

  function remember<T>(caller: Caller, requestId: string | undefined, result: ApiResult<T>): ApiResult<T> {
    if (requestId && result.ok) db.requests[`${caller.studentId}:${requestId}`] = { at: iso(now()), result };
    return result;
  }
  const recalled = (caller: Caller, requestId: string | undefined) => (requestId ? db.requests[`${caller.studentId}:${requestId}`]?.result : undefined);

  function summary(a: Assignment) {
    const v = buildStudentView(a);
    return { title: a.title, grade: a.grade, timeLimitMin: a.settings.timeLimitMin, dueAt: a.settings.dueAt, startAt: a.settings.startAt, totalQuestions: v.totalQuestions };
  }

  return {
    sweep,

    /** Opening the page: returns the attempt (if any) and tries to take control for this screen. */
    open(caller: Caller, assignmentId: ID, sessionId: string): ApiResult<OpenResult> {
      sweep();
      const acc = access(caller, assignmentId);
      if ("ok" in acc) return acc;
      const id = db.byStudent[key(assignmentId, caller.studentId)];
      const att = id ? settle(db.attempts[id]!) : null;
      const blk = startBlock(acc.a);
      let control: Control | null = null;
      if (att?.status === "IN_PROGRESS" && !att.finalizing) control = claimInternal(att, sessionId) ? "mine" : "elsewhere";
      return ok({
        attempt: att ? toClient(att) : null,
        control,
        canStart: !att && !blk,
        reason: att ? null : (blk?.message ?? null),
        assignment: summary(acc.a),
        serverNow: iso(now()),
      });
    },

    /** Idempotent: pressing Start again (or from another tab) returns the same attempt, never a second one. */
    start(caller: Caller, assignmentId: ID, sessionId: string): ApiResult<{ attempt: ClientAttempt; control: Control }> {
      sweep();
      const acc = access(caller, assignmentId);
      if ("ok" in acc) return acc;
      const k = key(assignmentId, caller.studentId);
      const existingId = db.byStudent[k];
      if (existingId) {
        const att = settle(db.attempts[existingId]!);
        if (isFinal(att.status)) return finishedError(att);
        if (att.finalizing) return fail("FINALIZING", "Bài đang được hoàn tất.");
        return ok({ attempt: toClient(att), control: claimInternal(att, sessionId) ? "mine" : "elsewhere" });
      }
      const blk = startBlock(acc.a);
      if (blk) return blk;
      const questions = snapshotAssignment(acc.a);
      const limit = acc.a.settings.timeLimitMin;
      const t0 = now();
      const att: ServerAttempt = {
        id: newId(),
        studentId: caller.studentId,
        assignmentId,
        classIdAtStart: acc.student.classId,
        status: "IN_PROGRESS",
        startedAt: iso(t0),
        expiresAt: limit ? iso(t0 + limit * 60_000) : null,
        finishedAt: null,
        timedOut: false,
        late: false,
        finalizing: null,
        questions,
        view: buildStudentView(acc.a),
        answers: {},
        responses: null,
        manualPending: [],
        scoreEarned: null,
        scoreMax: round2(questions.filter((q) => !q.isExample).reduce((s, q) => s + q.points, 0)),
        percent: null,
        session: { id: sessionId, lastSeen: iso(t0) },
      };
      db.attempts[att.id] = att;
      db.byStudent[k] = att.id;
      return ok({ attempt: toClient(att), control: "mine" });
    },

    /** Take control for this screen; only allowed when the previous screen released it or timed out. */
    claim(caller: Caller, attemptId: ID, sessionId: string): ApiResult<{ attempt: ClientAttempt }> {
      const o = own(caller, attemptId);
      if ("ok" in o) return o;
      const att = settle(o);
      if (isFinal(att.status)) return finishedError(att);
      if (att.finalizing) return fail("FINALIZING", "Bài đang được hoàn tất.");
      if (!claimInternal(att, sessionId))
        return fail("SESSION_CONFLICT", "Bài làm đang mở ở nơi khác.");
      return ok({ attempt: toClient(att) });
    },

    heartbeat(caller: Caller, attemptId: ID, sessionId: string): ApiResult<{ serverNow: string }> {
      const o = own(caller, attemptId);
      if ("ok" in o) return o;
      const att = settle(o);
      if (isFinal(att.status)) return finishedError(att);
      const e = checkSession(att, sessionId);
      return e ?? ok({ serverNow: iso(now()) });
    },

    /** Tab closed: give the attempt back so another screen can continue immediately. */
    release(caller: Caller, attemptId: ID, sessionId: string): ApiResult<null> {
      const o = own(caller, attemptId);
      if ("ok" in o) return o;
      if (o.session?.id === sessionId) o.session = null;
      return ok(null);
    },

    saveAnswer(
      caller: Caller,
      input: { attemptId: ID; sessionId: string; questionId: ID; raw: RawAnswer; baseVersion: number; requestId: string },
    ): ApiResult<{ questionId: ID; version: number; savedAt: string }> {
      const prev = recalled(caller, input.requestId);
      if (prev) return prev as ApiResult<{ questionId: ID; version: number; savedAt: string }>;
      const o = own(caller, input.attemptId);
      if ("ok" in o) return o;
      const att = settle(o);
      if (isFinal(att.status)) return finishedError(att);
      if (att.finalizing) return fail("FINALIZING", "Bài đang được hoàn tất, không nhận thêm câu trả lời.");
      const se = checkSession(att, input.sessionId);
      if (se) return se;
      const q = att.questions.find((x) => x.questionId === input.questionId);
      if (!q || q.isExample) return fail("INVALID_ANSWER", "Câu hỏi không thuộc bài này.");
      const bad = validateAnswer(q, input.raw);
      if (bad) return fail("INVALID_ANSWER", bad);
      const cur = att.answers[q.questionId];
      const curVersion = cur?.version ?? 0;
      if (input.baseVersion !== curVersion)
        return fail("VERSION_CONFLICT", "Câu trả lời trên máy chủ mới hơn bản này.", { current: { raw: cur?.raw ?? null, version: curVersion } });
      const savedAt = iso(now());
      att.answers[q.questionId] = { raw: input.raw, version: curVersion + 1, savedAt };
      return remember(caller, input.requestId, ok({ questionId: q.questionId, version: curVersion + 1, savedAt }));
    },

    /** Submitting again, or after time ran out, returns the one completed result. */
    submit(caller: Caller, input: { attemptId: ID; sessionId: string; requestId: string }): ApiResult<{ attempt: ClientAttempt }> {
      const prev = recalled(caller, input.requestId);
      if (prev) return prev as ApiResult<{ attempt: ClientAttempt }>;
      const o = own(caller, input.attemptId);
      if ("ok" in o) return o;
      let att = settle(o);
      if (!isFinal(att.status)) {
        if (!att.finalizing) {
          const se = checkSession(att, input.sessionId);
          if (se) return se;
        }
        const e = finalize(att, att.finalizing?.as ?? "SUBMITTED", att.finalizing?.at ?? iso(now()));
        if (e) return e;
        att = db.attempts[att.id]!;
      }
      return remember(caller, input.requestId, ok({ attempt: toClient(att) }));
    },

    getAttempt(caller: Caller, attemptId: ID): ApiResult<{ attempt: ClientAttempt; serverNow: string }> {
      const o = own(caller, attemptId);
      if ("ok" in o) return o;
      return ok({ attempt: toClient(settle(o)), serverNow: iso(now()) });
    },

    /** Score for a finished attempt; correct answers only when the teacher's setting allows. */
    result(caller: Caller, attemptId: ID): ApiResult<ResultData> {
      const o = own(caller, attemptId);
      if ("ok" in o) return o;
      const att = settle(o);
      if (!isFinal(att.status)) return fail("NOT_FINISHED", "Bài chưa nộp.");
      const a = deps.getAssignment(att.assignmentId);
      const mode = a?.settings.showAnswers ?? "off";
      const allowed = mode === "after_submission" || (mode === "after_due" && !!a && now() > ms(a.settings.dueAt));
      const reviewMessage =
        mode === "off" ? "Giáo viên không cho xem đáp án của bài này." : !allowed && a ? `Đáp án sẽ hiện sau hạn nộp (${fmt(a.settings.dueAt)}).` : null;
      let review: ReviewItem[] | null = null;
      if (allowed) {
        review = att.questions
          .filter((q) => !q.isExample)
          .map((q) => {
            const r = att.responses?.find((x) => x.questionId === q.questionId);
            const pending = att.manualPending.includes(q.questionId);
            return {
              questionId: q.questionId,
              number: q.number,
              status: pending ? "PENDING" : questionStatus(r?.parts ?? []),
              yourAnswer: displayAnswer(q, r?.raw ?? null),
              correct: displayKey(q),
            };
          });
      }
      return ok({ attempt: toClient(att), review, reviewMessage });
    },

    /** Student home: assigned, published work (plus anything already started). */
    myAssignments(caller: Caller): ApiResult<MyAssignment[]> {
      sweep();
      const student = deps.getStudent(caller.studentId);
      if (!student) return fail("FORBIDDEN", "Chưa đăng nhập.");
      const out: MyAssignment[] = [];
      for (const a of deps.listAssignments()) {
        if (!a.settings.classIds.includes(student.classId)) continue;
        const id = db.byStudent[key(a.id, student.id)];
        const att = id ? db.attempts[id] : null;
        if (!att && statusOf(a) !== "published") continue;
        const blk = att ? null : startBlock(a);
        out.push({
          id: a.id,
          title: a.title,
          grade: a.grade,
          dueAt: a.settings.dueAt,
          timeLimitMin: a.settings.timeLimitMin,
          totalQuestions: summary(a).totalQuestions,
          state: att ? att.status : "NOT_STARTED",
          late: att?.late ?? false,
          expiresAt: att?.expiresAt ?? null,
          canStart: !att && !blk,
          reason: blk?.message ?? null,
        });
      }
      return ok(out);
    },
  };
}

export type AttemptServer = ReturnType<typeof createAttemptServer>;

/** Teacher-side rule: once any student has started, the question content is frozen. */
export const contentKey = (a: Pick<Assignment, "grade" | "instructions" | "sections" | "items">) =>
  JSON.stringify({ grade: a.grade, instructions: a.instructions, sections: a.sections, items: a.items });

export function contentChangeBlocked(prev: Assignment | null, next: Assignment, startedCount: number): string | null {
  if (!prev || startedCount === 0) return null;
  return contentKey(prev) === contentKey(next)
    ? null
    : `Đã có ${startedCount} học sinh bắt đầu làm bài nên nội dung đề bị khóa. Hãy nhân bản bài để sửa.`;
}
