import * as ops from "./ops";
import type { Assignment, BlockItem, BlockType, QuestionItem, ToolKey } from "./types";

export type GuideScenario = "cloze" | "pool" | "media" | "instructions" | "groups";
export const GUIDE_BLOCK: Record<GuideScenario, BlockType> = {
  cloze: "PASSAGE",
  pool: "POOL",
  media: "MEDIA",
  instructions: "INSTRUCTIONS",
  groups: "PASSAGE",
};
export function createPractice(): Assignment {
  return {
    id: "shared-practice",
    title: "Shared Content · Thực hành",
    grade: 6,
    instructions: "",
    updatedAt: "",
    status: "draft",
    settings: {
      timeLimitMin: null,
      startAt: "",
      dueAt: "",
      classIds: [],
      showAnswers: "off",
      showPoints: true,
      shuffle: false,
    },
    sections: [
      {
        id: "practice-section",
        titleEn: "Practice",
        titleVi: "Khu thực hành",
        instructionsEn: "",
        instructionsVi: "",
        itemIds: [],
      },
      {
        id: "practice-section-2",
        titleEn: "Section II",
        titleVi: "Phần thứ hai",
        instructionsEn: "",
        instructionsVi: "",
        itemIds: [],
      },
    ],
    items: {},
  };
}
export function addPracticeItem(
  a: Assignment,
  tool: ToolKey,
  groupId: string | null = null,
): string {
  const item = ops.createItem(tool);
  a.items[item.id] = item;
  ops.place(a, item.id, {
    sectionId: groupId
      ? (ops.locate(a, groupId)?.sectionId ?? "practice-section")
      : "practice-section",
    groupId,
    index: groupId
      ? (a.items[groupId] as BlockItem).memberIds.length
      : (a.sections[0]?.itemIds.length ?? 0),
  });
  return item.id;
}
export function generatePracticeBlanks(a: Assignment, id: string) {
  const b = a.items[id];
  if (b?.kind !== "block" || b.block.type !== "PASSAGE") return;
  for (const n of new Set(ops.blankNumbers(b.block.text))) {
    if (
      b.memberIds.some((qid) => {
        const q = a.items[qid];
        return q?.kind === "question" && q.content.blankRef === n;
      })
    )
      continue;
    const qid = addPracticeItem(a, "TEXT_INPUT", id);
    const q = a.items[qid];
    if (q?.kind === "question") q.content.blankRef = n;
  }
}
export function poolUsers(a: Assignment, poolId: string, entryId: string): QuestionItem[] {
  return Object.values(a.items).filter(
    (q): q is QuestionItem =>
      q.kind === "question" &&
      q.content.type === "MATCHING" &&
      q.content.poolId === poolId &&
      q.content.correctEntryId === entryId,
  );
}
