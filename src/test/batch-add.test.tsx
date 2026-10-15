// @ts-nocheck -- test uses seeded data
import { describe, expect, it } from "vitest";
import * as ops from "@/builder/ops";
import { useBuilder } from "@/builder/store";
import type { Assignment } from "@/builder/types";

describe("batch creation rules", () => {
  it("new questions never pre-mark a correct answer", () => {
    for (const t of ["SINGLE_CHOICE", "TRUE_FALSE", "MULTIPLE_CHOICE"] as const) {
      const q: any = ops.createItem(t);
      expect(q.content.options.some((o: any) => o.isCorrect)).toBe(false);
      expect(q.content.prompt).toBe("");
    }
  });

  it("adds N questions in a row right after the selected item, each with its own id", () => {
    const st = useBuilder.getState();
    const a = useBuilder.getState().assignment as Assignment;
    const sec = a.sections[0];
    const anchor = sec.itemIds[0];
    st.select({ kind: "item", id: anchor });
    st.addTool("TEXT_INPUT", null, 3);
    const after = useBuilder.getState().assignment.sections[0].itemIds;
    const added = after.slice(1, 4);
    expect(after[0]).toBe(anchor);
    expect(new Set(added).size).toBe(3);
    expect(after.slice(4)).toEqual(sec.itemIds.slice(1));
    added.forEach((id) => expect((useBuilder.getState().assignment.items[id] as any).content.type).toBe("TEXT_INPUT"));
  });

  it("without a selection, inserts at the end of the section target", () => {
    const st = useBuilder.getState();
    st.select(null);
    const sec = useBuilder.getState().assignment.sections[1];
    const before = sec.itemIds.length;
    st.addTool("SINGLE_CHOICE", { sectionId: sec.id, groupId: null, index: before }, 2);
    expect(useBuilder.getState().assignment.sections[1].itemIds.length).toBe(before + 2);
  });
});
