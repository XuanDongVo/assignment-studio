// @ts-nocheck -- prototype: strict index-access checks relaxed
import { blankNumbers, blankTokens, docOrder, letter } from "./ops";
import type { Assignment, BlockItem, ID } from "./types";

export interface Issue {
  key: string;
  level: "error" | "warning";
  message: string;
  target: { kind: "item" | "section"; id: ID };
}

export function validate(a: Assignment): Issue[] {
  const out: Issue[] = [];
  const add = (level: Issue["level"], kind: "item" | "section", id: ID, message: string) =>
    out.push({ key: `${id}:${out.length}`, level, message, target: { kind, id } });

  for (const s of a.sections) {
    if (!s.titleEn.trim()) add("error", "section", s.id, "Section title is empty");
    if (!s.titleVi.trim()) add("warning", "section", s.id, "Missing Vietnamese section title");
    if (s.instructionsEn.trim() && !s.instructionsVi.trim()) add("warning", "section", s.id, "Missing Vietnamese instructions");
    if (s.itemIds.length === 0) add("warning", "section", s.id, "Section is empty");
  }

  const usedEntries = new Set<ID>();
  for (const e of docOrder(a)) {
    const it = a.items[e.id];
    if (it.kind === "block") {
      const b = it.block;
      if (b.type === "PASSAGE" && it.memberIds.length === 0) add("warning", "item", it.id, "Passage has no questions");
      if (b.type === "PASSAGE") {
        const refs = new Set(it.memberIds.map((m) => (a.items[m]?.kind === "question" ? (a.items[m] as { content: { blankRef?: number | null } }).content.blankRef : null)));
        const missing = blankNumbers(b.text).filter((n) => !refs.has(n));
        if (it.memberIds.length && missing.length) add("warning", "item", it.id, `Blank ${missing.join(", ")} has no question`);
      }
      if (b.type === "MEDIA" && !b.alt.trim()) add("warning", "item", it.id, "Image is missing alt text");
      if (b.type === "INSTRUCTIONS" && !b.text.trim()) add("warning", "item", it.id, "Instructions are empty");
      if (b.type === "POOL" && b.entries.some((x) => !x.text.trim())) add("error", "item", it.id, "Answer pool has an empty entry");
      continue;
    }
    const c = it.content;
    const cf = it.config;
    const group = cf.groupId ? (a.items[cf.groupId] as BlockItem | undefined) : undefined;
    if (cf.groupId && !group) add("error", "item", it.id, "Linked shared block no longer exists");
    const hasBlank = c.blankRef != null;
    if (!c.prompt.trim() && !hasBlank && !("options" in c && c.options.length > 0 && c.options.some((o) => o.text.includes("[["))))
      add("error", "item", it.id, "Prompt is empty");
    if (hasBlank) {
      if (group?.block.type !== "PASSAGE" || !blankNumbers(group.block.text).includes(c.blankRef!))
        add("error", "item", it.id, `Refers to passage blank ${c.blankRef} that does not exist`);
    }
    if (!cf.isExample && (!Number.isFinite(cf.points) || cf.points <= 0)) add("error", "item", it.id, "Points must be greater than 0");
    if (c.type === "SINGLE_CHOICE" || c.type === "MULTIPLE_CHOICE") {
      if (c.options.length < 2) add("error", "item", it.id, "Needs at least 2 options");
      if (!c.options.some((o) => o.isCorrect)) add("error", "item", it.id, "No correct option selected");
      if (c.options.some((o) => !o.text.trim())) add("error", "item", it.id, "An option is empty");
    }
    if (c.type === "TEXT_INPUT" && cf.gradingMode === "AUTO" && !c.acceptedAnswers.some((x) => x.trim()))
      add("error", "item", it.id, "Auto-graded question has no accepted answer");
    if (c.type === "MULTI_TEXT_INPUT") {
      if (blankTokens(c.prompt).length !== c.blanks.length) add("error", "item", it.id, `Prompt has ${blankTokens(c.prompt).length} blanks but ${c.blanks.length} answer sets`);
      if (cf.gradingMode === "AUTO" && c.blanks.some((b) => !b.acceptedAnswers.some((x) => x.trim())))
        add("error", "item", it.id, "A blank has no accepted answer");
    }
    if (c.type === "MATCHING") {
      const pool = c.poolId ? (a.items[c.poolId] as BlockItem | undefined) : undefined;
      if (!pool || pool.block.type !== "POOL") add("error", "item", it.id, "Matching item has no answer pool");
      else if (!c.correctEntryId || !pool.block.entries.some((x) => x.id === c.correctEntryId))
        add("error", "item", it.id, "Matching item has no correct letter");
      else usedEntries.add(c.correctEntryId);
    }
  }
  for (const it of Object.values(a.items)) {
    if (it.kind === "block" && it.block.type === "POOL") {
      const unused = it.block.entries.map((e, i) => (usedEntries.has(e.id) ? null : letter(i))).filter(Boolean);
      if (unused.length) add("warning", "item", it.id, `Unused pool entries: ${unused.join(", ")}`);
    }
  }
  return out;
}
