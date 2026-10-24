// @ts-nocheck -- test helpers use loose indexing
import { beforeEach, describe, expect, it } from "vitest";
import { snapshotAssignment } from "@/analytics/grading";
import { createDemo, DEMO_ID } from "@/builder/demo";
import { contentChangeBlocked, createAttemptServer, SESSION_TIMEOUT_MS } from "@/attempts/rules";
import { emptyDB } from "@/attempts/types";
import type { Assignment } from "@/builder/types";

const ANNA = { studentId: "s1" };
const BINH = { studentId: "s2" };
const OUTSIDER = { studentId: "s3" };
const STUDENTS = { s1: { id: "s1", name: "Anna", classId: "6A1" }, s2: { id: "s2", name: "Bình", classId: "6A1" }, s3: { id: "s3", name: "Chi", classId: "7A1" } };

let now: number;
let assignment: Assignment;
let failGrading: boolean;
let db: ReturnType<typeof emptyDB>;
let n = 0;
const server = () =>
  createAttemptServer(db, {
    now: () => now,
    getAssignment: (id) => (id === assignment.id ? assignment : null),
    listAssignments: () => [assignment],
    getStudent: (id) => STUDENTS[id] ?? null,
    newId: () => `att_${++n}`,
    shouldFailGrading: () => failGrading,
  });
const min = 60_000;
const qs = () => snapshotAssignment(assignment).filter((q) => !q.isExample);
const single = () => qs().find((q) => q.type === "SINGLE_CHOICE");
const right = (q) => q.options.find((o) => o.isCorrect).id;
const wrong = (q) => q.options.find((o) => !o.isCorrect).id;

function startAnna(session = "tabA") {
  const r = server().start(ANNA, DEMO_ID, session);
  expect(r.ok).toBe(true);
  return r.data.attempt;
}
function save(att, raw, { q = single(), baseVersion = 0, session = "tabA", requestId = `r${++n}`, who = ANNA } = {}) {
  return server().saveAnswer(who, { attemptId: att.id, sessionId: session, questionId: q.questionId, raw, baseVersion, requestId });
}

beforeEach(() => {
  db = emptyDB();
  assignment = createDemo(); // published, class 6A1, opens 16/10 07:30, due 22/10 21:00, 40 minutes
  now = new Date("2026-10-20T08:00").getTime();
  failGrading = false;
});

describe("who may start", () => {
  it("a student not assigned the work cannot view or start it", () => {
    expect(server().open(OUTSIDER, DEMO_ID, "x").code).toBe("FORBIDDEN");
    expect(server().start(OUTSIDER, DEMO_ID, "x").code).toBe("FORBIDDEN");
  });

  it("draft and archived assignments create no new attempt", () => {
    for (const status of ["draft", "archived"] as const) {
      assignment = { ...createDemo(), status };
      expect(server().start(ANNA, DEMO_ID, "x").code).toBe("NOT_AVAILABLE");
    }
    expect(Object.keys(db.attempts)).toHaveLength(0);
  });

  it("cannot start before the start date", () => {
    now = new Date("2026-10-15T08:00").getTime();
    expect(server().start(ANNA, DEMO_ID, "x").code).toBe("NOT_OPEN_YET");
  });

  it("can still start after the due date while published, and is marked late", () => {
    now = new Date("2026-10-24T08:00").getTime();
    const att = startAnna();
    const r = server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s" });
    expect(r.data.attempt.status).toBe("SUBMITTED");
    expect(r.data.attempt.late).toBe(true);
  });
});

describe("one official attempt", () => {
  it("pressing Start again returns the same attempt", () => {
    const a = startAnna();
    const b = server().start(ANNA, DEMO_ID, "tabA").data.attempt;
    expect(b.id).toBe(a.id);
    expect(Object.keys(db.attempts)).toHaveLength(1);
  });

  it("after submitting, answers are refused and no second attempt starts", () => {
    const att = startAnna();
    server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s" });
    expect(save(att, right(single())).code).toBe("ALREADY_FINISHED");
    expect(server().start(ANNA, DEMO_ID, "tabA").code).toBe("ALREADY_FINISHED");
    expect(Object.keys(db.attempts)).toHaveLength(1);
  });

  it("submitting twice grades once and returns the same result", () => {
    const att = startAnna();
    const first = server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s1" });
    now += 5 * min;
    const again = server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s2" });
    expect(again.data.attempt.finishedAt).toBe(first.data.attempt.finishedAt);
    expect(again.data.attempt.scoreEarned).toBe(first.data.attempt.scoreEarned);
  });

  it("another student's attempt id is refused", () => {
    const att = startAnna();
    expect(save(att, right(single()), { who: BINH }).code).toBe("FORBIDDEN");
    expect(server().getAttempt(BINH, att.id).code).toBe("FORBIDDEN");
    expect(server().submit(BINH, { attemptId: att.id, sessionId: "tabA", requestId: "x" }).code).toBe("FORBIDDEN");
  });
});

describe("time is kept by the server", () => {
  it("an answer sent after time is up is refused; only saved answers are graded", () => {
    const att = startAnna();
    const q = single();
    save(att, right(q), { q });
    now += 41 * min;
    const r = save(att, wrong(q), { q, baseVersion: 1 });
    expect(r.code).toBe("TIME_UP");
    const done = db.attempts[att.id];
    expect(done.status).toBe("TIMED_OUT");
    expect(done.answers[q.questionId].raw).toBe(right(q));
    expect(done.finishedAt).toBe(att.expiresAt);
  });

  it("an expired attempt is completed even if no screen comes back", () => {
    const att = startAnna();
    now += 60 * min;
    server().sweep();
    expect(db.attempts[att.id].status).toBe("TIMED_OUT");
  });

  it("submitting exactly when time runs out gives one TIMED_OUT result", () => {
    const att = startAnna();
    now = new Date(att.expiresAt).getTime();
    const r = server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s" });
    expect(r.data.attempt.status).toBe("TIMED_OUT");
  });

  it("timed out after the due date is both TIMED_OUT and late", () => {
    now = new Date("2026-10-22T20:40").getTime();
    const att = startAnna(); // expires 21:20, due 21:00
    now += 45 * min;
    server().sweep();
    expect(db.attempts[att.id].status).toBe("TIMED_OUT");
    expect(db.attempts[att.id].late).toBe(true);
  });

  it("score, status or time sent by the client are ignored", () => {
    const att = startAnna();
    const q = single();
    server().saveAnswer(ANNA, { attemptId: att.id, sessionId: "tabA", questionId: q.questionId, raw: wrong(q), baseVersion: 0, requestId: "r", scoreEarned: 999, status: "CORRECT", savedAt: "2020-01-01" } as never);
    const r = server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s", scoreEarned: 999 } as never);
    expect(r.data.attempt.scoreEarned).toBe(0);
    expect(db.attempts[att.id].answers[q.questionId].savedAt).not.toBe("2020-01-01");
  });
});

describe("answer checks", () => {
  it("a choice that does not belong to the question is refused", () => {
    const att = startAnna();
    expect(save(att, "o_from_another_question").code).toBe("INVALID_ANSWER");
  });

  it("a multi-blank answer must have exactly one text per blank", () => {
    const att = startAnna();
    const q = qs().find((x) => x.type === "MULTI_TEXT_INPUT");
    expect(save(att, ["only one"], { q }).code).toBe(q.blanks.length === 1 ? undefined : "INVALID_ANSWER");
    expect(save(att, q.blanks.map(() => "x"), { q }).ok).toBe(true);
  });

  it("example questions cannot be answered", () => {
    const att = startAnna();
    const ex = snapshotAssignment(assignment).find((q) => q.isExample);
    expect(save(att, "x", { q: ex }).code).toBe("INVALID_ANSWER");
  });

  it("an older version cannot overwrite a newer answer", () => {
    const att = startAnna();
    const q = single();
    expect(save(att, wrong(q), { q, baseVersion: 0 }).data.version).toBe(1);
    expect(save(att, right(q), { q, baseVersion: 1 }).data.version).toBe(2);
    const stale = save(att, wrong(q), { q, baseVersion: 1 });
    expect(stale.code).toBe("VERSION_CONFLICT");
    expect(stale.current).toEqual({ raw: right(q), version: 2 });
    expect(db.attempts[att.id].answers[q.questionId].raw).toBe(right(q));
  });

  it("retrying a request whose reply was lost returns the first result without saving twice", () => {
    const att = startAnna();
    const q = single();
    const a = save(att, right(q), { q, requestId: "same" });
    const b = save(att, right(q), { q, requestId: "same" });
    expect(b).toEqual(a);
    expect(db.attempts[att.id].answers[q.questionId].version).toBe(1);
  });

  it("unanswered questions do not block submitting and score 0", () => {
    const att = startAnna();
    const r = server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s" });
    expect(r.data.attempt.status).toBe("SUBMITTED");
    expect(db.attempts[att.id].responses.every((x) => x.parts.every((p) => p.status === "UNANSWERED"))).toBe(true);
  });
});

describe("one screen at a time", () => {
  it("a second tab cannot take over or write while the first is active", () => {
    const att = startAnna("tabA");
    expect(server().open(ANNA, DEMO_ID, "tabB").data.control).toBe("elsewhere");
    expect(server().claim(ANNA, att.id, "tabB").code).toBe("SESSION_CONFLICT");
    expect(save(att, right(single()), { session: "tabB" }).code).toBe("SESSION_LOST");
    expect(save(att, right(single()), { session: "tabA" }).ok).toBe(true);
  });

  it("reloading the same tab keeps control", () => {
    const att = startAnna("tabA");
    expect(server().open(ANNA, DEMO_ID, "tabA").data.control).toBe("mine");
    expect(server().open(ANNA, DEMO_ID, "tabA").data.attempt.id).toBe(att.id);
  });

  it("after the first screen goes silent, another screen may take over and the old one is cut off", () => {
    const att = startAnna("tabA");
    now += SESSION_TIMEOUT_MS + 1000;
    expect(server().claim(ANNA, att.id, "tabB").ok).toBe(true);
    expect(save(att, right(single()), { session: "tabA" }).code).toBe("SESSION_LOST");
  });

  it("closing the tab releases control immediately", () => {
    const att = startAnna("tabA");
    server().release(ANNA, att.id, "tabA");
    expect(server().claim(ANNA, att.id, "tabB").ok).toBe(true);
  });
});

describe("grading failure", () => {
  it("never leaves a half-finished attempt; answers stay frozen and a retry completes it", () => {
    const att = startAnna();
    const q = single();
    save(att, right(q), { q });
    failGrading = true;
    expect(server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s" }).code).toBe("GRADING_FAILED");
    expect(db.attempts[att.id].status).toBe("IN_PROGRESS");
    expect(db.attempts[att.id].scoreEarned).toBe(null);
    expect(save(att, wrong(q), { q, baseVersion: 1 }).code).toBe("FINALIZING");
    failGrading = false;
    now += 2 * min;
    const r = server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s" });
    expect(r.data.attempt.status).toBe("SUBMITTED");
    expect(r.data.attempt.finishedAt).toBe(new Date(new Date("2026-10-20T08:00").getTime()).toISOString());
    expect(r.data.attempt.scoreEarned).toBe(q.points);
  });
});

describe("answer key", () => {
  it("nothing the student receives contains the key", () => {
    const att = startAnna();
    const json = JSON.stringify(server().open(ANNA, DEMO_ID, "tabA"));
    expect(json).not.toMatch(/isCorrect|acceptedAnswers|correctEntryId|explanation|hint/);
    expect(JSON.stringify(att)).not.toMatch(/isCorrect|acceptedAnswers|correctEntryId/);
  });

  it("result hides correct answers when the teacher turned them off", () => {
    assignment = { ...createDemo(), settings: { ...createDemo().settings, showAnswers: "off" } };
    const att = startAnna();
    server().submit(ANNA, { attemptId: att.id, sessionId: "tabA", requestId: "s" });
    const r = server().result(ANNA, att.id);
    expect(r.data.review).toBe(null);
  });

  it("result is refused before the attempt is finished", () => {
    const att = startAnna();
    expect(server().result(ANNA, att.id).code).toBe("NOT_FINISHED");
  });
});

describe("teacher edits after students start", () => {
  it("content is locked once someone started; settings and title stay editable", () => {
    const prev = createDemo();
    const edited = structuredClone(prev);
    const firstId = Object.keys(edited.items)[0];
    edited.items[firstId] = { ...edited.items[firstId], id: firstId, extra: 1 } as never;
    expect(contentChangeBlocked(prev, edited, 1)).toMatch(/khóa/);
    expect(contentChangeBlocked(prev, edited, 0)).toBe(null);
    const settingsOnly = { ...prev, title: "New name", settings: { ...prev.settings, dueAt: "2026-10-30T21:00" } };
    expect(contentChangeBlocked(prev, settingsOnly, 3)).toBe(null);
  });
});
