// @ts-nocheck -- prototype: strict index-access checks relaxed
/**
 * Sample results for the showcase demo: one small class (6A1, 24 students), deterministic so
 * every reload shows the same numbers. Includes every progress state, one student who moved to
 * 6A2 after submitting (still counted in 6A1), case/space variants of answers, and timed-out
 * students who left the last questions blank.
 */
import { createDemo, DEMO_ID } from "@/builder/demo";
import { gradeResponse, normalizeAnswer, snapshotAssignment } from "./grading";
import type { Attempt, QuestionSnapshot, RawAnswer, ResponseRecord, ResultsDataset, Student } from "./types";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "Nguyễn Minh Anh", "Trần Gia Bảo", "Lê Khánh Chi", "Phạm Đức Duy", "Hoàng Thu Hà", "Vũ Quang Huy",
  "Đặng Ngọc Hân", "Bùi Tuấn Khang", "Đỗ Phương Linh", "Ngô Bảo Long", "Dương Thảo My", "Lý Hoàng Nam",
  "Trịnh Yến Nhi", "Mai Anh Phúc", "Đinh Minh Quân", "Hồ Như Quỳnh", "Phan Thanh Sơn", "Tạ Minh Tâm",
  "Cao Thu Trang", "Lâm Gia Tuệ", "Chu Hải Đăng", "Kiều Bảo Ngọc", "Tôn Đức Thịnh", "Võ Khánh Vy",
];

/** Plausible mistakes Grade 6 learners make, keyed by the normalised first accepted answer. */
const WRONG: Record<string, string[]> = {
  "are playing": ["is playing", "play", "playing", "are play"],
  "nam's favourite subject is english": ["Nam favourite subject is English.", "Nam's favourite subject are English.", "Nam's favourite is English"],
  gets: ["get", "getting"],
  has: ["have", "haves"],
  goes: ["go", "going", "gos"],
  globe: ["map", "glob", "clock"],
  "in the library": ["in library", "in the garden", "library room"],
  friends: ["friend", "family", "grandparents"],
};
const FREE_TEXT = [
  ["Lan is my best friend. She is kind and she helps me with Maths.", 2],
  ["My best friend is Minh. He like football very much.", 1],
  ["I have a best friend. She tall.", 1],
  ["My best friend is Hoa. We go to school together every day.", 2],
  ["friend good", 0],
] as const;

/** How hard each question is (0 easy … 1 hard), by question number; others get a middle value. */
const DIFFICULTY: Record<number, number> = { 2: 0.9, 3: 0.02, 4: 0.08, 5: 0.55, 8: 0.85, 9: 0.6, 20: 0.55, 21: 0.82, 23: 0.5, 25: 0.15 };

const TZ = "+07:00";
const at = (day: number, h: number, m: number) => `2026-10-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(Math.floor(m)).padStart(2, "0")}:00${TZ}`;
const plus = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString();

const START = at(16, 7, 30);
const DUE = at(22, 21, 0);
const AS_OF = at(23, 8, 0);
const LIMIT = 40;

type Plan = "ontime" | "late" | "timed_out" | "in_progress" | "none";
const PLANS: Plan[] = [...Array(17).fill("ontime"), "late", "late", "timed_out", "timed_out", "in_progress", "none", "none"];

function variant(r: () => number, s: string) {
  const x = r();
  if (x < 0.15) return s.charAt(0).toUpperCase() + s.slice(1);
  if (x < 0.25) return ` ${s}  `;
  if (x < 0.32) return s.replace(" ", "  ");
  if (x < 0.38) return s.toUpperCase();
  return s;
}
const pick = <T,>(r: () => number, xs: readonly T[], weights?: number[]) => {
  const w = weights ?? xs.map(() => 1);
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < xs.length; i++) if ((x -= w[i]!) <= 0) return xs[i]!;
  return xs[xs.length - 1]!;
};

function answer(q: QuestionSnapshot, ability: number, r: () => number): { raw: RawAnswer; manual?: number } {
  const d = DIFFICULTY[q.number ?? 0] ?? 0.3 + ((q.number ?? 0) % 5) * 0.06;
  const p = 1 / (1 + Math.exp(-6 * (ability - d)));
  const ok = () => r() < p;
  switch (q.type) {
    case "SINGLE_CHOICE": {
      const right = q.options!.find((o) => o.isCorrect)!;
      if (ok()) return { raw: right.id };
      const wrong = q.options!.filter((o) => !o.isCorrect);
      return { raw: pick(r, wrong, wrong.map((_, i) => (i === 0 ? 3 : 1))).id };
    }
    case "MULTIPLE_CHOICE": {
      const right = q.options!.filter((o) => o.isCorrect).map((o) => o.id);
      const wrong = q.options!.filter((o) => !o.isCorrect).map((o) => o.id);
      if (ok()) return { raw: right };
      return { raw: r() < 0.6 ? right.slice(0, right.length - 1) : [...right, pick(r, wrong)] };
    }
    case "TEXT_INPUT": {
      if (q.gradingMode === "MANUAL") {
        const [text, score] = FREE_TEXT[Math.min(FREE_TEXT.length - 1, Math.floor((1 - ability) * FREE_TEXT.length + r() * 1.5))]!;
        return { raw: text, manual: score };
      }
      const key = q.acceptedAnswers![0]!;
      if (ok()) return { raw: variant(r, key) };
      const bank = WRONG[normalizeAnswer(key)] ?? [key.slice(0, -1)];
      return { raw: variant(r, pick(r, bank, bank.map((_, i) => bank.length - i))) };
    }
    case "MULTI_TEXT_INPUT":
      return {
        raw: q.blanks!.map((b) => {
          const key = b.acceptedAnswers[0]!;
          if (r() < 1 / (1 + Math.exp(-6 * (ability - d + 0.05)))) return variant(r, key);
          const bank = WRONG[normalizeAnswer(key)] ?? [key.slice(0, -1)];
          return pick(r, bank, bank.map((_, i) => bank.length - i));
        }),
      };
    case "MATCHING": {
      if (ok()) return { raw: q.correctEntryId! };
      const others = q.poolEntries!.filter((e) => e.id !== q.correctEntryId);
      return { raw: pick(r, others).id };
    }
  }
}

export function createSampleResults(): ResultsDataset {
  const r = rng(20261023);
  const questions = snapshotAssignment(createDemo());
  const scored = questions.filter((q) => !q.isExample);
  const scoreMax = scored.reduce((s, q) => s + q.points, 0);
  const students: Student[] = NAMES.map((name, i) => ({ id: `stu_${i + 1}`, name, classId: i === 5 ? "6A2" : "6A1" }));
  const attempts: Attempt[] = [];

  PLANS.forEach((plan, i) => {
    if (plan === "none") return;
    const stu = students[i]!;
    let ability = 0.35 + r() * 0.6;
    if (plan === "timed_out") ability = 0.3 + r() * 0.2;
    if (plan === "late") ability = 0.4 + r() * 0.25;

    let startedAt: string;
    if (plan === "late") startedAt = at(23, 6, 20 + r() * 40);
    else if (plan === "in_progress") startedAt = at(23, 7, 42);
    else startedAt = at(16 + Math.floor(r() * 6), 18 + Math.floor(r() * 3), r() * 59);
    const expiresAt = plus(startedAt, LIMIT);

    const timedOut = plan === "timed_out";
    const minutes = timedOut ? LIMIT : 17 + r() * 21;
    const submittedAt = plan === "in_progress" ? null : timedOut ? expiresAt : plus(startedAt, minutes);
    // Timed-out students never reached the last questions.
    const reached = timedOut ? 18 + Math.floor(r() * 4) : plan === "in_progress" ? 12 : Infinity;

    const responses: ResponseRecord[] = scored.map((q) => {
      const skipped = (q.number ?? 0) > reached || (r() < 0.04 && ability < 0.6);
      const { raw, manual } = skipped ? { raw: null } : answer(q, ability, r);
      return { questionId: q.questionId, raw, parts: submittedAt ? gradeResponse(q, raw, manual) : [] };
    });
    const earned = submittedAt ? Math.round(responses.reduce((s, x) => s + x.parts.reduce((y, p) => y + p.earned, 0), 0) * 100) / 100 : null;

    attempts.push({
      id: `att_${i + 1}`,
      studentId: stu.id,
      assignmentId: DEMO_ID,
      classIdAtStart: "6A1",
      startedAt,
      expiresAt,
      submittedAt,
      timedOut,
      late: !!submittedAt && new Date(submittedAt) > new Date(DUE),
      scoreEarned: earned,
      scoreMax,
      percent: earned == null ? null : Math.round((earned / scoreMax) * 1000) / 10,
      questions,
      responses,
    });
  });

  return { assignmentId: DEMO_ID, asOf: AS_OF, startAt: START, dueAt: DUE, timeLimitMin: LIMIT, assignedClassIds: ["6A1"], students, attempts, isSample: true };
}

let cache: ResultsDataset | null = null;
/** Mock results service: only the showcase demo has (sample) submissions for now. */
export function getResults(assignmentId: string): ResultsDataset | null {
  if (assignmentId !== DEMO_ID) return null;
  return (cache ??= createSampleResults());
}
