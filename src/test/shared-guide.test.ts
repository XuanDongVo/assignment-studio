import { describe, expect, it } from "vitest";
import {
  addPracticeItem,
  createPractice,
  generatePracticeBlanks,
  poolUsers,
} from "@/builder/shared-guide";
import * as ops from "@/builder/ops";

describe("isolated shared content practice", () => {
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
