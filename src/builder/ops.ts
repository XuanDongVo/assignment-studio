import type {
  Assignment,
  BlockItem,
  ID,
  InsertTarget,
  Item,
  QuestionItem,
  Section,
  Selection,
  ToolKey,
} from "./types";

export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 10)}`;
export const letter = (i: number) => String.fromCharCode(65 + i);

export const QUESTION_TOOLS: ToolKey[] = [
  "SINGLE_CHOICE",
  "TRUE_FALSE",
  "MULTIPLE_CHOICE",
  "TEXT_INPUT",
  "MULTI_BLANKS",
  "MATCHING",
];
export const isQuestionTool = (t: ToolKey) => QUESTION_TOOLS.includes(t);
export const isBlockTool = (t: ToolKey) =>
  t === "INSTRUCTIONS" || t === "PASSAGE" || t === "MEDIA" || t === "POOL";

export function locate(a: Assignment, id: ID): InsertTarget | null {
  for (const s of a.sections) {
    const i = s.itemIds.indexOf(id);
    if (i >= 0) return { sectionId: s.id, groupId: null, index: i };
    for (const tid of s.itemIds) {
      const it = a.items[tid];
      if (it?.kind === "block") {
        const j = it.memberIds.indexOf(id);
        if (j >= 0) return { sectionId: s.id, groupId: tid, index: j };
      }
    }
  }
  return null;
}

export function getSection(a: Assignment, id: ID): Section | undefined {
  return a.sections.find((s) => s.id === id);
}

function container(a: Assignment, t: { sectionId: ID; groupId: ID | null }): ID[] {
  if (t.groupId) return (a.items[t.groupId] as BlockItem).memberIds;
  return getSection(a, t.sectionId)!.itemIds;
}

export function detach(a: Assignment, id: ID) {
  const loc = locate(a, id);
  if (loc) container(a, loc).splice(loc.index, 1);
  return loc;
}

/** Normalises the target (blocks cannot nest in groups) and inserts the id. */
export function place(a: Assignment, id: ID, target: InsertTarget) {
  const item = a.items[id];
  let t = target;
  if (item.kind === "block" && t.groupId) {
    const s = getSection(a, t.sectionId)!;
    t = { sectionId: t.sectionId, groupId: null, index: s.itemIds.indexOf(t.groupId) + 1 };
  }
  const arr = container(a, t);
  arr.splice(Math.max(0, Math.min(t.index, arr.length)), 0, id);
  if (item.kind === "question") {
    item.config.groupId = t.groupId;
    const g = t.groupId ? (a.items[t.groupId] as BlockItem) : null;
    if (item.content.type === "MATCHING" && g?.block.type === "POOL" && !item.content.poolId)
      item.content.poolId = g.id;
    if (g?.block.type !== "PASSAGE") item.content.blankRef = null;
  }
}

export function moveTo(a: Assignment, id: ID, target: InsertTarget) {
  if (target.groupId === id) return;
  detach(a, id);
  place(a, id, target);
}

export function moveBy(a: Assignment, id: ID, delta: number) {
  const loc = locate(a, id);
  if (!loc) return;
  const arr = container(a, loc);
  const n = loc.index + delta;
  if (n < 0 || n >= arr.length) {
    // fallback: move across section boundary for top-level items
    if (loc.groupId) return;
    const si = a.sections.findIndex((s) => s.id === loc.sectionId);
    const other = a.sections[si + delta];
    if (!other) return;
    arr.splice(loc.index, 1);
    if (delta < 0) other.itemIds.push(id);
    else other.itemIds.unshift(id);
    return;
  }
  [arr[loc.index], arr[n]] = [arr[n], arr[loc.index]];
}

export function removeItem(a: Assignment, id: ID, withMembers = true) {
  const item = a.items[id];
  if (!item) return;
  const loc = detach(a, id);
  if (item.kind === "block") {
    if (withMembers) item.memberIds.forEach((m) => delete a.items[m]);
    else if (loc) {
      item.memberIds.forEach((m, i) => {
        const q = a.items[m] as QuestionItem;
        q.config.groupId = null;
        q.content.blankRef = null;
        getSection(a, loc.sectionId)!.itemIds.splice(loc.index + i, 0, m);
      });
    }
  }
  delete a.items[id];
}

export function removeSection(a: Assignment, sectionId: ID) {
  const s = getSection(a, sectionId);
  if (!s) return;
  [...s.itemIds].forEach((id) => removeItem(a, id, true));
  a.sections = a.sections.filter((x) => x.id !== sectionId);
}

export function duplicateItem(a: Assignment, id: ID): ID | null {
  const item = a.items[id];
  const loc = locate(a, id);
  if (!item || !loc) return null;
  const clone = structuredClone(item) as Item;
  clone.id = uid(item.kind === "block" ? "b" : "q");
  if (clone.kind === "question" && "options" in clone.content)
    clone.content.options.forEach((o) => (o.id = uid("o")));
  if (clone.kind === "question" && clone.content.type === "MULTI_TEXT_INPUT")
    clone.content.blanks.forEach((b) => (b.id = uid("bl")));
  a.items[clone.id] = clone;
  if (clone.kind === "block") {
    const entryMap = new Map<ID, ID>();
    if (clone.block.type === "POOL")
      clone.block.entries.forEach((e) => {
        const n = uid("e");
        entryMap.set(e.id, n);
        e.id = n;
      });
    clone.memberIds = [];
    for (const m of (item as BlockItem).memberIds) {
      const q = structuredClone(a.items[m]) as QuestionItem;
      q.id = uid("q");
      q.config.groupId = clone.id;
      if (q.content.type === "MATCHING" && q.content.poolId === id) {
        q.content.poolId = clone.id;
        q.content.correctEntryId = entryMap.get(q.content.correctEntryId ?? "") ?? null;
      }
      a.items[q.id] = q;
      clone.memberIds.push(q.id);
    }
  }
  if (clone.kind === "question") clone.config.groupId = loc.groupId;
  container(a, loc).splice(loc.index + 1, 0, clone.id);
  return clone.id;
}

export function newSection(): Section {
  return {
    id: uid("s"),
    titleEn: "New section",
    titleVi: "",
    instructionsEn: "",
    instructionsVi: "",
    itemIds: [],
  };
}

export function createItem(tool: ToolKey): Item {
  const id = uid(isBlockTool(tool) ? "b" : "q");
  const config = { points: 1, required: true, gradingMode: "AUTO" as const, isExample: false, groupId: null };
  const opt = (text: string, isCorrect = false) => ({ id: uid("o"), text, isCorrect });
  switch (tool) {
    case "SINGLE_CHOICE":
      return { id, kind: "question", config, content: { type: "SINGLE_CHOICE", prompt: "", display: "list", options: [opt("Option A", true), opt("Option B"), opt("Option C"), opt("Option D")] } };
    case "TRUE_FALSE":
      return { id, kind: "question", config, content: { type: "SINGLE_CHOICE", prompt: "", display: "list", options: [opt("True", true), opt("False")] } };
    case "MULTIPLE_CHOICE":
      return { id, kind: "question", config, content: { type: "MULTIPLE_CHOICE", prompt: "", options: [opt("Option A", true), opt("Option B", true), opt("Option C"), opt("Option D")] } };
    case "TEXT_INPUT":
      return { id, kind: "question", config, content: { type: "TEXT_INPUT", prompt: "", acceptedAnswers: [""], caseSensitive: false } };
    case "MULTI_BLANKS":
      return { id, kind: "question", config: { ...config, points: 2 }, content: { type: "MULTI_TEXT_INPUT", prompt: "I {{1}} to school and she {{2}} by bus.", caseSensitive: false, blanks: [{ id: uid("bl"), acceptedAnswers: ["walk"] }, { id: uid("bl"), acceptedAnswers: ["goes"] }] } };
    case "MATCHING":
      return { id, kind: "question", config, content: { type: "MATCHING", prompt: "", poolId: null, correctEntryId: null } };
    case "INSTRUCTIONS":
      return { id, kind: "block", memberIds: [], block: { type: "INSTRUCTIONS", text: "Read the instructions carefully." } };
    case "PASSAGE":
      return { id, kind: "block", memberIds: [], block: { type: "PASSAGE", title: "New passage", text: "Type the passage here. Use {{1}} for blanks." } };
    case "MEDIA":
      return { id, kind: "block", memberIds: [], block: { type: "MEDIA", url: "", alt: "", caption: "" } };
    case "POOL":
      return { id, kind: "block", memberIds: [], block: { type: "POOL", title: "Answer pool", entries: [{ id: uid("e"), text: "First answer" }, { id: uid("e"), text: "Second answer" }] } };
    case "SECTION":
      throw new Error("Section is not an item");
  }
}

/** Where a new item goes given the current selection. */
export function targetFromSelection(a: Assignment, sel: Selection, isBlock: boolean): InsertTarget | null {
  if (sel?.kind === "item") {
    const loc = locate(a, sel.id);
    const it = a.items[sel.id];
    if (loc && it) {
      if (it.kind === "block" && !isBlock) return { sectionId: loc.sectionId, groupId: it.id, index: it.memberIds.length };
      if (loc.groupId && isBlock) {
        const s = getSection(a, loc.sectionId)!;
        return { sectionId: loc.sectionId, groupId: null, index: s.itemIds.indexOf(loc.groupId) + 1 };
      }
      return { ...loc, index: loc.index + 1 };
    }
  }
  if (sel?.kind === "section") {
    const s = getSection(a, sel.id);
    if (s) return { sectionId: s.id, groupId: null, index: s.itemIds.length };
  }
  const last = a.sections[a.sections.length - 1];
  return last ? { sectionId: last.id, groupId: null, index: last.itemIds.length } : null;
}

export interface OrderedEntry {
  id: ID;
  sectionId: ID;
  groupId: ID | null;
}

export function docOrder(a: Assignment): OrderedEntry[] {
  const out: OrderedEntry[] = [];
  for (const s of a.sections)
    for (const id of s.itemIds) {
      const it = a.items[id];
      if (!it) continue;
      out.push({ id, sectionId: s.id, groupId: null });
      if (it.kind === "block") it.memberIds.forEach((m) => a.items[m] && out.push({ id: m, sectionId: s.id, groupId: id }));
    }
  return out;
}

export function computeNumbering(a: Assignment) {
  const numbers = new Map<ID, number>();
  let n = 0;
  let points = 0;
  for (const e of docOrder(a)) {
    const it = a.items[e.id];
    if (it.kind === "question" && !it.config.isExample) {
      numbers.set(e.id, ++n);
      points += Number(it.config.points) || 0;
    }
  }
  return { numbers, total: n, points };
}

/** Blank tokens in a markup string, in order. */
export function blankTokens(text: string): string[] {
  return [...text.matchAll(/\{\{(.+?)\}\}/g)].map((m) => m[1]);
}
export function blankNumbers(text: string): number[] {
  return blankTokens(text).map((t, i) => (/^\d+$/.test(t.trim()) ? Number(t) : i + 1));
}

export function blockLabel(it: BlockItem): string {
  switch (it.block.type) {
    case "PASSAGE":
      return it.block.title || "Reading passage";
    case "POOL":
      return it.block.title || "Answer pool";
    case "MEDIA":
      return it.block.alt || "Image";
    case "INSTRUCTIONS":
      return "Instructions";
  }
}

export const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  TEXT_INPUT: "Text input",
  MULTI_TEXT_INPUT: "Multiple blanks",
  MATCHING: "Matching",
  INSTRUCTIONS: "Instructions",
  PASSAGE: "Reading passage",
  MEDIA: "Image",
  POOL: "Answer pool",
};

export const plainText = (s: string) => s.replace(/\[\[(.+?)\]\]/g, "$1").replace(/\{\{(.+?)\}\}/g, "___");
