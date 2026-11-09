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

/** Explicit sample actions only; never called by the live builder. */
export function fillPracticeBlock(b: BlockItem, scenario: GuideScenario) {
  if (b.block.type === "PASSAGE") {
    b.block.title = "My school";
    b.block.text =
      scenario === "cloze"
        ? "My school has {{1}} floors and a big {{2}}."
        : "My school has two floors and a big library. Read and answer the questions.";
  } else if (b.block.type === "POOL") {
    const texts = [
      "No, they are sleeping.",
      "By bicycle.",
      "To buy some bread.",
      "My friends.",
      "Five days a week.",
      "Home.",
      "Yes, I do.",
      "I go out and play in the playground.",
    ];
    const old = b.block.entries;
    b.block.entries = texts.map((text, i) => ({ id: old[i]?.id ?? ops.uid("e"), text }));
  } else if (b.block.type === "MEDIA") {
    b.block.url = "/demo/classroom.jpg";
    b.block.alt = "Students in an English classroom";
    b.block.caption = "Look at the picture and answer the questions.";
  } else {
    b.block.text = "Read each question carefully. Write a short answer in English.";
  }
}

export function fillPracticeQuestion(q: QuestionItem, b: BlockItem, index: number) {
  const c = q.content;
  if (c.type === "MATCHING" && b.block.type === "POOL") {
    c.prompt = "How do you go to school?";
    c.poolId = b.id;
    c.correctEntryId = b.block.entries[1]?.id ?? null;
  } else if (c.type === "TEXT_INPUT") {
    c.prompt = c.blankRef
      ? `Complete blank (${c.blankRef}).`
      : "How many floors does the school have?";
    c.acceptedAnswers = [c.blankRef === 2 ? "library" : "two"];
  } else if (c.type === "SINGLE_CHOICE" || c.type === "MULTIPLE_CHOICE") {
    c.prompt = "Where are the students?";
    c.options.forEach((o, i) => {
      o.text = ["In a classroom", "In a park", "In a kitchen", "In a shop"][i] ?? `Place ${i + 1}`;
      o.isCorrect = i === 0;
    });
  } else if (c.type === "MULTI_TEXT_INPUT") {
    c.prompt =
      c.blanks
        .map((_, i) =>
          i === 0 ? "The students are in a {{1}}" : `and they are learning {{${i + 1}}}`,
        )
        .join(" ") + ".";
    c.blanks.forEach((bl, i) => {
      bl.acceptedAnswers = [i === 0 ? "classroom" : "English"];
    });
  }
  if (!c.prompt) c.prompt = `Question ${index + 1}`;
}

export function practiceQuestionReady(q: QuestionItem, a: Assignment): boolean {
  const c = q.content;
  if (!c.prompt.trim() && !c.blankRef) return false;
  if (c.type === "TEXT_INPUT") return c.acceptedAnswers.some((s) => s.trim());
  if (c.type === "MULTI_TEXT_INPUT")
    return c.blanks.length > 0 && c.blanks.every((b) => b.acceptedAnswers.some((s) => s.trim()));
  if (c.type === "MATCHING")
    return (
      poolUsers(a, c.poolId ?? "", c.correctEntryId ?? "").some((item) => item.id === q.id) &&
      (() => {
        const pool = a.items[c.poolId ?? ""];
        return (
          pool?.kind === "block" &&
          pool.block.type === "POOL" &&
          pool.block.entries.some((e) => e.id === c.correctEntryId)
        );
      })()
    );
  return (
    c.options.length >= 2 &&
    c.options.every((o) => o.text.trim()) &&
    c.options.some((o) => o.isCorrect)
  );
}

export function practiceBlanksLinked(a: Assignment, b: BlockItem): boolean {
  if (b.block.type !== "PASSAGE") return false;
  const numbers = [...new Set(ops.blankNumbers(b.block.text))];
  return (
    numbers.length > 0 &&
    numbers.every((n) =>
      b.memberIds.some((id) => {
        const q = a.items[id];
        return q?.kind === "question" && q.config.groupId === b.id && q.content.blankRef === n;
      }),
    )
  );
}
