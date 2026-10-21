// @ts-nocheck -- test inspects seeded data
import { describe, expect, it } from "vitest";
import { createDemo } from "@/builder/demo";
import { validate } from "@/builder/validation";

describe("full demo assignment", () => {
  const a = createDemo();
  const items = Object.values(a.items);

  it("uses every question type, including true/false", () => {
    const types = new Set(items.filter((i) => i.kind === "question").map((i) => i.content.type));
    for (const t of ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TEXT_INPUT", "MULTI_TEXT_INPUT", "MATCHING"]) expect(types.has(t)).toBe(true);
    const trueFalse = items.some((i) => i.kind === "question" && i.content.type === "SINGLE_CHOICE" && i.content.options.map((o) => o.text).join() === "True,False");
    expect(trueFalse).toBe(true);
  });

  it("uses every shared block type, each owning questions", () => {
    for (const t of ["INSTRUCTIONS", "PASSAGE", "MEDIA", "POOL"]) {
      const b = items.find((i) => i.kind === "block" && i.block.type === t);
      expect(b).toBeDefined();
      expect(b.memberIds.length).toBeGreaterThan(0);
    }
  });

  it("has no validation errors (ready to publish)", () => {
    expect(validate(a).filter((i) => i.level === "error")).toEqual([]);
  });
});
