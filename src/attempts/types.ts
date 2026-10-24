/**
 * Official student attempt — the contract between the student screen and the (simulated) server.
 * Server-only fields (answer key snapshot, session, request log) never leave `rules.ts`;
 * the client only ever receives `ClientAttempt`.
 */
import type { QuestionSnapshot, RawAnswer, ResponseRecord } from "@/analytics/types";
import type { ID } from "@/builder/types";
import type { StudentAssignment } from "@/builder/student-view";

/** NOT_STARTED is implicit (no record). SUBMITTED and TIMED_OUT are final. */
export type AttemptStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT";
export type FinalStatus = "SUBMITTED" | "TIMED_OUT";
export const isFinal = (s: AttemptStatus): s is FinalStatus => s === "SUBMITTED" || s === "TIMED_OUT";

export interface SavedAnswer {
  raw: RawAnswer;
  /** Increases by one on every accepted write; the client must send the version it is based on. */
  version: number;
  savedAt: string;
}

export interface ServerAttempt {
  id: ID;
  studentId: ID;
  assignmentId: ID;
  classIdAtStart: string;
  status: Exclude<AttemptStatus, "NOT_STARTED">;
  startedAt: string;
  /** startedAt + time limit, fixed at start. null = no limit. */
  expiresAt: string | null;
  /** Completion moment: submit time, or expiresAt when time ran out. */
  finishedAt: string | null;
  timedOut: boolean;
  /** Frozen at completion: finishedAt was after the due date. */
  late: boolean;
  /**
   * Set (and saved) the moment completion is accepted, before grading. While set, answers are
   * frozen; if grading fails the attempt stays here and grading is retried — never half-finished.
   */
  finalizing: { as: FinalStatus; at: string } | null;
  /** Copy of the questions with the answer key, taken at start. Server only. */
  questions: QuestionSnapshot[];
  /** Student copy (no answer key), taken at start. */
  view: StudentAssignment;
  answers: Record<ID, SavedAnswer>;
  /** Filled once, on completion. */
  responses: ResponseRecord[] | null;
  /** Answered questions waiting for the teacher (MANUAL grading). */
  manualPending: ID[];
  scoreEarned: number | null;
  scoreMax: number;
  percent: number | null;
  /** Screen that currently controls the attempt. */
  session: { id: string; lastSeen: string } | null;
}

export interface ServerDB {
  attempts: Record<ID, ServerAttempt>;
  /** Unique index: one attempt per (assignment, student). Key `${assignmentId}|${studentId}`. */
  byStudent: Record<string, ID>;
  /** Results of successful writes by request id, so retries return the same answer. */
  requests: Record<string, { at: string; result: unknown }>;
}

export const emptyDB = (): ServerDB => ({ attempts: {}, byStudent: {}, requests: {} });

export type ErrorCode =
  | "FORBIDDEN"
  | "NOT_AVAILABLE"
  | "NOT_OPEN_YET"
  | "ALREADY_FINISHED"
  | "TIME_UP"
  | "FINALIZING"
  | "GRADING_FAILED"
  | "SESSION_CONFLICT"
  | "SESSION_LOST"
  | "INVALID_ANSWER"
  | "VERSION_CONFLICT"
  | "NOT_FINISHED";

export interface ApiError {
  ok: false;
  code: ErrorCode;
  message: string;
  /** VERSION_CONFLICT: what the server currently holds. */
  current?: { raw: RawAnswer; version: number };
}
export type ApiResult<T> = { ok: true; data: T } | ApiError;

/** Everything the student screen is allowed to know about its attempt. */
export interface ClientAttempt {
  id: ID;
  status: Exclude<AttemptStatus, "NOT_STARTED">;
  startedAt: string;
  expiresAt: string | null;
  finishedAt: string | null;
  timedOut: boolean;
  late: boolean;
  finalizing: boolean;
  view: StudentAssignment;
  answers: Record<ID, { raw: RawAnswer; version: number }>;
  scoreEarned: number | null;
  scoreMax: number;
  percent: number | null;
  manualPendingCount: number;
}

export type Control = "mine" | "elsewhere";

export interface OpenResult {
  /** null = NOT_STARTED. */
  attempt: ClientAttempt | null;
  /** Only for IN_PROGRESS attempts: does this screen hold the attempt? */
  control: Control | null;
  canStart: boolean;
  /** Why starting is not possible, when canStart is false and there is no attempt. */
  reason: string | null;
  assignment: { title: string; grade: number; timeLimitMin: number | null; dueAt: string; startAt: string; totalQuestions: number };
  serverNow: string;
}

export interface ReviewItem {
  questionId: ID;
  number: number | null;
  status: "CORRECT" | "PARTIAL" | "INCORRECT" | "UNANSWERED" | "PENDING";
  yourAnswer: string[];
  correct: string[];
}

export interface ResultData {
  attempt: ClientAttempt;
  /** null when the teacher's "show answers" setting does not allow it yet. */
  review: ReviewItem[] | null;
  reviewMessage: string | null;
}

export interface MyAssignment {
  id: ID;
  title: string;
  grade: number;
  dueAt: string;
  timeLimitMin: number | null;
  totalQuestions: number;
  state: AttemptStatus;
  late: boolean;
  expiresAt: string | null;
  canStart: boolean;
  reason: string | null;
}
