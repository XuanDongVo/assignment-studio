// @ts-nocheck -- prototype: strict index-access checks relaxed
/**
 * Single source of truth for every number on the results screens (definitions agreed with the teacher):
 * - Submission rate = submitted / students assigned. Not-started students are counted in their current
 *   class; started work is counted in class_id_at_start.
 * - Score % = earned / max × 100. Averages use submitted work only, timed-out work included.
 * - Correct rate of a question/part = CORRECT / submitted (blank answers stay in the denominator).
 * - Blank rate = UNANSWERED / submitted, shown separately.
 * - Common wrong answers are counted on normalised values (case / extra spaces merged).
 * - Discrimination = correct rate of the top 27% minus the bottom 27%, only with 30+ submissions.
 * - Example items and in-progress attempts are excluded from every metric.
 * - Always show n; fade figures when n < 5.
 */
import { questionStatus } from "./grading";
import type { Attempt, PartStatus, QuestionSnapshot, ResultsDataset, Student } from "./types";

export const RULES = {
  hardBelow: 0.4,
  easyAbove: 0.9,
  smallSampleBelow: 5,
  discriminationMinN: 30,
  discriminationGroup: 0.27,
} as const;

export type ProgressState = "not_started" | "in_progress" | "submitted" | "late" | "timed_out" | "overdue";

export const PROGRESS_LABEL: Record<ProgressState, string> = {
  not_started: "Chưa làm",
  in_progress: "Đang làm",
  submitted: "Đã nộp",
  late: "Nộp trễ",
  timed_out: "Hết giờ",
  overdue: "Quá hạn",
};
export const PROGRESS_ORDER: ProgressState[] = ["submitted", "late", "timed_out", "in_progress", "not_started", "overdue"];

const t = (iso: string) => new Date(iso).getTime();
export const isSubmitted = (a: Attempt) => !!a.submittedAt;
export const isSmall = (n: number) => n < RULES.smallSampleBelow;

export function progressOf(att: Attempt | undefined, dueAt: string, asOf: string): ProgressState {
  if (!att) return t(asOf) > t(dueAt) ? "overdue" : "not_started";
  if (!att.submittedAt) return "in_progress";
  if (att.timedOut) return "timed_out";
  if (att.late) return "late";
  return "submitted";
}

export interface RosterRow {
  student: Student;
  attempt: Attempt | undefined;
  /** class_id_at_start when the student started, otherwise the current class. */
  statsClassId: string;
  state: ProgressState;
}

/** Everyone who counts as assigned: current members of assigned classes + anyone who started in one. */
export function rosterOf(ds: ResultsDataset): RosterRow[] {
  const byStudent = new Map(ds.attempts.map((a) => [a.studentId, a]));
  return ds.students
    .filter((s) => {
      const att = byStudent.get(s.id);
      return att ? ds.assignedClassIds.includes(att.classIdAtStart) : ds.assignedClassIds.includes(s.classId);
    })
    .map((s) => {
      const att = byStudent.get(s.id);
      return { student: s, attempt: att, statsClassId: att ? att.classIdAtStart : s.classId, state: progressOf(att, ds.dueAt, ds.asOf) };
    });
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const durationMin = (a: Attempt) => (a.submittedAt ? (t(a.submittedAt) - t(a.startedAt)) / 60000 : null);

/** Tier A — whole class. */
export function overview(ds: ResultsDataset) {
  const roster = rosterOf(ds);
  const counts = Object.fromEntries(PROGRESS_ORDER.map((k) => [k, 0])) as Record<ProgressState, number>;
  roster.forEach((r) => counts[r.state]++);
  const done = roster.map((r) => r.attempt).filter((a): a is Attempt => !!a && isSubmitted(a));
  const pcts = done.map((a) => a.percent ?? 0);
  const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, count: 0 }));
  pcts.forEach((p) => bins[Math.min(9, Math.floor(p / 10))].count++);
  return {
    assigned: roster.length,
    submitted: done.length,
    submissionRate: roster.length ? done.length / roster.length : null,
    counts,
    mean: mean(pcts),
    median: median(pcts),
    min: pcts.length ? Math.min(...pcts) : null,
    max: pcts.length ? Math.max(...pcts) : null,
    bins,
    avgMinutes: mean(done.map((a) => durationMin(a)!)),
    timeLimitMin: ds.timeLimitMin,
  };
}

export const submittedAttempts = (ds: ResultsDataset) => rosterOf(ds).map((r) => r.attempt).filter((a): a is Attempt => !!a && isSubmitted(a));

/** Question list from the latest submitted snapshot (all attempts of one publish share it). */
export function scoredQuestions(done: Attempt[]): QuestionSnapshot[] {
  const latest = [...done].sort((a, b) => t(b.startedAt) - t(a.startedAt))[0];
  return (latest?.questions ?? []).filter((q) => !q.isExample);
}

const respOf = (a: Attempt, qid: string) => a.responses.find((r) => r.questionId === qid);
export const statusIn = (a: Attempt, qid: string): PartStatus => questionStatus(respOf(a, qid)?.parts ?? []);

export interface RateRow {
  n: number;
  correct: number;
  partial: number;
  incorrect: number;
  unanswered: number;
  correctRate: number | null;
  unansweredRate: number | null;
  small: boolean;
}
export function rateRow(statuses: PartStatus[]): RateRow {
  const n = statuses.length;
  const c = (s: PartStatus) => statuses.filter((x) => x === s).length;
  const row = { n, correct: c("CORRECT"), partial: c("PARTIAL"), incorrect: c("INCORRECT"), unanswered: c("UNANSWERED") };
  return { ...row, correctRate: n ? row.correct / n : null, unansweredRate: n ? row.unanswered / n : null, small: isSmall(n) };
}

export type Difficulty = "hard" | "easy" | null;
export const difficultyOf = (rate: number | null): Difficulty => (rate == null ? null : rate < RULES.hardBelow ? "hard" : rate > RULES.easyAbove ? "easy" : null);

/** Top 27% vs bottom 27% by total score; null below 30 submissions. */
export function discrimination(rows: { percent: number; correct: boolean }[]): number | null {
  const n = rows.length;
  if (n < RULES.discriminationMinN) return null;
  const k = Math.max(1, Math.round(n * RULES.discriminationGroup));
  const s = [...rows].sort((a, b) => b.percent - a.percent);
  const rate = (g: typeof rows) => g.filter((r) => r.correct).length / g.length;
  return rate(s.slice(0, k)) - rate(s.slice(n - k));
}

export interface PartStat extends RateRow {
  key: string;
  label: string;
}
export interface QuestionStat extends RateRow {
  q: QuestionSnapshot;
  difficulty: Difficulty;
  discrimination: number | null;
  parts: PartStat[];
}

/** Tier B — every question (and every part of multi-blank questions). */
export function questionStats(done: Attempt[]): QuestionStat[] {
  return scoredQuestions(done).map((q) => {
    const statuses = done.map((a) => statusIn(a, q.questionId));
    const row = rateRow(statuses);
    const parts =
      q.parts.length > 1
        ? q.parts.map((p) => ({ key: p.key, label: p.label, ...rateRow(done.map((a) => respOf(a, q.questionId)?.parts.find((x) => x.key === p.key)?.status ?? "UNANSWERED")) }))
        : [];
    const disc = discrimination(done.map((a, i) => ({ percent: a.percent ?? 0, correct: statuses[i] === "CORRECT" })));
    return { q, ...row, difficulty: difficultyOf(row.correctRate), discrimination: disc, parts };
  });
}

export type SortKey = "order" | "most_wrong" | "most_right";
export function sortStats(stats: QuestionStat[], key: SortKey) {
  if (key === "order") return stats;
  const v = (s: QuestionStat) => s.correctRate ?? 0;
  return [...stats].sort((a, b) => (key === "most_wrong" ? v(a) - v(b) : v(b) - v(a)) || (a.q.number ?? 0) - (b.q.number ?? 0));
}

export interface ChoiceBar {
  letter: string;
  text: string;
  isCorrect: boolean;
  count: number;
}
export interface WrongAnswer {
  value: string;
  count: number;
  /** How many different spellings were merged into this value. */
  variants: number;
}
export interface Distribution {
  n: number;
  unanswered: number;
  choices?: ChoiceBar[];
  /** One list per part (blank); a single list for one-box text questions. */
  wrong?: { key: string; label: string; items: WrongAnswer[] }[];
}

/** Tier C — how answers spread: per option, per letter, or most common wrong values. */
export function distributionOf(q: QuestionSnapshot, done: Attempt[]): Distribution {
  const resps = done.map((a) => respOf(a, q.questionId));
  const n = done.length;
  const unanswered = resps.filter((r) => questionStatus(r?.parts ?? []) === "UNANSWERED").length;
  if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") {
    const choices = q.options!.map((o) => ({
      letter: o.letter,
      text: o.text,
      isCorrect: o.isCorrect,
      count: resps.filter((r) => (Array.isArray(r?.raw) ? r!.raw.includes(o.id) : r?.raw === o.id)).length,
    }));
    return { n, unanswered, choices };
  }
  if (q.type === "MATCHING") {
    const choices = q.poolEntries!.map((e) => ({ letter: e.letter, text: e.text, isCorrect: e.id === q.correctEntryId, count: resps.filter((r) => r?.raw === e.id).length }));
    return { n, unanswered, choices };
  }
  const wrong = q.parts.map((p, i) => {
    const groups = new Map<string, Set<string>>();
    const counts = new Map<string, number>();
    resps.forEach((r) => {
      const pr = r?.parts.find((x) => x.key === p.key);
      if (!pr || pr.normalized == null || pr.status === "CORRECT" || pr.status === "UNANSWERED") return;
      const rawText = Array.isArray(r!.raw) ? (r!.raw[i] ?? "") : String(r!.raw ?? "");
      counts.set(pr.normalized, (counts.get(pr.normalized) ?? 0) + 1);
      if (!groups.has(pr.normalized)) groups.set(pr.normalized, new Set());
      groups.get(pr.normalized)!.add(rawText);
    });
    const items = [...counts.entries()].map(([value, count]) => ({ value, count, variants: groups.get(value)!.size })).sort((a, b) => b.count - a.count).slice(0, 5);
    return { key: p.key, label: p.label, items };
  });
  return { n, unanswered, wrong };
}

/** Tier D — per section of the paper. */
export function sectionStats(done: Attempt[]) {
  const qs = scoredQuestions(done);
  const ids = [...new Set(qs.map((q) => q.sectionId))];
  return ids.map((sid) => {
    const inSec = qs.filter((q) => q.sectionId === sid);
    const statuses = done.flatMap((a) => inSec.map((q) => statusIn(a, q.questionId)));
    const max = inSec.reduce((s, q) => s + q.points, 0) * done.length;
    const earned = done.reduce((s, a) => s + inSec.reduce((x, q) => x + (respOf(a, q.questionId)?.parts.reduce((y, p) => y + p.earned, 0) ?? 0), 0), 0);
    return { sectionId: sid, title: inSec[0].sectionTitle, questions: inSec.length, n: done.length, ...rateRow(statuses), small: isSmall(done.length), pointsRate: max ? earned / max : null };
  });
}

/** Per-section score of one attempt (for the single-student view). */
export function sectionScoresOf(a: Attempt) {
  const qs = a.questions.filter((q) => !q.isExample);
  const ids = [...new Set(qs.map((q) => q.sectionId))];
  return ids.map((sid) => {
    const inSec = qs.filter((q) => q.sectionId === sid);
    const max = inSec.reduce((s, q) => s + q.points, 0);
    const earned = inSec.reduce((x, q) => x + (respOf(a, q.questionId)?.parts.reduce((y, p) => y + p.earned, 0) ?? 0), 0);
    return { sectionId: sid, title: inSec[0].sectionTitle, earned, max, rate: max ? earned / max : null };
  });
}

/** Tier E — one row per assigned student. */
export function studentRows(ds: ResultsDataset) {
  const ov = overview(ds);
  return rosterOf(ds).map((r) => {
    const a = r.attempt;
    const done = a && isSubmitted(a);
    const blanks = done ? a!.questions.filter((q) => !q.isExample && statusIn(a!, q.questionId) === "UNANSWERED").length : null;
    return {
      ...r,
      percent: done ? a!.percent : null,
      earned: done ? a!.scoreEarned : null,
      max: a?.scoreMax ?? null,
      minutes: done ? durationMin(a!) : null,
      blanks,
      vsMean: done && ov.mean != null ? (a!.percent ?? 0) - ov.mean : null,
    };
  });
}

/** Tier F — compare classes by class_id_at_start (not-started students by current class). */
export function classStats(ds: ResultsDataset) {
  const roster = rosterOf(ds);
  const ids = [...new Set(roster.map((r) => r.statsClassId))].sort();
  return ids.map((cid) => {
    const rows = roster.filter((r) => r.statsClassId === cid);
    const done = rows.map((r) => r.attempt).filter((a): a is Attempt => !!a && isSubmitted(a));
    const pcts = done.map((a) => a.percent ?? 0);
    const qs = scoredQuestions(done);
    const statuses = done.flatMap((a) => qs.map((q) => statusIn(a, q.questionId)));
    return { classId: cid, assigned: rows.length, submitted: done.length, submissionRate: rows.length ? done.length / rows.length : null, mean: mean(pcts), median: median(pcts), ...rateRow(statuses), small: isSmall(done.length) };
  });
}
