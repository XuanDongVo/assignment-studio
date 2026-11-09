import { describe, expect, it } from "vitest";
import {
  addPracticeItem,
  createPractice,
  generatePracticeBlanks,
  poolUsers,
  fillPracticeBlock,
  fillPracticeQuestion,
  practiceQuestionReady,
  practiceBlanksLinked,
} from "@/builder/shared-guide";
import * as ops from "@/builder/ops";
import { buildStudentView } from "@/builder/student-view";

describe("isolated shared content practice", () => {
  it("does not treat two unrelated group questions as linked cloze blanks", () => {
    const a = createPractice();
    const id = addPracticeItem(a, "PASSAGE");
    const b = a.items[id];
    if (b?.kind !== "block") throw new Error("Missing block");
    fillPracticeBlock(b, "cloze");
    addPracticeItem(a, "TEXT_INPUT", id);
    addPracticeItem(a, "TEXT_INPUT", id);
    expect(practiceBlanksLinked(a, b)).toBe(false);
    generatePracticeBlanks(a, id);
    expect(practiceBlanksLinked(a, b)).toBe(true);
  });
  it.each(["cloze", "pool", "media", "instructions", "groups"] as const)(
    "completes %s samples with independently configured answers and a safe student view",
    (scenario) => {
      const a = createPractice();
      const tool =
        scenario === "pool"
          ? "POOL"
          : scenario === "media"
            ? "MEDIA"
            : scenario === "instructions"
              ? "INSTRUCTIONS"
              : "PASSAGE";
      const id = addPracticeItem(a, tool);
      const b = a.items[id];
      if (b?.kind !== "block") throw new Error("Missing block");
      fillPracticeBlock(b, scenario);
      if (scenario === "cloze") generatePracticeBlanks(a, id);
      else
        addPracticeItem(
          a,
          scenario === "pool" ? "MATCHING" : scenario === "media" ? "SINGLE_CHOICE" : "TEXT_INPUT",
          id,
        );
      for (const [i, qid] of b.memberIds.entries()) {
        const q = a.items[qid];
        if (q?.kind !== "question") throw new Error("Missing question");
        expect(practiceQuestionReady(q, a)).toBe(false);
        fillPracticeQuestion(q, b, i);
        expect(practiceQuestionReady(q, a)).toBe(true);
        expect(q.config.groupId).toBe(id);
      }
      const view = buildStudentView(a);
      expect(view.totalQuestions).toBe(scenario === "cloze" ? 2 : 1);
      const studentJson = JSON.stringify(view);
      expect(studentJson).not.toContain("acceptedAnswers");
      expect(studentJson).not.toContain("isCorrect");
    },
  );
  it("keeps pool entry ids and existing answer links when sample content is filled again", () => {
    const a = createPractice();
    const id = addPracticeItem(a, "POOL");
    const b = a.items[id];
    if (b?.kind !== "block" || b.block.type !== "POOL") throw new Error("Missing pool");
    fillPracticeBlock(b, "pool");
    const qid = addPracticeItem(a, "MATCHING", id);
    const q = a.items[qid];
    if (q?.kind !== "question" || q.content.type !== "MATCHING")
      throw new Error("Missing matching");
    fillPracticeQuestion(q, b, 0);
    const entryId = q.content.correctEntryId;
    fillPracticeBlock(b, "pool");
    expect(q.content.correctEntryId).toBe(entryId);
    expect(b.block.entries[1]?.id).toBe(entryId);
  });
  it("never changes another practice or the live assignment", () => {
    const original = createPractice();
    const sandbox = createPractice();
    addPracticeItem(sandbox, "PASSAGE");
    expect(Object.keys(original.items)).toHaveLength(0);
  });
  it("creates one independently editable question for each cloze blank", () => {
    const a = createPractice();
    const id = addPracticeItem(a, "PASSAGE");
    const b = a.items[id];
    if (b?.kind !== "block" || b.block.type !== "PASSAGE") throw new Error("Missing passage");
    b.block.text = "School has {{1}} floors and {{2}} classrooms.";
    generatePracticeBlanks(a, id);
    generatePracticeBlanks(a, id);
    expect(b.memberIds).toHaveLength(2);
    expect(
      b.memberIds.map((qid) => {
        const q = a.items[qid];
        return q?.kind === "question" ? q.content.blankRef : null;
      }),
    ).toEqual([1, 2]);
  });
  it("finds pool choices in use by matching before deletion", () => {
    const a = createPractice();
    const id = addPracticeItem(a, "POOL");
    const b = a.items[id];
    if (b?.kind !== "block" || b.block.type !== "POOL" || !b.block.entries[0])
      throw new Error("Missing pool");
    const entry = b.block.entries[0].id;
    const qid = addPracticeItem(a, "MATCHING", id);
    const q = a.items[qid];
    if (q?.kind !== "question" || q.content.type !== "MATCHING")
      throw new Error("Missing matching");
    q.content.correctEntryId = entry;
    expect(poolUsers(a, id, entry).map((q) => q.id)).toEqual([qid]);
  });
  it("moves group with members and safely ungroups without deleting questions", () => {
    const a = createPractice();
    const id = addPracticeItem(a, "MEDIA");
    const qid = addPracticeItem(a, "TEXT_INPUT", id);
    ops.moveTo(a, id, { sectionId: "practice-section-2", groupId: null, index: 0 });
    expect(ops.locate(a, qid)?.sectionId).toBe("practice-section-2");
    ops.removeItem(a, id, false);
    expect(a.items[qid]).toBeDefined();
    expect(ops.locate(a, qid)?.groupId).toBe(null);
  });
});
