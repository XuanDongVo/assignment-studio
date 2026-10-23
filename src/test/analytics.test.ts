// @ts-nocheck -- test builds small fixtures by hand
import { describe, expect, it } from "vitest";
import { gradeResponse, normalizeAnswer, questionStatus } from "@/analytics/grading";
import { classStats, difficultyOf, discrimination, distributionOf, overview, progressOf, questionStats, rosterOf } from "@/analytics/metrics";
import { createSampleResults } from "@/analytics/fake-data";
import type { Attempt, QuestionSnapshot, ResultsDataset } from "@/analytics/types";

const textQ: QuestionSnapshot = {
  questionId: "q1", number: 1, type: "TEXT_INPUT", gradingMode: "AUTO", prompt: "", sectionId: "s1", sectionTitle: "S1",
  groupLabel: null, points: 1, isExample: false, acceptedAnswers: ["are playing"], caseSensitive: false, parts: [{ key: "main", label: "", max: 1 }],
};
const exampleQ: QuestionSnapshot = { ...textQ, questionId: "q0", number: null, isExample: true, points: 0 };

const attempt = (id: string, raw: string | null, extra: Partial<Attempt> = {}): Attempt => {
  const parts = gradeResponse(textQ, raw);
  const earned = parts[0].earned;
  return {
    id, studentId: id, assignmentId: "a", classIdAtStart: "6A1", startedAt: "2026-10-20T10:00:00Z", expiresAt: null,
    submittedAt: "2026-10-20T10:20:00Z", timedOut: false, late: false, scoreEarned: earned, scoreMax: 1, percent: earned * 100,
    questions: [exampleQ, textQ], responses: [{ questionId: "q1", raw, parts }], ...extra,
  };
};

const dataset = (attempts: Attempt[], students = attempts.map((a) => ({ id: a.studentId, name: a.studentId, classId: a.classIdAtStart }))): ResultsDataset => ({
  assignmentId: "a", asOf: "2026-10-25T00:00:00Z", startAt: "2026-10-18T00:00:00Z", dueAt: "2026-10-24T00:00:00Z",
  timeLimitMin: 40, assignedClassIds: ["6A1"], students, attempts, isSample: true,
});

describe("results metrics", () => {
  it("blank answers stay in the denominator of the correct rate", () => {
    const [s] = questionStats([attempt("a", "are playing"), attempt("b", null), attempt("c", "play"), attempt("d", "are playing")]);
    expect(s.n).toBe(4);
    expect(s.correctRate).toBe(0.5);
    expect(s.unansweredRate).toBe(0.25);
  });

  it("example items are never counted", () => {
    expect(questionStats([attempt("a", "x")]).map((s) => s.q.questionId)).toEqual(["q1"]);
  });

  it("in-progress attempts are excluded from scores; timed-out work is included", () => {
    const ds = dataset([
      attempt("a", "are playing"),
      attempt("b", null, { timedOut: true, percent: 0, scoreEarned: 0 }),
      attempt("c", null, { submittedAt: null, percent: null, scoreEarned: null }),
    ]);
    const ov = overview(ds);
    expect(ov.submitted).toBe(2);
    expect(ov.mean).toBe(50);
    expect(ov.counts.in_progress).toBe(1);
    expect(ov.counts.timed_out).toBe(1);
  });

  it("submission rate = submitted / assigned", () => {
    const ds = dataset([attempt("a", "x")], [{ id: "a", name: "A", classId: "6A1" }, { id: "b", name: "B", classId: "6A1" }]);
    expect(overview(ds).submissionRate).toBe(0.5);
  });

  it("started work counts in class_id_at_start; not-started students in their current class", () => {
    const ds = dataset([attempt("moved", "x")], [
      { id: "moved", name: "Moved", classId: "6A2" },
      { id: "newcomer", name: "New", classId: "6A1" },
      { id: "other", name: "Other", classId: "6A2" },
    ]);
    expect(rosterOf(ds).map((r) => [r.student.id, r.statsClassId])).toEqual([["moved", "6A1"], ["newcomer", "6A1"]]);
    expect(classStats(ds).map((c) => [c.classId, c.assigned])).toEqual([["6A1", 2]]);
  });

  it("no attempt after the due date is overdue, before it is not started", () => {
    expect(progressOf(undefined, "2026-10-24T00:00:00Z", "2026-10-25T00:00:00Z")).toBe("overdue");
    expect(progressOf(undefined, "2026-10-24T00:00:00Z", "2026-10-23T00:00:00Z")).toBe("not_started");
  });

  it("flags below 40% as hard and above 90% as too easy", () => {
    expect(difficultyOf(0.39)).toBe("hard");
    expect(difficultyOf(0.4)).toBe(null);
    expect(difficultyOf(0.9)).toBe(null);
    expect(difficultyOf(0.91)).toBe("easy");
  });

  it("figures with fewer than 5 submissions are marked as a small sample", () => {
    expect(questionStats([attempt("a", "x"), attempt("b", "x"), attempt("c", "x"), attempt("d", "x")])[0].small).toBe(true);
    expect(questionStats(["a", "b", "c", "d", "e"].map((id) => attempt(id, "x")))[0].small).toBe(false);
  });

  it("common wrong answers merge case and extra-space variants", () => {
    const d = distributionOf(textQ, [attempt("a", "Play"), attempt("b", " play  "), attempt("c", "playing"), attempt("d", "are playing")]);
    expect(d.wrong[0].items[0]).toEqual({ value: "play", count: 2, variants: 2 });
    expect(normalizeAnswer("  Are   Playing. ")).toBe("are playing");
  });

  it("discrimination needs at least 30 submissions", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ percent: i, correct: i >= n / 2 }));
    expect(discrimination(rows(29))).toBeNull();
    expect(discrimination(rows(30))).toBe(1);
  });

  it("multiple choice gives partial credit and a whole-question PARTIAL status", () => {
    const q = { ...textQ, type: "MULTIPLE_CHOICE", points: 2, options: [
      { id: "o1", letter: "A", text: "Maths", isCorrect: true }, { id: "o2", letter: "B", text: "Bed", isCorrect: false }, { id: "o3", letter: "C", text: "History", isCorrect: true },
    ] };
    const parts = gradeResponse(q, ["o1"]);
    expect(parts[0]).toMatchObject({ status: "PARTIAL", earned: 1, normalized: "A" });
    expect(questionStatus(parts)).toBe("PARTIAL");
  });
});

describe("sample results for the demo", () => {
  const ds = createSampleResults();
  it("one class of 24 with every progress state except not-started (due date has passed)", () => {
    const ov = overview(ds);
    expect(ov.assigned).toBe(24);
    expect(ov.counts).toMatchObject({ submitted: 17, late: 2, timed_out: 2, in_progress: 1, overdue: 2, not_started: 0 });
  });
  it("is the same on every load", () => {
    expect(createSampleResults().attempts.map((a) => a.percent)).toEqual(ds.attempts.map((a) => a.percent));
  });
});
